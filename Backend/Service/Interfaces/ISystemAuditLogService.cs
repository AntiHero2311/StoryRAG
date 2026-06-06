using Service.DTOs;

namespace Service.Interfaces
{
    /// <summary>
    /// Dịch vụ ghi nhật ký kiểm toán hệ thống (System Audit Logs) nhằm theo dõi các hành động nhạy cảm của người dùng/Staff/Admin.
    /// </summary>
    public interface ISystemAuditLogService
    {
        /// <summary>
        /// Ghi nhận một sự kiện hoạt động mới vào nhật ký hệ thống.
        /// </summary>
        Task LogAsync(string category, string action, string message, Guid? actorId = null, string level = "Info", string? metadataJson = null);

        /// <summary>
        /// Truy xuất danh sách nhật ký hoạt động phân trang theo danh mục (category) và cấp độ lỗi (level).
        /// </summary>
        Task<SystemLogsPageResponse> GetLogsAsync(int page, int pageSize, string? category, string? level);
    }
}
