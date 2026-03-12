using Service.DTOs;

namespace Service.Interfaces
{
    public interface IChapterService
    {
        // ── Chapter CRUD ───────────────────────────────────────────────────────
        Task<List<ChapterResponse>> GetChaptersByProjectAsync(Guid projectId, Guid userId);
        Task<ChapterDetailResponse> GetChapterDetailAsync(Guid chapterId, Guid userId);
        Task<ChapterDetailResponse> CreateChapterAsync(Guid projectId, Guid userId, CreateChapterRequest request);

        /// <summary>Lưu in-place: cập nhật nội dung + title của version đang active (không tạo version mới).</summary>
        Task<ChapterDetailResponse> UpdateChapterAsync(Guid chapterId, Guid userId, UpdateChapterRequest request);

        /// <summary>Đổi tên chương (chỉ title, không ảnh hưởng content hay version).</summary>
        Task<ChapterResponse> RenameChapterAsync(Guid chapterId, Guid userId, RenameChapterRequest request);

        Task DeleteChapterAsync(Guid chapterId, Guid userId);

        // ── Version management ─────────────────────────────────────────────────
        Task<List<ChapterVersionSummary>> GetVersionsAsync(Guid chapterId, Guid userId);
        Task<ChapterVersionDetailResponse> GetVersionDetailAsync(Guid chapterId, int versionNumber, Guid userId);

        /// <summary>Tạo version trống mới (do người dùng chủ ý), set làm active.</summary>
        Task<ChapterDetailResponse> CreateNewVersionAsync(Guid chapterId, Guid userId, CreateVersionRequest request);

        /// <summary>Chuyển sang version khác (set CurrentVersionId).</summary>
        Task<ChapterDetailResponse> SetActiveVersionAsync(Guid chapterId, int versionNumber, Guid userId);

        /// <summary>Đổi tên version.</summary>
        Task<ChapterVersionSummary> UpdateVersionTitleAsync(Guid chapterId, int versionNumber, Guid userId, UpdateVersionTitleRequest request);

        /// <summary>Xóa version (chỉ khi chapter có ≥2 version).</summary>
        Task DeleteVersionAsync(Guid chapterId, int versionNumber, Guid userId);

        /// <summary>Toggle ghim version — version ghim không bị xóa tự động.</summary>
        Task<ChapterVersionSummary> TogglePinVersionAsync(Guid chapterId, int versionNumber, Guid userId);

        /// <summary>Lấy nội dung thuần của một version cụ thể để diff.</summary>
        Task<string> GetVersionContentAsync(Guid chapterId, int versionNumber, Guid userId);

        // ── Chunking ───────────────────────────────────────────────────────────
        Task<ChapterVersionDetailResponse> ChunkVersionAsync(Guid chapterId, Guid userId);
    }
}
