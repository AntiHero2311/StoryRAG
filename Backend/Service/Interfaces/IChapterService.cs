using Service.DTOs;

namespace Service.Interfaces
{
    public interface IChapterService
    {
        // ── Chapter CRUD ───────────────────────────────────────────────────────
        Task<List<ChapterResponse>> GetChaptersByProjectAsync(Guid projectId, Guid userId);
        Task<ChapterDetailResponse> GetChapterDetailAsync(Guid chapterId, Guid userId);
        Task<ChapterDetailResponse> CreateChapterAsync(Guid projectId, Guid userId, CreateChapterRequest request);
        Task<ChapterDetailResponse> UpdateChapterAsync(Guid chapterId, Guid userId, UpdateChapterRequest request);
        Task DeleteChapterAsync(Guid chapterId, Guid userId);

        // ── Version management ─────────────────────────────────────────────────
        Task<List<ChapterVersionSummary>> GetVersionsAsync(Guid chapterId, Guid userId);
        Task<ChapterVersionDetailResponse> GetVersionDetailAsync(Guid chapterId, int versionNumber, Guid userId);
        Task<ChapterDetailResponse> SaveNewVersionAsync(Guid chapterId, Guid userId, SaveNewVersionRequest request);
        Task<ChapterDetailResponse> RestoreVersionAsync(Guid chapterId, int versionNumber, Guid userId);

        // ── Chunking ───────────────────────────────────────────────────────────
        Task<ChapterVersionDetailResponse> ChunkVersionAsync(Guid chapterId, Guid userId);
    }
}
