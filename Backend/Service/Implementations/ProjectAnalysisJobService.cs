using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Cryptography;
using System.Text;

namespace Service.Implementations
{
    public class ProjectAnalysisJobService : IProjectAnalysisJobService
    {
        private const string StatusQueued = "Queued";
        private const string StatusProcessing = "Processing";
        private const string StatusCompleted = "Completed";
        private const string StatusFailed = "Failed";
        private const string StatusCancelled = "Cancelled";

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
        private readonly ILogger<ProjectAnalysisJobService> _logger;

        public ProjectAnalysisJobService(
            AppDbContext context,
            IProjectReportService projectReportService,
            IAnalysisJobQueue analysisJobQueue,
            ILogger<ProjectAnalysisJobService> logger)
        {
            _context = context;
            _projectReportService = projectReportService;
            _analysisJobQueue = analysisJobQueue;
            _logger = logger;
        }

        public async Task<ProjectAnalysisJobResponse> EnqueueAsync(
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);
            await EnsureCanAnalyzeAsync(userId, cancellationToken);

            var projectVersionHash = await BuildProjectVersionHashAsync(projectId, cancellationToken);

            var existingJob = await _context.ProjectAnalysisJobs
                .Where(j =>
                    j.ProjectId == projectId &&
                    j.UserId == userId &&
                    j.ProjectVersionHash == projectVersionHash &&
                    (j.Status == StatusQueued || j.Status == StatusProcessing))
                .OrderByDescending(j => j.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (existingJob != null)
            {
                if (existingJob.Status == StatusQueued)
                    await _analysisJobQueue.EnqueueAsync(existingJob.Id, CancellationToken.None);

                return ToResponse(existingJob, isExistingJob: true);
            }

            var job = new ProjectAnalysisJob
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                UserId = userId,
                Status = StatusQueued,
                Stage = StageQueued,
                Progress = 0,
                ProjectVersionHash = projectVersionHash,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.ProjectAnalysisJobs.Add(job);
            await _context.SaveChangesAsync(cancellationToken);

            // Queue in memory for immediate processing.
            await _analysisJobQueue.EnqueueAsync(job.Id, CancellationToken.None);

            return ToResponse(job, isExistingJob: false);
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

            if (job.Status == StatusProcessing)
                throw new InvalidOperationException("Job đang xử lý, chưa thể hủy.");

            if (job.Status == StatusQueued)
            {
                job.Status = StatusCancelled;
                job.Stage = StageCancelled;
                job.Progress = 100;
                job.CompletedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }

            return ToResponse(job);
        }

        public async Task ProcessJobAsync(Guid jobId, CancellationToken cancellationToken = default)
        {
            var job = await _context.ProjectAnalysisJobs
                .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);

            if (job == null || job.Status != StatusQueued)
                return;

            job.Status = StatusProcessing;
            job.Stage = StagePreparing;
            job.Progress = 10;
            job.StartedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            try
            {
                job.Stage = StageAnalyzing;
                job.Progress = 45;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);

                var report = await _projectReportService.AnalyzeAsync(job.ProjectId, job.UserId);

                job.Stage = StageSaving;
                job.Progress = 90;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);

                job.Status = StatusCompleted;
                job.Stage = StageCompleted;
                job.Progress = 100;
                job.ReportId = report.Id;
                job.ErrorMessage = null;
                job.CompletedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                job.Status = StatusQueued;
                job.Stage = StageQueued;
                job.Progress = 0;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Project analysis job {JobId} failed.", jobId);

                job.Status = StatusFailed;
                job.Stage = StageFailed;
                job.Progress = 100;
                job.ErrorMessage = Truncate(ex.Message, 2000);
                job.CompletedAt = DateTime.UtcNow;
                job.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }
        }

        private async Task VerifyOwnershipAsync(Guid projectId, Guid userId, CancellationToken cancellationToken)
        {
            var exists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId, cancellationToken);

            if (!exists)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        private async Task EnsureCanAnalyzeAsync(Guid userId, CancellationToken cancellationToken)
        {
            var sub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new InvalidOperationException("Bạn chưa có gói đăng ký hợp lệ. Vui lòng đăng ký gói để dùng tính năng này.");

            if (sub.UsedAnalysisCount >= sub.Plan.MaxAnalysisCount)
                throw new InvalidOperationException($"Bạn đã dùng hết {sub.Plan.MaxAnalysisCount} lần phân tích trong kỳ này.");
        }

        private async Task<string> BuildProjectVersionHashAsync(Guid projectId, CancellationToken cancellationToken)
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

            var embeddedChunkCount = activeVersionIds.Count == 0
                ? 0
                : await _context.ChapterChunks
                    .Where(c => c.ProjectId == projectId && c.Embedding != null && activeVersionIds.Contains(c.VersionId))
                    .CountAsync(cancellationToken);

            var seedBuilder = new StringBuilder()
                .Append(projectId).Append('|')
                .Append("chapters:").Append(chapters.Count).Append('|')
                .Append("chunks:").Append(embeddedChunkCount).Append('|');

            foreach (var chapter in chapters)
            {
                seedBuilder
                    .Append(chapter.ChapterNumber).Append(':')
                    .Append(chapter.CurrentVersionId?.ToString() ?? "none").Append(':')
                    .Append(chapter.WordCount).Append(':')
                    .Append(chapter.UpdatedAt?.Ticks ?? 0).Append(':')
                    .Append(chapter.DraftSavedAt?.Ticks ?? 0)
                    .Append('|');
            }

            var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(seedBuilder.ToString()));
            return Convert.ToHexString(hashBytes);
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
    }
}
