using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Security.Cryptography;
using System.Text;

namespace Service.Implementations
{
    public class ProjectAnalysisJobService : IProjectAnalysisJobService
    {
        private const string MissingEmbeddedContentMessage =
            "Dự án chưa có nội dung được nhúng (embed). Vui lòng chunk và embed các chương trong Workspace trước khi phân tích.";

        private const string StatusQueued = "Queued";
        private const string StatusProcessing = "Processing";
        private const string StatusCompleted = "Completed";
        private const string StatusFailed = "Failed";
        private const string StatusCancelled = "Cancelled";
        private static readonly TimeSpan CancelAllowedAfter = TimeSpan.FromMinutes(5);
        private const string UserCancelledMessage = "Người dùng đã hủy job phân tích.";
        private const string ReviewPendingMessage = "AI đã phân tích xong, đang kiểm tra bước cuối cùng bởi đội ngũ staff.";

        private const string StageQueued = "Queued";
        private const string StagePreparing = "Preparing";
        private const string StageAnalyzing = "Analyzing";
        private const string StageSaving = "Saving";
        private const string StageCompleted = "Completed";
        private const string StageFailed = "Failed";
        private const string StageCancelled = "Cancelled";

        private readonly AppDbContext _context;
        private readonly IProjectReportService _projectReportService;
        private readonly IAnalysisJobQueue _analysisJobQueue;
        private readonly IAnalysisJobCancellationRegistry _analysisJobCancellationRegistry;
        private readonly ILogger<ProjectAnalysisJobService> _logger;

        public ProjectAnalysisJobService(
            AppDbContext context,
            IProjectReportService projectReportService,
            IAnalysisJobQueue analysisJobQueue,
            IAnalysisJobCancellationRegistry analysisJobCancellationRegistry,
            ILogger<ProjectAnalysisJobService> logger)
        {
            _context = context;
            _projectReportService = projectReportService;
            _analysisJobQueue = analysisJobQueue;
            _analysisJobCancellationRegistry = analysisJobCancellationRegistry;
            _logger = logger;
        }

        public async Task<ProjectAnalysisJobResponse> EnqueueAsync(
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);
            var subscription = await EnsureCanAnalyzeAsync(userId, cancellationToken);
            await EnsureProjectHasEmbeddedContentAsync(projectId, cancellationToken);
            var priority = AnalysisJobPriorityHelper.CalculatePriority(subscription);

            var currentSnapshot = await BuildProjectSnapshotAsync(projectId, cancellationToken);
            var currentProjectVersionHash = currentSnapshot.ProjectVersionHash;

            var activeJob = await _context.ProjectAnalysisJobs
                .Where(j =>
                    j.UserId == userId &&
                    (j.Status == StatusQueued || j.Status == StatusProcessing))
                .OrderByDescending(j => j.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (activeJob != null)
            {
                if (activeJob.ProjectId != projectId)
                {
                    throw new InvalidOperationException(
                        "Bạn đang có một job phân tích khác đang chạy. Vui lòng đợi hoàn thành trước khi phân tích dự án mới.");
                }

                if (activeJob.Status == StatusQueued)
                    await _analysisJobQueue.EnqueueAsync(activeJob.Id, priority, CancellationToken.None);

                return ToResponse(activeJob, isExistingJob: true);
            }

            var job = new ProjectAnalysisJob
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                UserId = userId,
                Status = StatusQueued,
                Stage = StageQueued,
                Progress = 0,
                ProjectVersionHash = currentProjectVersionHash,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.ProjectAnalysisJobs.Add(job);
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Race condition: 2 request enqueue đồng thời cho cùng user.
                var existingActiveJob = await _context.ProjectAnalysisJobs
                    .Where(j =>
                        j.UserId == userId &&
                        (j.Status == StatusQueued || j.Status == StatusProcessing))
                    .OrderByDescending(j => j.CreatedAt)
                    .FirstOrDefaultAsync(cancellationToken);

                if (existingActiveJob == null)
                    throw;

                if (existingActiveJob.ProjectId != projectId)
                {
                    throw new InvalidOperationException(
                        "Bạn đang có một job phân tích khác đang chạy. Vui lòng đợi hoàn thành trước khi phân tích dự án mới.");
                }

                if (existingActiveJob.Status == StatusQueued)
                    await _analysisJobQueue.EnqueueAsync(existingActiveJob.Id, priority, CancellationToken.None);

                return ToResponse(existingActiveJob, isExistingJob: true);
            }

            // Queue in memory for immediate processing.
            await _analysisJobQueue.EnqueueAsync(job.Id, priority, CancellationToken.None);

            return ToResponse(job, isExistingJob: false);
        }

        public async Task<ProjectAnalysisJobResponse?> GetActiveJobAsync(
            Guid userId,
            Guid? projectId = null,
            CancellationToken cancellationToken = default)
        {
            var query = _context.ProjectAnalysisJobs
                .AsNoTracking()
                .Where(j =>
                    j.UserId == userId &&
                    (j.Status == StatusQueued || j.Status == StatusProcessing));

            if (projectId.HasValue)
                query = query.Where(j => j.ProjectId == projectId.Value);

            var job = await query
                .OrderByDescending(j => j.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            return job == null ? null : ToResponse(job, isExistingJob: true);
        }

        public async Task<ProjectAnalysisJobResponse?> GetLatestJobAsync(
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);

            var job = await _context.ProjectAnalysisJobs
                .AsNoTracking()
                .Where(j => j.ProjectId == projectId && j.UserId == userId)
                .OrderByDescending(j => j.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (job == null) return null;

            var isActive = job.Status == StatusQueued || job.Status == StatusProcessing;
            return ToResponse(job, isExistingJob: isActive);
        }

        public async Task<ProjectAnalysisJobResponse?> GetJobAsync(
            Guid projectId,
            Guid jobId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);

            var job = await _context.ProjectAnalysisJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j =>
                    j.Id == jobId &&
                    j.ProjectId == projectId &&
                    j.UserId == userId, cancellationToken);

            return job == null ? null : ToResponse(job);
        }

        public async Task<ProjectReportResponse> GetJobResultAsync(
            Guid projectId,
            Guid jobId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);

            var job = await _context.ProjectAnalysisJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j =>
                    j.Id == jobId &&
                    j.ProjectId == projectId &&
                    j.UserId == userId, cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy job phân tích.");

            if (job.Status != StatusCompleted || !job.ReportId.HasValue)
                throw new InvalidOperationException("Job chưa hoàn thành nên chưa có kết quả.");

            var reviewStatus = await _context.ProjectReports
                .AsNoTracking()
                .Where(r => r.Id == job.ReportId.Value)
                .Select(r => r.ReviewStatus)
                .FirstOrDefaultAsync(cancellationToken);

            if (string.Equals(reviewStatus, "PendingStaffReview", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(reviewStatus, "StaffReviewing", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(ReviewPendingMessage);
            }

            var report = await _projectReportService.GetByIdAsync(job.ReportId.Value, projectId, userId)
                ?? throw new KeyNotFoundException("Không tìm thấy báo cáo kết quả của job.");

            return report;
        }

        public async Task<ProjectAnalysisJobResponse> CancelJobAsync(
            Guid projectId,
            Guid jobId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);

            var job = await _context.ProjectAnalysisJobs
                .FirstOrDefaultAsync(j =>
                    j.Id == jobId &&
                    j.ProjectId == projectId &&
                    j.UserId == userId, cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy job phân tích.");

            if (job.Status == StatusCancelled)
                return ToResponse(job);

            if (job.Status == StatusCompleted || job.Status == StatusFailed)
                throw new InvalidOperationException("Job đã kết thúc, không thể hủy.");

            if (job.Status != StatusQueued && job.Status != StatusProcessing)
                throw new InvalidOperationException("Job hiện không ở trạng thái có thể hủy.");

            var elapsed = DateTime.UtcNow - job.CreatedAt;
            if (elapsed < CancelAllowedAfter)
            {
                var remaining = CancelAllowedAfter - elapsed;
                var roundedRemaining = TimeSpan.FromSeconds(Math.Ceiling(remaining.TotalSeconds));
                throw new InvalidOperationException(
                    $"Bạn có thể hủy sau khoảng 5 phút kể từ lúc gửi yêu cầu. Còn lại {roundedRemaining:mm\\:ss}.");
            }

            job.Status = StatusCancelled;
            job.Stage = StageCancelled;
            job.Progress = 100;
            job.ErrorMessage = UserCancelledMessage;
            job.CompletedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            _analysisJobCancellationRegistry.RequestCancellation(job.Id);

            return ToResponse(job);
        }

        public async Task ProcessJobAsync(Guid jobId, CancellationToken cancellationToken = default)
        {
            var job = await _context.ProjectAnalysisJobs
                .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);

            if (job == null || job.Status != StatusQueued)
                return;

            var processingToken = _analysisJobCancellationRegistry.Register(jobId, cancellationToken);

            try
            {
                await ThrowIfJobCancelledAsync(jobId, processingToken);

                job.Status = StatusProcessing;
                job.Stage = StagePreparing;
                job.Progress = 10;
                job.StartedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(processingToken);

                await ThrowIfJobCancelledAsync(jobId, processingToken);

                job.Stage = StageAnalyzing;
                job.Progress = 20;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(processingToken);

                var report = await _projectReportService.AnalyzeAsync(
                    job.ProjectId,
                    job.UserId,
                    async (progress, message, token) =>
                    {
                        await ThrowIfJobCancelledAsync(jobId, token);

                        var safeProgress = Math.Clamp(progress, 20, 85);
                        if (job.Progress == safeProgress)
                            return;

                        job.Stage = StageAnalyzing;
                        job.Progress = safeProgress;
                        job.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync(token);
                    },
                    processingToken,
                    job.Id);

                await ThrowIfJobCancelledAsync(jobId, processingToken);

                job.Stage = StageSaving;
                job.Progress = 90;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(processingToken);

                await ThrowIfJobCancelledAsync(jobId, processingToken);

                job.Status = StatusCompleted;
                job.Stage = StageCompleted;
                job.Progress = 100;
                job.ReportId = report.Id;
                job.ProjectVersionHash = report.ProjectVersionHash;
                job.ErrorMessage = null;
                job.CompletedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(processingToken);
            }
            catch (OperationCanceledException)
            {
                var latestStatus = await GetCurrentJobStatusAsync(jobId, CancellationToken.None);
                if (latestStatus == StatusCancelled)
                    return;

                if (!cancellationToken.IsCancellationRequested)
                    throw;

                job.Status = StatusQueued;
                job.Stage = StageQueued;
                job.Progress = 0;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
                throw;
            }
            catch (Exception ex)
            {
                var latestStatus = await GetCurrentJobStatusAsync(jobId, CancellationToken.None);
                if (latestStatus == StatusCancelled)
                    return;

                _logger.LogError(ex, "Project analysis job {JobId} failed.", jobId);

                job.Status = StatusFailed;
                job.Stage = StageFailed;
                job.Progress = 100;
                job.ErrorMessage = Truncate(ex.Message, 2000);
                job.CompletedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }
            finally
            {
                _analysisJobCancellationRegistry.Unregister(jobId);
            }
        }

        private async Task ThrowIfJobCancelledAsync(Guid jobId, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var currentStatus = await GetCurrentJobStatusAsync(jobId, cancellationToken);
            if (currentStatus == StatusCancelled)
                throw new OperationCanceledException("Job đã bị hủy bởi người dùng.", cancellationToken);
        }

        private async Task<string?> GetCurrentJobStatusAsync(Guid jobId, CancellationToken cancellationToken)
        {
            return await _context.ProjectAnalysisJobs
                .AsNoTracking()
                .Where(j => j.Id == jobId)
                .Select(j => j.Status)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task VerifyOwnershipAsync(Guid projectId, Guid userId, CancellationToken cancellationToken)
        {
            var exists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId, cancellationToken);

            if (!exists)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        private async Task<UserSubscription> EnsureCanAnalyzeAsync(Guid userId, CancellationToken cancellationToken)
        {
            var sub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new InvalidOperationException("Bạn chưa có gói đăng ký hợp lệ. Vui lòng đăng ký gói để dùng tính năng này.");

            if (sub.UsedAnalysisCount >= sub.Plan.MaxAnalysisCount)
                throw new InvalidOperationException($"Bạn đã dùng hết {sub.Plan.MaxAnalysisCount} lần phân tích trong kỳ này.");

            return sub;
        }

        private async Task EnsureProjectHasEmbeddedContentAsync(Guid projectId, CancellationToken cancellationToken)
        {
            var activeVersionIds = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted && c.CurrentVersionId.HasValue)
                .Select(c => c.CurrentVersionId!.Value)
                .ToListAsync(cancellationToken);

            if (activeVersionIds.Count == 0)
                throw new InvalidOperationException(MissingEmbeddedContentMessage);

            var hasEmbeddedChunks = await _context.ChapterChunks
                .AnyAsync(c => c.ProjectId == projectId && c.Embedding != null && activeVersionIds.Contains(c.VersionId), cancellationToken);

            if (!hasEmbeddedChunks)
                throw new InvalidOperationException(MissingEmbeddedContentMessage);
        }

        private async Task<ProjectAnalysisSnapshotState> BuildProjectSnapshotAsync(Guid projectId, CancellationToken cancellationToken)
        {
            var chapters = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .OrderBy(c => c.ChapterNumber)
                .Select(c => new
                {
                    c.ChapterNumber,
                    c.CurrentVersionId,
                    c.WordCount,
                    c.UpdatedAt,
                    c.DraftSavedAt,
                })
                .ToListAsync(cancellationToken);

            var activeVersionIds = chapters
                .Where(c => c.CurrentVersionId.HasValue)
                .Select(c => c.CurrentVersionId!.Value)
                .ToList();

            var versionStates = activeVersionIds.Count == 0
                ? []
                : await _context.ChapterVersions
                    .Where(v => activeVersionIds.Contains(v.Id))
                    .Select(v => new
                    {
                        v.Id,
                        v.ChapterId,
                        v.IsChunked,
                        v.IsEmbedded,
                        ChunkCount = v.Chunks.Count,
                    })
                    .ToListAsync(cancellationToken);

            var stateByVersionId = versionStates.ToDictionary(x => x.Id);
            var snapshots = chapters.Select(chapter =>
            {
                stateByVersionId.TryGetValue(chapter.CurrentVersionId ?? Guid.Empty, out var state);
                return new ProjectAnalysisChapterSnapshot(
                    chapter.ChapterNumber,
                    chapter.CurrentVersionId,
                    chapter.WordCount,
                    chapter.UpdatedAt,
                    chapter.DraftSavedAt,
                    state?.IsChunked ?? false,
                    state?.IsEmbedded ?? false,
                    state?.ChunkCount ?? 0);
            }).ToList();

            return new ProjectAnalysisSnapshotState(snapshots, ProjectAnalysisSnapshotHelper.BuildProjectVersionHash(projectId, snapshots));
        }

        private static ProjectAnalysisJobResponse ToResponse(ProjectAnalysisJob job, bool isExistingJob = false)
        {
            return new ProjectAnalysisJobResponse
            {
                JobId = job.Id,
                ProjectId = job.ProjectId,
                Status = job.Status,
                Stage = job.Stage,
                Progress = job.Progress,
                ReportId = job.ReportId,
                ErrorMessage = job.ErrorMessage,
                IsExistingJob = isExistingJob,
                ProjectVersionHash = job.ProjectVersionHash,
                CreatedAt = job.CreatedAt,
                StartedAt = job.StartedAt,
                CompletedAt = job.CompletedAt,
            };
        }

        private static string? Truncate(string? value, int maxLen)
        {
            if (string.IsNullOrWhiteSpace(value))
                return value;
            return value.Length <= maxLen ? value : value[..maxLen];
        }

        private sealed record ProjectAnalysisSnapshotState(
            IReadOnlyList<ProjectAnalysisChapterSnapshot> Chapters,
            string ProjectVersionHash);
    }
}
