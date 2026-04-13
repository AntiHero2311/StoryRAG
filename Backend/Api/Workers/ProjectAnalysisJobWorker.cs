using Microsoft.EntityFrameworkCore;
using Repository.Data;
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

            var pendingJobIds = await context.ProjectAnalysisJobs
                .AsNoTracking()
                .Where(j => j.Status == "Queued")
                .OrderBy(j => j.CreatedAt)
                .Select(j => j.Id)
                .ToListAsync(cancellationToken);

            foreach (var jobId in pendingJobIds)
                await _analysisJobQueue.EnqueueAsync(jobId, cancellationToken);

            if (pendingJobIds.Count > 0)
                _logger.LogInformation("Re-enqueued {Count} pending analysis jobs on startup.", pendingJobIds.Count);
        }
    }
}
