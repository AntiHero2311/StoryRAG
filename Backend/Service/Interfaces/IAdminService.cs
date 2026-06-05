using System;
using System.Threading.Tasks;
using Service.DTOs;

namespace Service.Interfaces
{
    public interface IAdminService
    {
        Task<UserStatsResponse> GetUserStatsAsync();
        Task<AdminOverviewStats> GetOverviewStatsAsync();
        Task<UserSummaryDto> GetUserByIdAsync(Guid id);
        Task<UserSummaryDto> CreateUserAsync(AdminCreateUserRequest request);
        Task<UserSummaryDto> UpdateUserAsync(Guid id, AdminUpdateUserRequest request, Guid actingAdminId);
        Task<UserSummaryDto> SetUserActiveAsync(Guid id, bool isActive, Guid actingAdminId);
        Task DeleteUserAsync(Guid id, Guid actingAdminId);
        Task<AdminRevenueDashboardResponse> GetRevenueDashboardAsync(int year, int month, int? planId);
        Task<SystemLimitsResponse> GetSystemLimitsAsync();
        Task<SystemLimitsResponse> UpdateSystemLimitsAsync(SystemLimitsRequest request, Guid adminId);

        // ── Staff Genre Specialization ────────────────────────────────────────────
        /// <summary>Lấy danh sách tất cả Staff kèm genres chuyên môn.</summary>
        Task<List<UserSummaryDto>> GetAllStaffWithGenresAsync();
        /// <summary>Lấy genres chuyên môn của một Staff.</summary>
        Task<UserSummaryDto> GetStaffGenresAsync(Guid staffId);
        /// <summary>Gán (thay thế toàn bộ) genres chuyên môn cho một Staff.</summary>
        Task<UserSummaryDto> AssignStaffGenresAsync(Guid staffId, StaffGenreAssignRequest request, Guid adminId);

        // ── Moderation & Ban ──────────────────────────────────────────────────────
        Task<UserSummaryDto> BanUserAsync(Guid id, bool isBanned, string? reason, Guid actingAdminId);
    }
}
