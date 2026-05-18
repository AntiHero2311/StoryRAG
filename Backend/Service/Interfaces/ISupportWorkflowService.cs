using Service.DTOs;

namespace Service.Interfaces
{
    public interface ISupportWorkflowService
    {
        Task<SupportTicketResponse> CreateTicketAsync(Guid userId, CreateSupportTicketRequest request);
        Task<IReadOnlyList<SupportTicketResponse>> GetMyTicketsAsync(Guid userId);
        Task<StaffPagedResponse<SupportTicketResponse>> GetTicketsForStaffAsync(string? status, string? category, int page, int pageSize);
        Task<SupportTicketResponse> UpdateTicketAsync(Guid ticketId, Guid staffId, UpdateSupportTicketRequest request);

        Task<AuthorAppealResponse> CreateAppealAsync(Guid authorId, CreateAuthorAppealRequest request);
        Task<IReadOnlyList<AuthorAppealResponse>> GetMyAppealsAsync(Guid authorId);
        Task<StaffPagedResponse<AuthorAppealResponse>> GetAppealsForStaffAsync(string? status, int page, int pageSize);
        Task<AuthorAppealResponse> ReviewAppealAsync(Guid appealId, Guid staffId, ReviewAuthorAppealRequest request);

        Task<StaffPerformanceResponse> GetStaffPerformanceAsync(Guid staffId);

        Task WarnAuthorAsync(Guid staffId, ModerationWarnRequest request);
        Task SuspendProjectAsync(Guid staffId, ModerationSuspendProjectRequest request);
        Task<SupportTicketResponse> RecommendBanAsync(Guid staffId, ModerationRecommendBanRequest request);
    }
}
