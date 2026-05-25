using Service.DTOs;

namespace Service.Interfaces
{
    public interface IStaffService
    {
        Task<StaffPagedResponse<FlaggedManuscriptItem>> GetFlaggedManuscriptsAsync(int page, int pageSize);

        Task<StaffPagedResponse<FlaggedProjectItem>> GetFlaggedProjectsAsync(int page, int pageSize);

        Task<StaffPagedResponse<StaffFeedbackResponse>> GetFeedbacksAsync(Guid? projectId, int page, int pageSize);
        Task<StaffFeedbackResponse> CreateFeedbackAsync(Guid staffId, StaffFeedbackCreateRequest request);
        Task<StaffFeedbackResponse> CreateFeedbackAsync(Guid staffId, StaffFeedbackRequest request);
        Task<StaffFeedbackResponse> UpdateFeedbackAsync(Guid feedbackId, Guid staffId, StaffFeedbackRequest request);
        Task DeleteFeedbackAsync(Guid feedbackId);

        Task<StaffPagedResponse<StaffContentResponse>> GetKnowledgeBaseAsync(string? type, bool? isPublished, int page, int pageSize);
        Task<StaffContentResponse> CreateKnowledgeBaseItemAsync(Guid staffId, StaffContentRequest request);
        Task<StaffContentResponse> UpdateKnowledgeBaseItemAsync(Guid id, Guid staffId, StaffContentRequest request);
        Task DeleteKnowledgeBaseItemAsync(Guid id);

        Task<StaffPagedResponse<StaffAnalysisReviewResponse>> GetAnalysisReviewsAsync(Guid? projectId, int page, int pageSize);
        /// <summary>Lấy review theo ProjectReportId (khác với GetAnalysisReviewsAsync filter theo ProjectId).</summary>
        Task<StaffAnalysisReviewResponse?> GetAnalysisReviewByReportIdAsync(Guid reportId);
        Task<StaffAnalysisReviewResponse> ReviewAnalysisAsync(Guid reportId, Guid staffId, ReviewAnalysisRequest request);
        Task<StaffPagedResponse<StaffPendingReportItem>> GetPendingReportsAsync(int page, int pageSize);

        Task<IReadOnlyList<StaffAnalysisJobItem>> GetAnalysisJobsAsync(string? status);
        Task<StaffAnalysisJobItem> RerunAnalysisJobAsync(Guid jobId, Guid staffId);

        /// <summary>Staff lấy chi tiết report để xem/chỉnh sửa (bao gồm AI CriteriaJson gốc).</summary>
        Task<StaffReportDetailResponse> GetReportDetailAsync(Guid reportId);

        /// <summary>Staff lấy nội dung truyện (các chương hiện tại) theo report để đối chiếu khi review.</summary>
        Task<StaffReportStoryResponse> GetReportStoryAsync(Guid reportId);

        /// <summary>Staff chỉnh sửa nội dung text của một số tiêu chí và optionally phát hành cho user.</summary>
        Task<StaffReportDetailResponse> EditReportAsync(Guid reportId, Guid staffId, StaffEditReportRequest request);
    }
}
