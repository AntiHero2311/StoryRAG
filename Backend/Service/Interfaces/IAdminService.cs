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
    }
}
