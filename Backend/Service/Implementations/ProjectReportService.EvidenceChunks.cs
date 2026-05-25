using Microsoft.EntityFrameworkCore;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;

namespace Service.Implementations
{
    public partial class ProjectReportService
    {
        /// <summary>
        /// Thứ tự chunk phẳng: chương tăng dần, trong chương theo ChunkIndex — khớp ordinal lưu trong ReportItem.
        /// </summary>
        private static List<(ChapterChunk Chunk, int ChapterNumber, string? ChapterTitle)> OrderChunksByChapter(
            IReadOnlyList<Chapter> chapters,
            List<ChapterChunk> chunks)
        {
            var versionToChapter = chapters
                .Where(c => c.CurrentVersionId.HasValue)
                .ToDictionary(c => c.CurrentVersionId!.Value, c => (c.ChapterNumber, c.Title));

            return chunks
                .Where(c => versionToChapter.ContainsKey(c.VersionId))
                .OrderBy(c => versionToChapter[c.VersionId].ChapterNumber)
                .ThenBy(c => c.ChunkIndex)
                .Select(c =>
                {
                    var vc = versionToChapter[c.VersionId];
                    return (c, vc.ChapterNumber, vc.Title);
                })
                .ToList();
        }

        public async Task<List<EvidenceChunkItemDto>> GetProjectEvidenceChunksAsync(
            Guid projectId,
            Guid userId,
            string? ids,
            string? ordinals,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var guidIds = ParseGuidCsv(ids);
            var ordinalInts = ParseIntCsv(ordinals);

            if (guidIds.Count == 0 && ordinalInts.Count == 0)
                throw new ArgumentException("Cần ít nhất một tham số ids hoặc ordinals hợp lệ.");

            const int maxChunks = 10; // Giảm từ 20 để tránh quá tải xử lý
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");
            var masterKey = _config["Security:MasterKey"]!;
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);

            var chapters = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .ToListAsync(cancellationToken);

            var activeVersionIds = chapters
                .Where(c => c.CurrentVersionId.HasValue)
                .Select(c => c.CurrentVersionId!.Value)
                .ToList();

            var chunksRaw = await _context.ChapterChunks
                .Where(c => c.ProjectId == projectId && c.Embedding != null && activeVersionIds.Contains(c.VersionId))
                .ToListAsync(cancellationToken);

            var ordered = OrderChunksByChapter(chapters, chunksRaw);
            if (ordered.Count == 0)
                return new List<EvidenceChunkItemDto>();

            var pickOrdinal = new SortedSet<int>();
            foreach (var o in ordinalInts)
            {
                if (o >= 0 && o < ordered.Count)
                    pickOrdinal.Add(o);
            }

            foreach (var g in guidIds)
            {
                for (var i = 0; i < ordered.Count; i++)
                {
                    if (ordered[i].Chunk.Id == g)
                    {
                        pickOrdinal.Add(i);
                        break;
                    }
                }
            }

            while (pickOrdinal.Count > maxChunks)
                pickOrdinal.Remove(pickOrdinal.Max);

            var plains = new string[ordered.Count];
            var offsetsByChunkId = new Dictionary<Guid, int>();
            var cumByChapter = new Dictionary<int, int>();
            for (var i = 0; i < ordered.Count; i++)
            {
                var (chunk, chNum, _) = ordered[i];
                if (!cumByChapter.TryGetValue(chNum, out var off))
                    off = 0;
                offsetsByChunkId[chunk.Id] = off;
                var plain = EncryptionHelper.DecryptWithMasterKey(chunk.Content, rawDek);
                plains[i] = plain;
                cumByChapter[chNum] = off + plain.Length;
            }

            var result = new List<EvidenceChunkItemDto>(pickOrdinal.Count);
            foreach (var ord in pickOrdinal)
            {
                var (chunk, chNum, chTitle) = ordered[ord];
                var titleDisplay = string.IsNullOrWhiteSpace(chTitle)
                    ? $"Chương {chNum}"
                    : $"Chương {chNum}: {chTitle}";

                result.Add(new EvidenceChunkItemDto
                {
                    ChunkId = chunk.Id,
                    Ordinal = ord,
                    ChapterNumber = chNum,
                    ChapterTitle = titleDisplay,
                    ChunkIndex = chunk.ChunkIndex,
                    OffsetInChapterChars = offsetsByChunkId.GetValueOrDefault(chunk.Id, 0),
                    Content = plains[ord],
                    TokenCount = chunk.TokenCount,
                });
            }

            return result;
        }

        private static List<Guid> ParseGuidCsv(string? csv)
        {
            if (string.IsNullOrWhiteSpace(csv))
                return new List<Guid>();

            var list = new List<Guid>();
            foreach (var part in csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (Guid.TryParse(part, out var g))
                    list.Add(g);
            }

            return list;
        }

        private static List<int> ParseIntCsv(string? csv)
        {
            if (string.IsNullOrWhiteSpace(csv))
                return new List<int>();

            var list = new List<int>();
            foreach (var part in csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (int.TryParse(part, out var n))
                    list.Add(n);
            }

            return list;
        }
    }
}
