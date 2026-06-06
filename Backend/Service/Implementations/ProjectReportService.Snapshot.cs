using Microsoft.EntityFrameworkCore;
using Repository.Entities;
using Service.Helpers;

namespace Service.Implementations
{
    /// <summary>
    /// Phần triển khai chụp snapshot nội dung chương truyện phục vụ lưu trữ báo cáo.
    /// </summary>
    public partial class ProjectReportService
    {
        private sealed record ProjectAnalysisSnapshotResult(
            IReadOnlyList<Guid> ActiveVersionIds,
            IReadOnlyList<ProjectAnalysisChapterSnapshot> Chapters,
            string ProjectVersionHash,
            string ProjectVersionLabel);

        private async Task<ProjectAnalysisSnapshotResult> EnsureProjectAnalysisSnapshotAsync(
            Guid projectId,
            Guid userId,
            IReadOnlyList<Chapter> chapters,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            var snapshot = await LoadProjectAnalysisSnapshotAsync(projectId, chapters, cancellationToken);
            var activeChapters = chapters
                .Where(c => c.CurrentVersionId.HasValue)
                .OrderBy(c => c.ChapterNumber)
                .ToList();

            if (activeChapters.Count == 0)
                return snapshot;

            var pendingRepair = snapshot.Chapters
                .Where(c => !c.IsChunked || !c.IsEmbedded)
                .ToList();

            if (pendingRepair.Count == 0)
                return snapshot;

            for (var i = 0; i < activeChapters.Count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var chapter = activeChapters[i];
                var state = snapshot.Chapters.FirstOrDefault(c => c.ChapterNumber == chapter.ChapterNumber);
                if (state == null)
                    continue;

                var progress = 20 + Math.Clamp((int)Math.Round(((i + 1d) / activeChapters.Count) * 12d), 1, 12);

                if (!state.IsChunked)
                {
                    if (progressCallback != null)
                        await progressCallback(progress, $"Chap {chapter.ChapterNumber} chưa chunk. AI đang chunk lại chap {chapter.ChapterNumber}...", cancellationToken);

                    await _chapterService.ChunkVersionAsync(chapter.Id, userId);
                }

                var needsEmbed = !state.IsEmbedded || !state.IsChunked;
                if (needsEmbed)
                {
                    if (progressCallback != null)
                        await progressCallback(progress, $"Chap {chapter.ChapterNumber} chưa embed. AI đang embed lại chap {chapter.ChapterNumber}...", cancellationToken);

                    await _embeddingService.EmbedChapterAsync(chapter.Id, userId);
                }
            }

            snapshot = await LoadProjectAnalysisSnapshotAsync(projectId, chapters, cancellationToken);
            var notReady = snapshot.Chapters.Where(c => !c.IsChunked || !c.IsEmbedded).ToList();
            if (notReady.Count > 0)
            {
                var missing = string.Join(", ", notReady.Select(c => $"chương {c.ChapterNumber}"));
                throw new InvalidOperationException($"Không thể tự động chuẩn bị embed cho {missing}. Vui lòng chunk/embed lại trước khi phân tích.");
            }

            return snapshot;
        }

        private async Task<ProjectAnalysisSnapshotResult> LoadProjectAnalysisSnapshotAsync(
            Guid projectId,
            IReadOnlyList<Chapter> chapters,
            CancellationToken cancellationToken)
        {
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
                        v.IsChunked,
                        v.IsEmbedded,
                        ChunkCount = v.Chunks.Count,
                    })
                    .ToListAsync(cancellationToken);

            var stateByVersionId = versionStates.ToDictionary(v => v.Id);
            var snapshots = chapters
                .OrderBy(c => c.ChapterNumber)
                .Select(chapter =>
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
                })
                .ToList();

            var hash = ProjectAnalysisSnapshotHelper.BuildProjectVersionHash(projectId, snapshots);
            return new ProjectAnalysisSnapshotResult(
                activeVersionIds,
                snapshots,
                hash,
                ProjectAnalysisSnapshotHelper.BuildProjectVersionLabel(projectId, snapshots));
        }

        private async Task<string> ResolveProjectVersionHashAsync(Guid reportId, CancellationToken cancellationToken)
        {
            var hash = await _context.ProjectAnalysisJobs
                .AsNoTracking()
                .Where(j => j.ReportId == reportId && !string.IsNullOrWhiteSpace(j.ProjectVersionHash))
                .OrderByDescending(j => j.CreatedAt)
                .Select(j => j.ProjectVersionHash)
                .FirstOrDefaultAsync(cancellationToken);

            return hash ?? string.Empty;
        }
    }
}
