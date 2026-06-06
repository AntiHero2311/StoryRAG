using Service.DTOs;

namespace Service.Interfaces
{
    /// <summary>
    /// Dịch vụ hỗ trợ các tác vụ kiểm duyệt của Staff đối với truyện và tác giả vi phạm.
    /// </summary>
    public interface IStaffModerationService
    {
        /// <summary>
        /// Lấy báo cáo hiệu suất làm việc của Staff (số lượng phản hồi đã gửi, số lượt review báo cáo).
        /// </summary>
        Task<StaffPerformanceResponse> GetStaffPerformanceAsync(Guid staffId);

        /// <summary>
        /// Gửi cảnh báo chính thức tới tác giả của dự án truyện.
        /// </summary>
        Task WarnAuthorAsync(Guid staffId, ModerationWarnRequest request);

        /// <summary>
        /// Tạm dừng hiển thị (khóa tạm thời) dự án truyện vi phạm chính sách nội dung.
        /// </summary>
        Task SuspendProjectAsync(Guid staffId, ModerationSuspendProjectRequest request);

        /// <summary>
        /// Đề xuất lên Admin thực hiện khóa (ban) tài khoản của tác giả vi phạm nghiêm trọng.
        /// </summary>
        Task RecommendBanAsync(Guid staffId, ModerationRecommendBanRequest request);
    }
}
