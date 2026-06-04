using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
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
        private readonly INotificationService _notificationService;
        private readonly IEmbeddingService _embeddingService;
        private readonly ILogger<ProjectAnalysisJobService> _logger;
        private readonly IConfiguration _config;
        private readonly SemaphoreSlim _progressLock = new(1, 1);

        public ProjectAnalysisJobService(
            AppDbContext context,
            IProjectReportService projectReportService,
            IAnalysisJobQueue analysisJobQueue,
            IAnalysisJobCancellationRegistry analysisJobCancellationRegistry,
            INotificationService notificationService,
            IEmbeddingService embeddingService,
            ILogger<ProjectAnalysisJobService> logger,
            IConfiguration config)
        {
            _context = context;
            _projectReportService = projectReportService;
            _analysisJobQueue = analysisJobQueue;
            _analysisJobCancellationRegistry = analysisJobCancellationRegistry;
            _notificationService = notificationService;
            _embeddingService = embeddingService;
            _logger = logger;
            _config = config;
        }

        public async Task<ProjectAnalysisJobResponse> EnqueueAsync(
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);
            var subscription = await EnsureCanAnalyzeAsync(userId, cancellationToken);
            await EnsureProjectHasEmbeddedContentAsync(projectId, cancellationToken);

            var totalWords = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .SumAsync(c => c.WordCount, cancellationToken);

            if (totalWords < 1000)
            {
                throw new InvalidOperationException($"Tác phẩm cần đạt tối thiểu 1.000 chữ để có thể phân tích (hiện tại có {totalWords:N0} chữ). Hãy sáng tác thêm để AI có đủ dữ liệu đánh giá nhé!");
            }

            var priority = AnalysisJobPriorityHelper.CalculatePriority(subscription);

            var currentSnapshot = await BuildProjectSnapshotAsync(projectId, cancellationToken);
            var currentProjectVersionHash = currentSnapshot.ProjectVersionHash;

            // Chặn enqueue mới nếu báo cáo mới nhất đang được staff biên tập nháp
            var latestReportForBlock = await _context.ProjectReports
                .AsNoTracking()
                .Where(r => r.ProjectId == projectId && r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (latestReportForBlock != null && 
                (latestReportForBlock.ReviewStatus == "PendingStaffReview" || latestReportForBlock.ReviewStatus == "StaffReviewing"))
            {
                throw new InvalidOperationException(
                    "Báo cáo phân tích mới nhất đang được đội ngũ Staff xử lý. " +
                    "Vui lòng chờ Staff hoàn tất trước khi yêu cầu phân tích mới.");
            }

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
                // Ưu tiên job đang chạy, sau đó tới job đã hoàn thành có report.
                // Tránh trường hợp 1 job fail mới nhất "che" mất job Completed ngay trước đó.
                .OrderBy(j =>
                    (j.Status == StatusQueued || j.Status == StatusProcessing) ? 0 :
                    (j.Status == StatusCompleted && j.ReportId.HasValue) ? 1 : 2)
                .ThenByDescending(j => j.CreatedAt)
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
                
                try
                {
                    await _context.SaveChangesAsync(processingToken);
                }
                catch (DbUpdateException ex)
                {
                    _logger.LogError(ex, "Failed to update job {JobId} to Processing status. Checking for constraint violation.", jobId);
                    
                    // Check if there's another job in Processing status for the same user
                    var otherProcessingJob = await _context.ProjectAnalysisJobs
                        .FirstOrDefaultAsync(j => 
                            j.UserId == job.UserId && 
                            j.Id != job.Id && 
                            j.Status == StatusProcessing, CancellationToken.None);
                    
                    if (otherProcessingJob != null)
                    {
                        _logger.LogWarning(
                            "Found another Processing job {OtherJobId} for user {UserId}. Cancelling it.",
                            otherProcessingJob.Id, job.UserId);
                        
                        // Cancel the conflicting job
                        otherProcessingJob.Status = StatusCancelled;
                        otherProcessingJob.Stage = StageCancelled;
                        otherProcessingJob.Progress = 100;
                        otherProcessingJob.ErrorMessage = "Tự động hủy do conflict với job mới. Bạn bắt đầu phân tích dự án khác.";
                        otherProcessingJob.CompletedAt = DateTime.UtcNow;
                        otherProcessingJob.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync(CancellationToken.None);
                        
                        // Detach the conflicting job and retry with the current job
                        _context.Entry(otherProcessingJob).State = EntityState.Detached;
                        
                        // Retry the original update
                        await _context.SaveChangesAsync(processingToken);
                    }
                    else
                    {
                        throw;
                    }
                }

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
                        await _progressLock.WaitAsync(token);
                        try
                        {
                            await ThrowIfJobCancelledAsync(jobId, token);

                            var safeProgress = Math.Clamp(progress, 20, 85);
                            var normalizedStage = NormalizeStage(message);
                            if (job.Progress == safeProgress && job.Stage == normalizedStage)
                                return;

                            job.Stage = normalizedStage;
                            job.Progress = safeProgress;
                            job.UpdatedAt = DateTime.UtcNow;
                            
                            try
                            {
                                await _context.SaveChangesAsync(token);
                            }
                            catch (DbUpdateConcurrencyException)
                            {
                                // Reload job and retry if concurrency issue
                                await _context.Entry(job).ReloadAsync(token);
                                job.Stage = normalizedStage;
                                job.Progress = safeProgress;
                                job.UpdatedAt = DateTime.UtcNow;
                                await _context.SaveChangesAsync(token);
                            }
                            catch (DbUpdateException ex)
                            {
                                // Log but don't throw - progress updates are not critical
                                _logger.LogWarning(ex, "Failed to update progress for job {JobId}. Continuing anyway.", jobId);
                            }
                        }
                        finally
                        {
                            _progressLock.Release();
                        }
                    },
                    processingToken,
                    job.Id);

                // ── QUAN TRỌNG: Sau khi AnalyzeAsync return, report đã được ghi vào DB
                // và lượt phân tích đã bị trừ. Từ đây KHÔNG check cancel nữa —
                // luôn đánh dấu job Completed để không để report mồ côi.
                // Dùng CancellationToken.None để đảm bảo save thành công.

                job.Stage = StageSaving;
                job.Progress = 90;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);

                job.Status = StatusCompleted;
                job.Stage = StageCompleted;
                job.Progress = 100;
                job.ReportId = report.Id;
                job.ProjectVersionHash = report.ProjectVersionHash;
                job.ErrorMessage = null;
                job.CompletedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);

                var projectTitle = await GetProjectTitleAsync(job.ProjectId, CancellationToken.None);
                await _notificationService.CreateForUserAsync(
                    job.UserId,
                    "success",
                    "Phân tích AI hoàn tất",
                    $"Dự án \"{projectTitle}\" đã có kết quả phân tích mới.",
                    tag: $"analysis-result:{job.Id}",
                    cancellationToken: CancellationToken.None);
            }
            catch (OperationCanceledException)
            {
                // Nếu AnalyzeAsync đã hoàn thành (report đã lưu DB) trước khi cancel:
                // → Rescue: link report vào job, đánh Completed, không để mồ côi.
                var orphanReport = await FindOrphanReportAsync(job.ProjectId, job.UserId, jobId);
                if (orphanReport != null)
                {
                    _logger.LogWarning(
                        "Job {JobId} cancelled but report {ReportId} already saved. Rescuing as Completed.",
                        jobId, orphanReport.Value);

                    await _context.Entry(job).ReloadAsync(CancellationToken.None);
                    job.Status = StatusCompleted;
                    job.Stage = StageCompleted;
                    job.Progress = 100;
                    job.ReportId = orphanReport.Value;
                    job.ErrorMessage = null;
                    job.CompletedAt = DateTime.UtcNow;
                    job.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(CancellationToken.None);
                    return;
                }

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

                var projectTitle = await GetProjectTitleAsync(job.ProjectId, CancellationToken.None);
                
                // Gửi thông báo chung chung, không chứa mã lỗi hoặc chi tiết exception cho Tác giả (Author)
                var failureMessageAuthor = $"Job phân tích cho dự án \"{projectTitle}\" thất bại. Vui lòng thử lại.";
                await _notificationService.CreateForUserAsync(
                    job.UserId,
                    "error",
                    "Phân tích AI gặp lỗi",
                    failureMessageAuthor,
                    tag: $"analysis-failed:{job.Id}",
                    cancellationToken: CancellationToken.None);

                // Gửi thông báo chi tiết đầy đủ exception cho Ban kiểm duyệt (Staff, Admin) để phục vụ debug và kiểm duyệt
                var failureMessageStaff = $"Job phân tích cho dự án \"{projectTitle}\" thất bại. Mã job: {job.Id}. Lý do: {Truncate(ex.Message, 300)}";
                await _notificationService.CreateForRolesAsync(
                    ["Staff", "Admin"],
                    "error",
                    "Phân tích AI gặp lỗi (Kỹ thuật)",
                    failureMessageStaff,
                    tag: $"analysis-failed-tech:{job.Id}",
                    cancellationToken: CancellationToken.None);
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

        /// <summary>
        /// Tìm report mồ côi: report đã được AnalyzeAsync tạo và save vào DB
        /// nhưng job bị cancel trước khi kịp link ReportId.
        /// Tìm report mới nhất của project+user mà chưa có job nào trỏ tới.
        /// </summary>
        private async Task<Guid?> FindOrphanReportAsync(Guid projectId, Guid userId, Guid currentJobId)
        {
            // Lấy tất cả reportId đã được link bởi các job khác
            var linkedReportIds = _context.ProjectAnalysisJobs
                .Where(j => j.ReportId.HasValue && j.Id != currentJobId)
                .Select(j => j.ReportId!.Value);

            // Tìm report mới nhất chưa có job nào trỏ tới
            var orphanReportId = await _context.ProjectReports
                .Where(r =>
                    r.ProjectId == projectId &&
                    r.UserId == userId &&
                    !linkedReportIds.Contains(r.Id))
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => r.Id)
                .FirstOrDefaultAsync(CancellationToken.None);

            return orphanReportId == Guid.Empty ? null : orphanReportId;
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
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy dự án.");

            var activeVersionIds = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted && c.CurrentVersionId.HasValue)
                .Select(c => c.CurrentVersionId!.Value)
                .ToListAsync(cancellationToken);

            if (activeVersionIds.Count == 0)
            {
                throw new InvalidOperationException("Dự án chưa có chương nào được soạn thảo hoặc lưu nháp. Vui lòng tạo chương trước khi phân tích.");
            }

            // Bỏ việc chặn hoặc tự động nhúng đồng bộ trên luồng HTTP để tránh timeout / lỗi mạng (network error).
            // Tiến trình chạy ngầm ProjectAnalysisJobWorker sẽ tự động thực hiện tách chunk và nhúng các chương còn thiếu khi chạy job.
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

        private static string NormalizeStage(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return StageAnalyzing;

            if (value.Equals(StageQueued, StringComparison.OrdinalIgnoreCase))
                return StageQueued;
            if (value.Equals(StagePreparing, StringComparison.OrdinalIgnoreCase))
                return StagePreparing;
            if (value.Equals(StageAnalyzing, StringComparison.OrdinalIgnoreCase))
                return StageAnalyzing;
            if (value.Equals(StageSaving, StringComparison.OrdinalIgnoreCase))
                return StageSaving;
            if (value.Equals(StageCompleted, StringComparison.OrdinalIgnoreCase))
                return StageCompleted;
            if (value.Equals(StageFailed, StringComparison.OrdinalIgnoreCase))
                return StageFailed;
            if (value.Equals(StageCancelled, StringComparison.OrdinalIgnoreCase))
                return StageCancelled;

            return StageAnalyzing;
        }

        private static ProjectAnalysisJobResponse ToResponse(ProjectAnalysisJob job, bool isExistingJob = false)
        {
            // Bảo vệ an toàn thông tin: Chỉ trả về thông báo thất bại chung cho người dùng, ẩn các chi tiết kỹ thuật/exception.
            var displayErrorMessage = job.ErrorMessage;
            if (job.Status == StatusFailed && !string.IsNullOrWhiteSpace(displayErrorMessage))
            {
                displayErrorMessage = "Phân tích thất bại. Vui lòng thử lại.";
            }

            return new ProjectAnalysisJobResponse
            {
                JobId = job.Id,
                ProjectId = job.ProjectId,
                Status = job.Status,
                Stage = job.Stage,
                Progress = job.Progress,
                ReportId = job.ReportId,
                ErrorMessage = displayErrorMessage,
                IsExistingJob = isExistingJob,
                ProjectVersionHash = job.ProjectVersionHash,
                CreatedAt = job.CreatedAt,
                StartedAt = job.StartedAt,
                CompletedAt = job.CompletedAt,
            };
        }

        private async Task<string> GetProjectTitleAsync(Guid projectId, CancellationToken cancellationToken)
        {
            var project = await _context.Projects
                .AsNoTracking()
                .Include(p => p.Author)
                .Where(p => p.Id == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (project == null || string.IsNullOrWhiteSpace(project.Title))
                return projectId.ToString();

            try
            {
                var masterKey = _config["Security:MasterKey"];
                if (!string.IsNullOrWhiteSpace(masterKey) && !string.IsNullOrWhiteSpace(project.Author?.DataEncryptionKey))
                {
                    var authorDek = EncryptionHelper.DecryptWithMasterKey(project.Author.DataEncryptionKey, masterKey);
                    var plainTitle = EncryptionHelper.DecryptWithMasterKey(project.Title, authorDek);
                    if (!string.IsNullOrWhiteSpace(plainTitle))
                    {
                        return plainTitle;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to decrypt project title for project {ProjectId}.", projectId);
            }

            return project.Title;
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
