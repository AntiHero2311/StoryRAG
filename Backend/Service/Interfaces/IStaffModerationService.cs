using Service.DTOs;

namespace Service.Interfaces
{
    public interface IStaffModerationService
    {
        Task<StaffPerformanceResponse> GetStaffPerformanceAsync(Guid staffId);
        Task WarnAuthorAsync(Guid staffId, ModerationWarnRequest request);
        Task SuspendProjectAsync(Guid staffId, ModerationSuspendProjectRequest request);
        Task RecommendBanAsync(Guid staffId, ModerationRecommendBanRequest request);
    }
}
