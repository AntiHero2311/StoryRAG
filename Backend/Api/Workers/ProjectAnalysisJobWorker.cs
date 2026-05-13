using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.Helpers;
using Service.Interfaces;

namespace Api.Workers
{
    public class ProjectAnalysisJobWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IAnalysisJobQueue _analysisJobQueue;
        private readonly ILogger<ProjectAnalysisJobWorker> _logger;

        public ProjectAnalysisJobWorker(
            IServiceScopeFactory scopeFactory,
            IAnalysisJobQueue analysisJobQueue,
            ILogger<ProjectAnalysisJobWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _analysisJobQueue = analysisJobQueue;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await EnqueuePendingJobsAsync(stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                Guid jobId;
                try
                {
                    jobId = await _analysisJobQueue.DequeueAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }

                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var jobService = scope.ServiceProvider.GetRequiredService<IProjectAnalysisJobService>();
                    await jobService.ProcessJobAsync(jobId, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error while processing analysis job {JobId}.", jobId);
                }
            }
        }

        private async Task EnqueuePendingJobsAsync(CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Reset "Processing" jobs về "Queued" — những jobs này bị orphaned khi server restart.
            // Nếu để nguyên "Processing", user sẽ thấy job mãi không hoàn thành.
            var staleProcessingJobs = await context.ProjectAnalysisJobs
                .Where(j => j.Status == "Processing")
                .ToListAsync(cancellationToken);

            if (staleProcessingJobs.Count > 0)
            {
                var now = DateTime.UtcNow;
                foreach (var job in staleProcessingJobs)
                {
                    job.Status = "Queued";
                    job.Stage = "Queued";
                    job.Progress = 0;
                    job.StartedAt = null;
                    job.UpdatedAt = now;
                    job.ErrorMessage = null;
                }
                await context.SaveChangesAsync(cancellationToken);
                _logger.LogWarning(
                    "Reset {Count} stale 'Processing' analysis jobs back to 'Queued' on startup.",
                    staleProcessingJobs.Count);
            }

            // Re-enqueue tất cả jobs ở trạng thái Queued (bao gồm cả những job vừa reset ở trên).
            var pendingJobs = await context.ProjectAnalysisJobs
                .AsNoTracking()
                .Where(j => j.Status == "Queued")
                .OrderBy(j => j.CreatedAt)
                .ToListAsync(cancellationToken);

            var pendingUserIds = pendingJobs
                .Select(j => j.UserId)
                .Distinct()
                .ToList();

            var subscriptions = await context.UserSubscriptions
                .AsNoTracking()
                .Include(s => s.Plan)
                .Where(s =>
                    pendingUserIds.Contains(s.UserId) &&
                    s.Status == "Active" &&
                    s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .ToListAsync(cancellationToken);

            var priorityByUser = subscriptions
                .GroupBy(s => s.UserId)
                .ToDictionary(
                    g => g.Key,
                    g => AnalysisJobPriorityHelper.CalculatePriority(g.First()));

            foreach (var job in pendingJobs)
            {
                var priority = priorityByUser.GetValueOrDefault(job.UserId, 10);
                await _analysisJobQueue.EnqueueAsync(job.Id, priority, cancellationToken);
            }

            if (pendingJobs.Count > 0)
                _logger.LogInformation("Re-enqueued {Count} pending analysis jobs on startup.", pendingJobs.Count);
        }
    }
}
