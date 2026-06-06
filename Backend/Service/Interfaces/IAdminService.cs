using System;
using System.Threading.Tasks;
using Service.DTOs;

namespace Service.Interfaces
{
    /// <summary>
    /// Dịch vụ quản trị hệ thống dành cho Admin (Quản lý User, thống kê doanh thu, quản lý hạn mức hệ thống, phân công Staff).
    /// </summary>
    public interface IAdminService
    {
        /// <summary>
        /// Lấy thống kê số lượng người dùng theo từng vai trò (Roles).
        /// </summary>
        Task<UserStatsResponse> GetUserStatsAsync();

        /// <summary>
        /// Lấy số liệu thống kê tổng quan của hệ thống (tổng user, project, báo cáo, doanh thu).
        /// </summary>
        Task<AdminOverviewStats> GetOverviewStatsAsync();

        /// <summary>
        /// Lấy thông tin tóm tắt của một người dùng theo ID.
        /// </summary>
        Task<UserSummaryDto> GetUserByIdAsync(Guid id);

        /// <summary>
        /// Tạo mới một tài khoản người dùng với vai trò cụ thể.
        /// </summary>
        Task<UserSummaryDto> CreateUserAsync(AdminCreateUserRequest request);

        /// <summary>
        /// Cập nhật thông tin tài khoản người dùng (họ tên, email, vai trò).
        /// </summary>
        Task<UserSummaryDto> UpdateUserAsync(Guid id, AdminUpdateUserRequest request, Guid actingAdminId);

        /// <summary>
        /// Kích hoạt hoặc vô hiệu hóa tài khoản người dùng.
        /// </summary>
        Task<UserSummaryDto> SetUserActiveAsync(Guid id, bool isActive, Guid actingAdminId);

        /// <summary>
        /// Xóa tài khoản người dùng khỏi hệ thống.
        /// </summary>
        Task DeleteUserAsync(Guid id, Guid actingAdminId);

        /// <summary>
        /// Lấy thông tin thống kê doanh thu theo năm, tháng và gói dịch vụ.
        /// </summary>
        Task<AdminRevenueDashboardResponse> GetRevenueDashboardAsync(int year, int month, int? planId);

        /// <summary>
        /// Lấy các hạn mức hệ thống hiện tại (như kích thước chunk, overlap, giới hạn token chat).
        /// </summary>
        Task<SystemLimitsResponse> GetSystemLimitsAsync();

        /// <summary>
        /// Cập nhật các hạn mức hệ thống và ghi nhận admin thực hiện.
        /// </summary>
        Task<SystemLimitsResponse> UpdateSystemLimitsAsync(SystemLimitsRequest request, Guid adminId);

        // ── Staff Genre Specialization ────────────────────────────────────────────
        /// <summary>Lấy danh sách tất cả Staff kèm các thể loại chuyên môn được gán.</summary>
        Task<List<UserSummaryDto>> GetAllStaffWithGenresAsync();

        /// <summary>Lấy các thể loại chuyên môn cụ thể của một Staff.</summary>
        Task<UserSummaryDto> GetStaffGenresAsync(Guid staffId);

        /// <summary>Gán (thay thế toàn bộ) danh sách thể loại chuyên môn cho một Staff.</summary>
        Task<UserSummaryDto> AssignStaffGenresAsync(Guid staffId, StaffGenreAssignRequest request, Guid adminId);

        // ── Moderation & Ban ──────────────────────────────────────────────────────
        /// <summary>
        /// Khóa (Ban) hoặc mở khóa tài khoản người dùng kèm theo lý do cụ thể.
        /// </summary>
        Task<UserSummaryDto> BanUserAsync(Guid id, bool isBanned, string? reason, Guid actingAdminId);
    }
}
