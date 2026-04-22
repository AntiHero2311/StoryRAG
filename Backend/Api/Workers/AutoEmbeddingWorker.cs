using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.Interfaces;

namespace Api.Workers
{
    public class AutoEmbeddingWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AutoEmbeddingWorker> _logger;
        private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(15);
        private readonly TimeSpan _embedDelay = TimeSpan.FromSeconds(45);

        public AutoEmbeddingWorker(IServiceScopeFactory scopeFactory, ILogger<AutoEmbeddingWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("AutoEmbeddingWorker is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessPendingEmbedsAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error in AutoEmbeddingWorker.");
                }

                await Task.Delay(_pollInterval, stoppingToken);
            }

            _logger.LogInformation("AutoEmbeddingWorker is stopping.");
        }

        private async Task ProcessPendingEmbedsAsync(CancellationToken stoppingToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var embeddingService = scope.ServiceProvider.GetRequiredService<IEmbeddingService>();
            var chapterService = scope.ServiceProvider.GetRequiredService<IChapterService>();

            var thresholdTime = DateTime.UtcNow.Subtract(_embedDelay);

            // Tìm các Chapter đang active mà CurrentVersion chưa được nhúng và đã quá thời gian threshold
            var pendingChapters = await context.Chapters
                .Include(c => c.Project)
                .Where(c => !c.IsDeleted && !c.Project.IsDeleted && c.CurrentVersionId.HasValue)
                .Select(c => new { c.Id, c.CurrentVersionId, c.Project.AuthorId })
                .ToListAsync(stoppingToken);

            var pendingVersionIds = pendingChapters.Select(c => c.CurrentVersionId!.Value).ToList();

            if (pendingVersionIds.Count == 0) return;

            var versionsToEmbed = await context.ChapterVersions
                .Where(v => pendingVersionIds.Contains(v.Id) && !v.IsEmbedded && v.UpdatedAt <= thresholdTime)
                .ToListAsync(stoppingToken);

            foreach (var version in versionsToEmbed)
            {
                if (stoppingToken.IsCancellationRequested) break;

                var chapterInfo = pendingChapters.First(c => c.CurrentVersionId == version.Id);
                
                try
                {
                    if (!version.IsChunked)
                    {
                        _logger.LogInformation("AutoEmbeddingWorker: Chunking trước khi nhúng cho Chapter {ChapterId}", chapterInfo.Id);
                        await chapterService.ChunkVersionAsync(chapterInfo.Id, chapterInfo.AuthorId);
                    }

                    _logger.LogInformation("AutoEmbeddingWorker: Bắt đầu nhúng dữ liệu cho Chapter {ChapterId}", chapterInfo.Id);
                    await embeddingService.EmbedChapterAsync(chapterInfo.Id, chapterInfo.AuthorId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "AutoEmbeddingWorker: Lỗi khi nhúng Chapter {ChapterId}", chapterInfo.Id);
                }
            }
        }
    }
}
