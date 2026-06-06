using Service.DTOs;

namespace Service.Interfaces
{
    /// <summary>
    /// Dịch vụ quản lý dự án truyện (CRUD, thống kê dashboard tác giả, export toàn bộ truyện).
    /// </summary>
    public interface IProjectService
    {
        /// <summary>
        /// Lấy danh sách tất cả các dự án truyện của một tác giả.
        /// </summary>
        Task<List<ProjectResponse>> GetUserProjectsAsync(Guid userId);

        /// <summary>
        /// Lấy thông tin chi tiết của một dự án truyện theo ID (kiểm tra quyền sở hữu).
        /// </summary>
        Task<ProjectResponse> GetProjectByIdAsync(Guid projectId, Guid userId);

        /// <summary>
        /// Tạo mới một dự án truyện (tự động mã hóa tên và tóm tắt bằng DEK của người dùng).
        /// </summary>
        Task<ProjectResponse> CreateProjectAsync(Guid userId, CreateProjectRequest request);

        /// <summary>
        /// Cập nhật thông tin dự án truyện (tên, tóm tắt, thể loại, ghi chú AI).
        /// </summary>
        Task<ProjectResponse> UpdateProjectAsync(Guid projectId, Guid userId, UpdateProjectRequest request);

        /// <summary>
        /// Xóa mềm một dự án truyện (chuyển trạng thái lưu trữ).
        /// </summary>
        Task DeleteProjectAsync(Guid projectId, Guid userId);

        /// <summary>
        /// Lấy thông tin số liệu thống kê cho dashboard của tác giả (tổng số chương, lượt phân tích đã dùng, tin nhắn chat).
        /// </summary>
        Task<AuthorDashboardStats> GetUserStatsAsync(Guid userId);

        /// <summary>
        /// Xuất toàn bộ bản thảo của dự án truyện ra định dạng file văn bản sạch.
        /// </summary>
        Task<(string fileName, string content, string mimeType)> ExportProjectAsync(Guid projectId, Guid userId);
    }

    /// <summary>
    /// Thống kê Dashboard của tác giả.
    /// </summary>
    public class AuthorDashboardStats
    {
        /// <summary>Tổng số chương truyện đã viết.</summary>
        public int TotalChapters { get; set; }
        /// <summary>Tổng số lượt phân tích AI đã sử dụng.</summary>
        public int TotalAnalysesUsed { get; set; }
        /// <summary>Tổng số tin nhắn chat AI đã thực hiện.</summary>
        public int TotalChatMessages { get; set; }
    }
}
