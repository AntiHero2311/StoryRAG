using Repository.Entities;
using System.Security.Cryptography;
using System.Text;

namespace Service.Helpers
{
    public sealed record ProjectAnalysisChapterSnapshot(
        int ChapterNumber,
        Guid? CurrentVersionId,
        int WordCount,
        DateTime? UpdatedAt,
        DateTime? DraftSavedAt,
        bool IsChunked,
        bool IsEmbedded,
        int ChunkCount);

    public static class ProjectAnalysisSnapshotHelper
    {
        public static string BuildProjectVersionHash(Guid projectId, IReadOnlyList<ProjectAnalysisChapterSnapshot> chapters)
        {
            var seedBuilder = new StringBuilder()
                .Append(projectId).Append('|')
                .Append("chapters:").Append(chapters.Count).Append('|');

            foreach (var chapter in chapters.OrderBy(c => c.ChapterNumber))
            {
                seedBuilder
                    .Append(chapter.ChapterNumber).Append(':')
                    .Append(chapter.CurrentVersionId?.ToString() ?? "none").Append(':')
                    .Append(chapter.WordCount).Append(':')
                    .Append(chapter.UpdatedAt?.Ticks ?? 0).Append(':')
                    .Append(chapter.DraftSavedAt?.Ticks ?? 0).Append(':')
                    .Append(chapter.IsChunked ? 1 : 0).Append(':')
                    .Append(chapter.IsEmbedded ? 1 : 0).Append(':')
                    .Append(chapter.ChunkCount)
                    .Append('|');
            }

            var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(seedBuilder.ToString()));
            return Convert.ToHexString(hashBytes);
        }

        public static string BuildProjectVersionLabel(Guid projectId, IReadOnlyList<ProjectAnalysisChapterSnapshot> chapters)
        {
            var hash = BuildProjectVersionHash(projectId, chapters);
            var chunkCount = chapters.Sum(c => c.ChunkCount);
            return $"snapshot:{hash[..12]}|chapters:{chapters.Count}|chunks:{chunkCount}";
        }
    }
}
