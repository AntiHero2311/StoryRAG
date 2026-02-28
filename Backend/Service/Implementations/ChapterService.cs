using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;

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

            var version = new ChapterVersion
            {
                ChapterId = chapterId,
                VersionNumber = newVersionNum,
                Title = request.Title ?? $"Phiên bản {newVersionNum}",
                Content = EncryptionHelper.EncryptWithMasterKey(string.Empty, rawDek),
                WordCount = 0,
                TokenCount = 0,
                CreatedBy = userId,
            };
            _context.ChapterVersions.Add(version);
            await _context.SaveChangesAsync();

            chapter.CurrentVersionId = version.Id;
            chapter.CurrentVersionNum = newVersionNum;
            chapter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var versions = await _context.ChapterVersions
                .Include(v => v.Creator)
                .Where(v => v.ChapterId == chapterId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

            var detail = MapToDetailResponse(chapter, string.Empty);
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
