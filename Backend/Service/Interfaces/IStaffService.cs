using Service.DTOs;

namespace Service.Interfaces
{
    public interface IStaffService
    {
        Task<StaffPagedResponse<FlaggedManuscriptItem>> GetFlaggedManuscriptsAsync(int page, int pageSize);

        Task<StaffPagedResponse<StaffFeedbackResponse>> GetFeedbacksAsync(Guid? projectId, int page, int pageSize);
        Task<StaffFeedbackResponse> CreateFeedbackAsync(Guid staffId, StaffFeedbackRequest request);
        Task<StaffFeedbackResponse> UpdateFeedbackAsync(Guid feedbackId, Guid staffId, StaffFeedbackRequest request);
        Task DeleteFeedbackAsync(Guid feedbackId);

        Task<StaffPagedResponse<StaffContentResponse>> GetKnowledgeBaseAsync(string? type, bool? isPublished, int page, int pageSize);
        Task<StaffContentResponse> CreateKnowledgeBaseItemAsync(Guid staffId, StaffContentRequest request);
        Task<StaffContentResponse> UpdateKnowledgeBaseItemAsync(Guid id, Guid staffId, StaffContentRequest request);
        Task DeleteKnowledgeBaseItemAsync(Guid id);

        Task<StaffPagedResponse<StaffAnalysisReviewResponse>> GetAnalysisReviewsAsync(Guid? projectId, int page, int pageSize);
        Task<StaffAnalysisReviewResponse> ReviewAnalysisAsync(Guid reportId, Guid staffId, ReviewAnalysisRequest request);
    }
}
