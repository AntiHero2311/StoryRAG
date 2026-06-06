using Microsoft.EntityFrameworkCore;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;

namespace Service.Implementations
{
    /// <summary>
    /// Phần triển khai trích xuất và giải mã bằng chứng (evidence chunks) của dịch vụ phân tích truyện.
    /// </summary>
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
            string? highlight = null,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var guidIds = ParseGuidCsv(ids);
            var ordinalInts = ParseIntCsv(ordinals);

            const int maxChunks = 15; // Tăng lên 15 để hiển thị thoải mái
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

            // Giải mã toàn bộ plaintext của tất cả các chunk trong truyện để phục vụ tìm kiếm chính xác và mở rộng ngữ cảnh
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

            var pickOrdinal = new SortedSet<int>();
            
            // 1. Quét tìm kiếm chính xác (Literal Highlight Match) để khắc phục lỗi AI định vị sai chương/ordinal
            var cleanHighlight = highlight?.Trim();
            if (!string.IsNullOrEmpty(cleanHighlight) && cleanHighlight.Length >= 5)
            {
                var subHighlights = cleanHighlight
                    .Split(new[] { "...", "..", "\n", "…" }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(q => q.Trim().Trim('"', '\'', '“', '”', '«', '»'))
                    .Where(q => q.Length >= 5)
                    .ToList();

                if (subHighlights.Count > 0)
                {
                    for (var i = 0; i < ordered.Count; i++)
                    {
                        var normPlain = NormalizeForMatching(plains[i]);
                        bool matchesAny = false;
                        foreach (var sub in subHighlights)
                        {
                            var normSub = NormalizeForMatching(sub);
                            if (normSub.Length >= 5 && normPlain.Contains(normSub))
                            {
                                matchesAny = true;
                                break;
                            }
                        }

                        if (matchesAny)
                        {
                            pickOrdinal.Add(i);
                            continue;
                        }

                        // Kiểm tra xem trích dẫn có khớp do bị cắt ngang giữa 2 chunk liên tiếp trong cùng chương không
                        if (i < ordered.Count - 1 && ordered[i].Chunk.VersionId == ordered[i + 1].Chunk.VersionId)
                        {
                            var combined = plains[i] + plains[i + 1];
                            var normCombined = NormalizeForMatching(combined);
                            bool matchesCombined = false;
                            foreach (var sub in subHighlights)
                            {
                                var normSub = NormalizeForMatching(sub);
                                if (normSub.Length >= 5 && normCombined.Contains(normSub))
                                {
                                    matchesCombined = true;
                                    break;
                                }
                            }
                            if (matchesCombined)
                            {
                                pickOrdinal.Add(i);
                                pickOrdinal.Add(i + 1);
                            }
                        }
                    }
                }
            }

            // 2. Thêm các ordinal được truyền từ API (do AI chấm ban đầu)
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

            // Giới hạn tối đa số lượng hiển thị để bảo vệ performance
            while (pickOrdinal.Count > maxChunks)
                pickOrdinal.Remove(pickOrdinal.Max);

            // Loại bỏ các chunk bị trùng lặp ngữ cảnh (nếu n và n+1 cùng chương, thì n+1 đã nằm trong phần mở rộng của n)
            var deduplicatedOrdinals = new List<int>();
            foreach (var ord in pickOrdinal)
            {
                if (deduplicatedOrdinals.Count > 0)
                {
                    var last = deduplicatedOrdinals[^1];
                    if (ord == last + 1 && ordered[ord].Chunk.VersionId == ordered[last].Chunk.VersionId)
                    {
                        // Bỏ qua ord vì toàn bộ nội dung của nó đã nằm trong phần mở rộng (Context Expansion) của last
                        continue;
                    }
                }
                deduplicatedOrdinals.Add(ord);
            }

            var result = new List<EvidenceChunkItemDto>(deduplicatedOrdinals.Count);
            foreach (var ord in deduplicatedOrdinals)
            {
                var (chunk, chNum, chTitle) = ordered[ord];
                var titleDisplay = string.IsNullOrWhiteSpace(chTitle)
                    ? $"Chương {chNum}"
                    : $"Chương {chNum}: {chTitle}";

                // 3. Thực hiện Context Expansion: tự động ghép chunk liền trước và chunk liền sau (cùng chương & phiên bản)
                var hasPrev = ord - 1 >= 0 && ordered[ord - 1].Chunk.VersionId == chunk.VersionId;
                var hasNext = ord + 1 < ordered.Count && ordered[ord + 1].Chunk.VersionId == chunk.VersionId;

                var prevText = hasPrev ? plains[ord - 1] : string.Empty;
                var nextText = hasNext ? plains[ord + 1] : string.Empty;

                var expandedContent = prevText + plains[ord] + nextText;
                
                // Tính toán chính xác vị trí ký tự bắt đầu của block ngữ cảnh mở rộng trong chương
                var startOffset = hasPrev
                    ? offsetsByChunkId.GetValueOrDefault(ordered[ord - 1].Chunk.Id, 0)
                    : offsetsByChunkId.GetValueOrDefault(chunk.Id, 0);

                result.Add(new EvidenceChunkItemDto
                {
                    ChunkId = chunk.Id,
                    Ordinal = ord,
                    ChapterNumber = chNum,
                    ChapterTitle = titleDisplay,
                    ChunkIndex = chunk.ChunkIndex,
                    OffsetInChapterChars = startOffset,
                    Content = expandedContent,
                    TokenCount = chunk.TokenCount + (hasPrev ? ordered[ord - 1].Chunk.TokenCount : 0) + (hasNext ? ordered[ord + 1].Chunk.TokenCount : 0),
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
