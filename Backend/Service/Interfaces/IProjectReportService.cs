using Service.DTOs;

namespace Service.Interfaces
{
    public interface IProjectReportService
    {
        /// <summary>
        /// Phân tích bộ truyện theo rubric 100 điểm, lưu kết quả và trả về report.
        /// Nếu LLM không khả dụng, trả về mock data với Status = "MockData".
        /// </summary>
        Task<ProjectReportResponse> AnalyzeAsync(
            Guid projectId,
            Guid userId,
            Func<int, string?, CancellationToken, Task>? progressCallback = null,
            CancellationToken cancellationToken = default,
            Guid? analysisJobId = null);

        /// <summary>Lấy report mới nhất của dự án.</summary>
        Task<ProjectReportResponse?> GetLatestAsync(Guid projectId, Guid userId);

        /// <summary>Lấy toàn bộ lịch sử report của dự án.</summary>
        Task<List<ProjectReportSummary>> GetAllAsync(Guid projectId, Guid userId);

        /// <summary>Lấy report theo ID.</summary>
        Task<ProjectReportResponse?> GetByIdAsync(Guid reportId, Guid projectId, Guid userId);

        /// <summary>
        /// Lấy nội dung chunk đã giải mã theo <c>ids</c> (Guid chunk) hoặc <c>ordinals</c> (thứ tự phân tích).
        /// </summary>
        Task<List<EvidenceChunkItemDto>> GetProjectEvidenceChunksAsync(
            Guid projectId,
            Guid userId,
            string? ids,
            string? ordinals,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Lấy danh sách snapshot văn bản (Read-only) của một Report, 
        /// tự động giải mã để trả về nguyên văn bản thảo lúc phân tích.
        /// </summary>
        Task<List<ProjectReportSnapshotItem>> GetReportSnapshotsAsync(
            Guid reportId,
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default);
    }
}
