using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using DiffPlex;
using DiffPlex.DiffBuilder;
using DiffPlex.DiffBuilder.Model;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;

namespace Service.Implementations
{
    public class ChapterService : IChapterService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IChunkingService _chunkingService;

        public ChapterService(AppDbContext context, IConfiguration config, IChunkingService chunkingService)
        {
            _context = context;
            _config = config;
            _chunkingService = chunkingService;
        }

        // ── Chapter CRUD ───────────────────────────────────────────────────────

        public async Task<List<ChapterResponse>> GetChaptersByProjectAsync(Guid projectId, Guid userId)
        {
            await ValidateProjectOwnershipAsync(projectId, userId);

            var chapters = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .OrderBy(c => c.ChapterNumber)
                .ToListAsync();

            return chapters.Select(MapToResponse).ToList();
        }

        public async Task<ChapterDetailResponse> GetChapterDetailAsync(Guid chapterId, Guid userId)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var versions = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Where(v => v.ChapterId == chapterId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

            string? content = null;
            if (chapter.CurrentVersionId.HasValue)
            {
                var currentVersion = versions.FirstOrDefault(v => v.Id == chapter.CurrentVersionId.Value);
                if (currentVersion != null)
                    content = EncryptionHelper.DecryptWithMasterKey(currentVersion.Content, rawDek);
            }

            var detail = MapToDetailResponse(chapter, content);
            detail.Versions = versions.Select(v => MapToVersionSummary(v, rawDek)).ToList();
            return detail;
        }

        public async Task<ChapterDetailResponse> CreateChapterAsync(Guid projectId, Guid userId, CreateChapterRequest request)
        {
            await ValidateProjectOwnershipAsync(projectId, userId);

            bool exists = await _context.Chapters
                .AnyAsync(c => c.ProjectId == projectId && c.ChapterNumber == request.ChapterNumber && !c.IsDeleted);
            if (exists)
                throw new Exception($"Chương số {request.ChapterNumber} đã tồn tại trong dự án này.");

            var rawDek = await GetRawDekAsync(userId);
            int wordCount = CountWords(request.Content);

            var chapter = new Chapter
            {
                ProjectId = projectId,
                ChapterNumber = request.ChapterNumber,
                Title = request.Title,
                WordCount = wordCount,
                CurrentVersionNum = 1,
            };
            _context.Chapters.Add(chapter);
            await _context.SaveChangesAsync();

            var version = new ChapterVersion
            {
                ChapterId = chapter.Id,
                VersionNumber = 1,
                Title = request.Title != null ? $"Phiên bản 1" : null,
                Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek),
                WordCount = wordCount,
                TokenCount = _chunkingService.EstimateTokenCount(request.Content),
                CreatedBy = userId,
            };
            _context.ChapterVersions.Add(version);
            await _context.SaveChangesAsync();

            chapter.CurrentVersionId = version.Id;
            chapter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var detail = MapToDetailResponse(chapter, request.Content);
            detail.Versions = new List<ChapterVersionSummary> { MapToVersionSummary(version, rawDek) };
            return detail;
        }

        /// <summary>Lưu in-place: cập nhật nội dung + title của version đang active (không tạo version mới).</summary>
        public async Task<ChapterDetailResponse> UpdateChapterAsync(Guid chapterId, Guid userId, UpdateChapterRequest request)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            if (!chapter.CurrentVersionId.HasValue)
                throw new Exception("Chương chưa có version nào. Hãy tạo version mới trước.");

            var version = await _context.ChapterVersions
                .FirstOrDefaultAsync(v => v.Id == chapter.CurrentVersionId.Value)
                ?? throw new Exception("Không tìm thấy version đang active.");

            int wordCount = CountWords(request.Content);

            // Update version content in-place
            version.Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek);
            version.WordCount = wordCount;
            version.TokenCount = _chunkingService.EstimateTokenCount(request.Content);
            version.UpdatedAt = DateTime.UtcNow;
            // Reset chunking flags since content changed
            version.IsChunked = false;
            version.IsEmbedded = false;

            // Update chapter metadata
            if (request.Title != null) chapter.Title = request.Title;
            chapter.WordCount = wordCount;
            chapter.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Reload versions for response
            var versions = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Where(v => v.ChapterId == chapterId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

            var detail = MapToDetailResponse(chapter, request.Content);
            detail.Versions = versions.Select(v => MapToVersionSummary(v, rawDek)).ToList();
            return detail;
        }

        public async Task<ChapterResponse> RenameChapterAsync(Guid chapterId, Guid userId, RenameChapterRequest request)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);
            chapter.Title = request.Title.Trim();
            chapter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return MapToResponse(chapter);
        }

        public async Task DeleteChapterAsync(Guid chapterId, Guid userId)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);
            chapter.IsDeleted = true;
            chapter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        // ── Version management ─────────────────────────────────────────────────

        public async Task<List<ChapterVersionSummary>> GetVersionsAsync(Guid chapterId, Guid userId)
        {
            await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var versions = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Where(v => v.ChapterId == chapterId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

            return versions.Select(v => MapToVersionSummary(v, rawDek)).ToList();
        }

        public async Task<ChapterVersionDetailResponse> GetVersionDetailAsync(Guid chapterId, int versionNumber, Guid userId)
        {
            await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var version = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Include(v => v.Chunks)
                .FirstOrDefaultAsync(v => v.ChapterId == chapterId && v.VersionNumber == versionNumber)
                ?? throw new Exception($"Phiên bản {versionNumber} không tồn tại.");

            return MapToVersionDetailResponse(version, rawDek);
        }

        public async Task<ChapterDetailResponse> CreateNewVersionAsync(Guid chapterId, Guid userId, CreateVersionRequest request)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            int newVersionNum = chapter.CurrentVersionNum + 1;

            // Snapshot current content (copy from active version, not empty)
            string snapshotContent = string.Empty;
            if (chapter.CurrentVersionId.HasValue)
            {
                var currentVer = await _context.ChapterVersions
                    .FirstOrDefaultAsync(v => v.Id == chapter.CurrentVersionId.Value);
                if (currentVer != null)
                    snapshotContent = EncryptionHelper.DecryptWithMasterKey(currentVer.Content, rawDek);
            }

            var version = new ChapterVersion
            {
                ChapterId = chapterId,
                VersionNumber = newVersionNum,
                Title = request.Title ?? $"Phiên bản {newVersionNum}",
                Content = EncryptionHelper.EncryptWithMasterKey(snapshotContent, rawDek),
                WordCount = CountWords(snapshotContent),
                TokenCount = _chunkingService.EstimateTokenCount(snapshotContent),
                CreatedBy = userId,
            };
            _context.ChapterVersions.Add(version);
            await _context.SaveChangesAsync();

            chapter.CurrentVersionId = version.Id;
            chapter.CurrentVersionNum = newVersionNum;
            chapter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Auto-prune: keep max 20 versions, delete oldest non-pinned first
            await PruneVersionsAsync(chapterId, maxVersions: 20);

            var versions = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Where(v => v.ChapterId == chapterId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

            var detail = MapToDetailResponse(chapter, snapshotContent);
            detail.Versions = versions.Select(v => MapToVersionSummary(v, rawDek)).ToList();
            return detail;
        }

        public async Task<ChapterDetailResponse> SetActiveVersionAsync(Guid chapterId, int versionNumber, Guid userId)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var targetVersion = await _context.ChapterVersions
                .FirstOrDefaultAsync(v => v.ChapterId == chapterId && v.VersionNumber == versionNumber)
                ?? throw new Exception($"Phiên bản {versionNumber} không tồn tại.");

            chapter.CurrentVersionId = targetVersion.Id;
            chapter.CurrentVersionNum = versionNumber;
            chapter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            string content = EncryptionHelper.DecryptWithMasterKey(targetVersion.Content, rawDek);

            var versions = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Where(v => v.ChapterId == chapterId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

            var detail = MapToDetailResponse(chapter, content);
            detail.Versions = versions.Select(v => MapToVersionSummary(v, rawDek)).ToList();
            return detail;
        }

        public async Task<ChapterVersionSummary> UpdateVersionTitleAsync(Guid chapterId, int versionNumber, Guid userId, UpdateVersionTitleRequest request)
        {
            await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var version = await _context.ChapterVersions
                .Include(v => v.Creator)
                .FirstOrDefaultAsync(v => v.ChapterId == chapterId && v.VersionNumber == versionNumber)
                ?? throw new Exception($"Phiên bản {versionNumber} không tồn tại.");

            version.Title = request.Title;
            await _context.SaveChangesAsync();

            return MapToVersionSummary(version, rawDek);
        }

        public async Task DeleteVersionAsync(Guid chapterId, int versionNumber, Guid userId)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);

            var allVersions = await _context.ChapterVersions
                .Where(v => v.ChapterId == chapterId)
                .ToListAsync();

            if (allVersions.Count <= 1)
                throw new Exception("Không thể xóa phiên bản duy nhất. Chương phải có ít nhất 1 phiên bản.");

            var targetVersion = allVersions.FirstOrDefault(v => v.VersionNumber == versionNumber)
                ?? throw new Exception($"Phiên bản {versionNumber} không tồn tại.");

            bool isActive = chapter.CurrentVersionId == targetVersion.Id;

            _context.ChapterVersions.Remove(targetVersion);
            await _context.SaveChangesAsync();

            // If deleted the active version, switch to the latest remaining
            if (isActive)
            {
                var remaining = allVersions.Where(v => v.VersionNumber != versionNumber)
                    .OrderByDescending(v => v.VersionNumber).First();
                chapter.CurrentVersionId = remaining.Id;
                chapter.CurrentVersionNum = remaining.VersionNumber;
                chapter.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        // ── Chunking ───────────────────────────────────────────────────────────

        public async Task<ChapterVersionDetailResponse> ChunkVersionAsync(Guid chapterId, Guid userId)
        {
            var chapter = await GetChapterWithOwnerCheckAsync(chapterId, userId);

            if (!chapter.CurrentVersionId.HasValue)
                throw new Exception("Chương chưa có nội dung để chunk.");

            var rawDek = await GetRawDekAsync(userId);

            var version = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Include(v => v.Chunks)
                .FirstOrDefaultAsync(v => v.Id == chapter.CurrentVersionId.Value)
                ?? throw new Exception("Không tìm thấy version hiện tại.");

            _context.ChapterChunks.RemoveRange(version.Chunks);

            string plainContent = EncryptionHelper.DecryptWithMasterKey(version.Content, rawDek);
            var textChunks = _chunkingService.SplitIntoChunks(plainContent);

            var chunkEntities = textChunks.Select((chunkText, idx) => new ChapterChunk
            {
                VersionId = version.Id,
                ProjectId = chapter.ProjectId,
                ChunkIndex = idx,
                Content = EncryptionHelper.EncryptWithMasterKey(chunkText, rawDek),
                TokenCount = _chunkingService.EstimateTokenCount(chunkText),
            }).ToList();

            _context.ChapterChunks.AddRange(chunkEntities);

            version.IsChunked = true;
            await _context.SaveChangesAsync();

            return MapToVersionDetailResponse(version, rawDek, chunkEntities, plainContent);
        }

        // ── Private Helpers ────────────────────────────────────────────────────

        private async Task PruneVersionsAsync(Guid chapterId, int maxVersions = 20)
        {
            var chapter = await _context.Chapters.FindAsync(chapterId);
            var all = await _context.ChapterVersions
                .Where(v => v.ChapterId == chapterId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

            if (all.Count <= maxVersions) return;

            // Candidates: oldest, non-pinned, not the currently active version
            var toDelete = all
                .Where(v => !v.IsPinned && v.Id != chapter?.CurrentVersionId)
                .OrderBy(v => v.VersionNumber)
                .Take(all.Count - maxVersions)
                .ToList();

            if (toDelete.Count == 0) return;

            // Remove chunks belonging to deleted versions
            var deleteIds = toDelete.Select(v => v.Id).ToList();
            var chunks = await _context.ChapterChunks
                .Where(c => deleteIds.Contains(c.VersionId))
                .ToListAsync();
            _context.ChapterChunks.RemoveRange(chunks);

            _context.ChapterVersions.RemoveRange(toDelete);
            await _context.SaveChangesAsync();
        }

        public async Task<ChapterVersionSummary> TogglePinVersionAsync(Guid chapterId, int versionNumber, Guid userId)
        {
            await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var version = await _context.ChapterVersions
                .Include(v => v.Creator)
                .FirstOrDefaultAsync(v => v.ChapterId == chapterId && v.VersionNumber == versionNumber)
                ?? throw new Exception($"Phiên bản {versionNumber} không tồn tại.");

            version.IsPinned = !version.IsPinned;
            await _context.SaveChangesAsync();

            return MapToVersionSummary(version, rawDek);
        }

        public async Task<string> GetVersionContentAsync(Guid chapterId, int versionNumber, Guid userId)
        {
            await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var version = await _context.ChapterVersions
                .FirstOrDefaultAsync(v => v.ChapterId == chapterId && v.VersionNumber == versionNumber)
                ?? throw new Exception($"Phiên bản {versionNumber} không tồn tại.");

            return EncryptionHelper.DecryptWithMasterKey(version.Content, rawDek);
        }

        public async Task<ChapterVersionDiffResponse> CompareVersionsAsync(Guid chapterId, int fromVersionNumber, int toVersionNumber, Guid userId)
        {
            if (fromVersionNumber <= 0 || toVersionNumber <= 0)
                throw new Exception("Số phiên bản phải lớn hơn 0.");

            await GetChapterWithOwnerCheckAsync(chapterId, userId);
            var rawDek = await GetRawDekAsync(userId);

            var versions = await _context.ChapterVersions
                .Where(v => v.ChapterId == chapterId &&
                           (v.VersionNumber == fromVersionNumber || v.VersionNumber == toVersionNumber))
                .ToListAsync();

            var fromVersion = versions.FirstOrDefault(v => v.VersionNumber == fromVersionNumber)
                ?? throw new Exception($"Phiên bản {fromVersionNumber} không tồn tại.");
            var toVersion = versions.FirstOrDefault(v => v.VersionNumber == toVersionNumber)
                ?? throw new Exception($"Phiên bản {toVersionNumber} không tồn tại.");

            var fromContent = EncryptionHelper.DecryptWithMasterKey(fromVersion.Content, rawDek);
            var toContent = EncryptionHelper.DecryptWithMasterKey(toVersion.Content, rawDek);

            var diffResult = BuildUnifiedDiff(fromContent, toContent, fromVersionNumber, toVersionNumber);

            return new ChapterVersionDiffResponse
            {
                FromVersionNumber = fromVersionNumber,
                ToVersionNumber = toVersionNumber,
                AddedLines = diffResult.AddedLines,
                RemovedLines = diffResult.RemovedLines,
                UnchangedLines = diffResult.UnchangedLines,
                HasChanges = diffResult.AddedLines > 0 || diffResult.RemovedLines > 0,
                UnifiedDiff = diffResult.UnifiedDiff,
            };
        }

        public async Task<ManuscriptImportResponse> ImportManuscriptAsync(
            Guid projectId,
            Guid userId,
            string fileName,
            string? contentType,
            byte[] fileBytes,
            bool splitByHeadings = true)
        {
            if (fileBytes.Length == 0)
                throw new Exception("File import rỗng.");

            await ValidateProjectOwnershipAsync(projectId, userId);

            var (detectedFormat, extractedText) = ExtractManuscriptText(fileName, contentType, fileBytes);
            if (string.IsNullOrWhiteSpace(extractedText))
                throw new Exception("Không trích xuất được nội dung từ file.");

            var chapterParts = SplitIntoChapterParts(extractedText, splitByHeadings);
            if (chapterParts.Count == 0)
                throw new Exception("Không tìm thấy nội dung chương hợp lệ để import.");

            var currentMaxChapterNumber = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .MaxAsync(c => (int?)c.ChapterNumber) ?? 0;

            var startingChapterNumber = currentMaxChapterNumber + 1;
            var importedChapters = new List<ImportedChapterSummary>();

            foreach (var part in chapterParts)
            {
                currentMaxChapterNumber++;
                var defaultTitle = $"Imported Chapter {currentMaxChapterNumber}";
                var title = string.IsNullOrWhiteSpace(part.Title) ? defaultTitle : part.Title.Trim();
                if (title.Length > 255) title = title[..255];

                var created = await CreateChapterAsync(projectId, userId, new CreateChapterRequest
                {
                    ChapterNumber = currentMaxChapterNumber,
                    Title = title,
                    Content = part.Content,
                });

                importedChapters.Add(new ImportedChapterSummary
                {
                    ChapterId = created.Id,
                    ChapterNumber = created.ChapterNumber,
                    Title = created.Title,
                    WordCount = created.WordCount,
                });
            }

            return new ManuscriptImportResponse
            {
                SourceFileName = fileName,
                DetectedFormat = detectedFormat,
                StartingChapterNumber = startingChapterNumber,
                ImportedChapterCount = importedChapters.Count,
                ImportedChapters = importedChapters,
            };
        }

        private async Task ValidateProjectOwnershipAsync(Guid projectId, Guid userId)
        {
            bool projectExists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && p.AuthorId == userId && !p.IsDeleted);
            if (!projectExists)
                throw new Exception("Không tìm thấy dự án.");
        }

        private async Task<Chapter> GetChapterWithOwnerCheckAsync(Guid chapterId, Guid userId)
        {
            var chapter = await _context.Chapters
                .Include(c => c.Project)
                .FirstOrDefaultAsync(c => c.Id == chapterId && !c.IsDeleted)
                ?? throw new Exception("Không tìm thấy chương.");

            if (chapter.Project.AuthorId != userId)
                throw new UnauthorizedAccessException("Bạn không có quyền truy cập chương này.");

            return chapter;
        }

        private async Task<string> GetRawDekAsync(Guid userId)
        {
            var user = await _context.Users.FindAsync(userId)
                ?? throw new Exception("Người dùng không tồn tại.");

            if (string.IsNullOrEmpty(user.DataEncryptionKey))
                throw new Exception("Khóa mã hóa người dùng chưa được thiết lập.");

            string masterKey = _config["Security:MasterKey"]
                ?? throw new Exception("MasterKey không tìm thấy trong cấu hình.");

            return EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey, masterKey);
        }

        private static int CountWords(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            return text.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length;
        }

        private sealed class ManuscriptChapterPart
        {
            public string? Title { get; init; }
            public string Content { get; init; } = string.Empty;
        }

        private static (string DetectedFormat, string Text) ExtractManuscriptText(string fileName, string? contentType, byte[] fileBytes)
        {
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            var detectedFormat = extension switch
            {
                ".txt" => "txt",
                ".docx" => "docx",
                ".pdf" => "pdf",
                _ when !string.IsNullOrWhiteSpace(contentType) && contentType.Contains("pdf", StringComparison.OrdinalIgnoreCase) => "pdf",
                _ when !string.IsNullOrWhiteSpace(contentType) && contentType.Contains("wordprocessingml", StringComparison.OrdinalIgnoreCase) => "docx",
                _ when !string.IsNullOrWhiteSpace(contentType) && contentType.Contains("text/plain", StringComparison.OrdinalIgnoreCase) => "txt",
                _ => throw new Exception("Định dạng file không được hỗ trợ. Chỉ hỗ trợ .txt, .docx, .pdf."),
            };

            var text = detectedFormat switch
            {
                "txt" => Encoding.UTF8.GetString(fileBytes),
                "docx" => ExtractDocxText(fileBytes),
                "pdf" => ExtractPdfText(fileBytes),
                _ => string.Empty,
            };

            return (detectedFormat, NormalizeImportedText(text));
        }

        private static string ExtractDocxText(byte[] fileBytes)
        {
            using var stream = new MemoryStream(fileBytes);
            using var document = WordprocessingDocument.Open(stream, false);
            var body = document.MainDocumentPart?.Document?.Body;
            if (body == null) return string.Empty;

            var paragraphs = body
                .Descendants<Paragraph>()
                .Select(p => p.InnerText?.Trim())
                .Where(p => !string.IsNullOrWhiteSpace(p));

            return string.Join("\n\n", paragraphs!);
        }

        private static string ExtractPdfText(byte[] fileBytes)
        {
            using var stream = new MemoryStream(fileBytes);
            using var document = PdfDocument.Open(stream);
            var builder = new StringBuilder();

            foreach (var page in document.GetPages())
            {
                if (string.IsNullOrWhiteSpace(page.Text)) continue;
                builder.AppendLine(page.Text.Trim());
                builder.AppendLine();
            }

            return builder.ToString().Trim();
        }

        private static string NormalizeImportedText(string rawText)
        {
            if (string.IsNullOrWhiteSpace(rawText))
                return string.Empty;

            var normalized = rawText
                .Replace("\uFEFF", string.Empty)
                .Replace("\r\n", "\n")
                .Replace('\r', '\n');

            if (LooksLikeClipboardHtml(normalized))
                normalized = ConvertHtmlToPlainText(normalized);

            normalized = StripControlCharacters(normalized);
            normalized = Regex.Replace(normalized, @"\n{3,}", "\n\n");

            return normalized.Trim();
        }

        private static bool LooksLikeClipboardHtml(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return false;

            if (!text.Contains('<') || !text.Contains('>'))
                return false;

            return text.Contains("<!--StartFragment", StringComparison.OrdinalIgnoreCase)
                || text.Contains("<!--EndFragment", StringComparison.OrdinalIgnoreCase)
                || text.Contains("docs-internal-guid", StringComparison.OrdinalIgnoreCase)
                || Regex.IsMatch(text, @"(?is)<\s*(span|div|p|h[1-6]|br|meta|style|script)\b");
        }

        private static string ConvertHtmlToPlainText(string html)
        {
            if (string.IsNullOrWhiteSpace(html))
                return string.Empty;

            var text = Regex.Replace(html, @"(?is)<!--.*?-->", string.Empty);
            text = Regex.Replace(text, @"(?is)<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>", string.Empty);
            text = Regex.Replace(text, @"(?is)<\s*br\s*/?\s*>", "\n");
            text = Regex.Replace(text, @"(?is)</\s*(p|div|h[1-6]|li|tr|section|article)\s*>", "\n");
            text = Regex.Replace(text, @"(?is)<\s*li[^>]*>", "- ");
            text = Regex.Replace(text, @"(?is)<[^>]+>", string.Empty);
            text = WebUtility.HtmlDecode(text).Replace('\u00A0', ' ');

            return text;
        }

        private static string StripControlCharacters(string text)
        {
            var builder = new StringBuilder(text.Length);
            foreach (var ch in text)
            {
                if (!char.IsControl(ch) || ch is '\n' or '\t')
                    builder.Append(ch);
            }

            return builder.ToString();
        }

        private static List<ManuscriptChapterPart> SplitIntoChapterParts(string extractedText, bool splitByHeadings)
        {
            var normalized = extractedText
                .Replace("\r\n", "\n")
                .Replace('\r', '\n')
                .Normalize(NormalizationForm.FormC)
                .Trim();

            if (string.IsNullOrWhiteSpace(normalized))
                return new List<ManuscriptChapterPart>();

            if (!splitByHeadings)
            {
                return new List<ManuscriptChapterPart>
                {
                    new() { Content = normalized }
                };
            }

            var chapterHeadingRegex = new Regex(
                @"(?im)^\s*(chapter|ch(?:u|ư)(?:o|ơ)ng)\s+([0-9ivxlcdm]+)\b(?:[^\n]*)$",
                RegexOptions.Compiled);

            var matches = chapterHeadingRegex.Matches(normalized);
            if (matches.Count == 0)
            {
                return new List<ManuscriptChapterPart>
                {
                    new() { Content = normalized }
                };
            }

            var chapterParts = new List<ManuscriptChapterPart>();
            for (var i = 0; i < matches.Count; i++)
            {
                var currentMatch = matches[i];
                var contentStart = currentMatch.Index + currentMatch.Length;
                if (contentStart < normalized.Length && normalized[contentStart] == '\n')
                    contentStart++;

                var contentEnd = i + 1 < matches.Count ? matches[i + 1].Index : normalized.Length;
                if (contentStart >= contentEnd) continue;

                var content = normalized[contentStart..contentEnd].Trim();
                if (string.IsNullOrWhiteSpace(content)) continue;

                var headingTitle = currentMatch.Value.Trim();
                if (headingTitle.Length > 255) headingTitle = headingTitle[..255];

                chapterParts.Add(new ManuscriptChapterPart
                {
                    Title = headingTitle,
                    Content = content,
                });
            }

            if (chapterParts.Count == 0)
            {
                chapterParts.Add(new ManuscriptChapterPart
                {
                    Content = normalized,
                });
            }

            return chapterParts;
        }

        private static (string UnifiedDiff, int AddedLines, int RemovedLines, int UnchangedLines) BuildUnifiedDiff(
            string oldContent,
            string newContent,
            int fromVersionNumber,
            int toVersionNumber)
        {
            var diffBuilder = new SideBySideDiffBuilder(new Differ());
            var diffModel = diffBuilder.BuildDiffModel(oldContent ?? string.Empty, newContent ?? string.Empty);

            var output = new List<string>
            {
                $"--- version {fromVersionNumber}",
                $"+++ version {toVersionNumber}",
                $"@@ -1,{Math.Max(1, diffModel.OldText.Lines.Count)} +1,{Math.Max(1, diffModel.NewText.Lines.Count)} @@",
            };

            var added = 0;
            var removed = 0;
            var unchanged = 0;
            var lineCount = Math.Max(diffModel.OldText.Lines.Count, diffModel.NewText.Lines.Count);

            for (var i = 0; i < lineCount; i++)
            {
                var oldLine = i < diffModel.OldText.Lines.Count ? diffModel.OldText.Lines[i] : null;
                var newLine = i < diffModel.NewText.Lines.Count ? diffModel.NewText.Lines[i] : null;

                if (oldLine?.Type == ChangeType.Unchanged && newLine?.Type == ChangeType.Unchanged)
                {
                    output.Add($" {(oldLine.Text ?? string.Empty)}");
                    unchanged++;
                    continue;
                }

                if (oldLine != null && oldLine.Type is ChangeType.Deleted or ChangeType.Modified)
                {
                    output.Add($"-{oldLine.Text ?? string.Empty}");
                    removed++;
                }

                if (newLine != null && newLine.Type is ChangeType.Inserted or ChangeType.Modified)
                {
                    output.Add($"+{newLine.Text ?? string.Empty}");
                    added++;
                }
            }

            return (string.Join('\n', output), added, removed, unchanged);
        }

        // ── Mappers ────────────────────────────────────────────────────────────

        private static ChapterResponse MapToResponse(Chapter chapter) => new()
        {
            Id = chapter.Id,
            ProjectId = chapter.ProjectId,
            ChapterNumber = chapter.ChapterNumber,
            Title = chapter.Title,
            WordCount = chapter.WordCount,
            Status = chapter.Status,
            CurrentVersionNum = chapter.CurrentVersionNum,
            CurrentVersionId = chapter.CurrentVersionId,
            CreatedAt = chapter.CreatedAt,
            UpdatedAt = chapter.UpdatedAt,
        };

        private static ChapterDetailResponse MapToDetailResponse(Chapter chapter, string? plainContent) => new()
        {
            Id = chapter.Id,
            ProjectId = chapter.ProjectId,
            ChapterNumber = chapter.ChapterNumber,
            Title = chapter.Title,
            WordCount = chapter.WordCount,
            Status = chapter.Status,
            CurrentVersionNum = chapter.CurrentVersionNum,
            CurrentVersionId = chapter.CurrentVersionId,
            CreatedAt = chapter.CreatedAt,
            UpdatedAt = chapter.UpdatedAt,
            Content = plainContent,
        };

        private static ChapterVersionSummary MapToVersionSummary(ChapterVersion v, string rawDek) => new()
        {
            Id = v.Id,
            VersionNumber = v.VersionNumber,
            Title = v.Title,
            WordCount = v.WordCount,
            TokenCount = v.TokenCount,
            IsChunked = v.IsChunked,
            IsEmbedded = v.IsEmbedded,
            IsPinned = v.IsPinned,
            CreatedAt = v.CreatedAt,
            UpdatedAt = v.UpdatedAt,
            CreatedByName = v.Creator?.FullName ?? "Unknown",
        };

        private static ChapterVersionDetailResponse MapToVersionDetailResponse(
            ChapterVersion v, string rawDek,
            List<ChapterChunk>? chunks = null, string? plainContent = null) => new()
        {
            Id = v.Id,
            VersionNumber = v.VersionNumber,
            Title = v.Title,
            WordCount = v.WordCount,
            TokenCount = v.TokenCount,
            IsChunked = v.IsChunked,
            IsEmbedded = v.IsEmbedded,
            IsPinned = v.IsPinned,
            CreatedAt = v.CreatedAt,
            UpdatedAt = v.UpdatedAt,
            CreatedByName = v.Creator?.FullName ?? "Unknown",
            Content = plainContent ?? (string.IsNullOrEmpty(v.Content)
                ? string.Empty
                : EncryptionHelper.DecryptWithMasterKey(v.Content, rawDek)),
            Chunks = (chunks ?? v.Chunks.ToList()).Select((ch, _) => new ChapterChunkResponse
            {
                Id = ch.Id,
                ChunkIndex = ch.ChunkIndex,
                Content = EncryptionHelper.DecryptWithMasterKey(ch.Content, rawDek),
                TokenCount = ch.TokenCount,
                HasEmbedding = ch.Embedding != null,
            }).OrderBy(c => c.ChunkIndex).ToList(),
        };
    }
}
