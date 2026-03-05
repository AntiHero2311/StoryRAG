using Service.DTOs;

namespace Service.Interfaces
{
    public interface IProjectReportService
    {
        /// <summary>
        /// Phân tích bộ truyện theo rubric 100 điểm, lưu kết quả và trả về report.
        /// Nếu LLM không khả dụng, trả về mock data với Status = "MockData".
        /// </summary>
        Task<ProjectReportResponse> AnalyzeAsync(Guid projectId, Guid userId);

        /// <summary>Lấy report mới nhất của dự án.</summary>
        Task<ProjectReportResponse?> GetLatestAsync(Guid projectId, Guid userId);

        /// <summary>Lấy toàn bộ lịch sử report của dự án.</summary>
        Task<List<ProjectReportSummary>> GetAllAsync(Guid projectId, Guid userId);
    }
}
