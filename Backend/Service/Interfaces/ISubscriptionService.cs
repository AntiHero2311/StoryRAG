using Service.DTOs;

namespace Service.Interfaces
{
    public interface ISubscriptionService
    {
        /// <summary>Lấy tất cả plan (active hoặc all nếu includeInactive)</summary>
        Task<IEnumerable<SubscriptionPlanResponse>> GetAllPlansAsync(bool includeInactive = false);

        /// <summary>Lấy chi tiết một plan</summary>
        Task<SubscriptionPlanResponse> GetPlanByIdAsync(int id);

        /// <summary>Tạo plan mới — Admin only</summary>
        Task<SubscriptionPlanResponse> CreatePlanAsync(CreatePlanRequest request);

        /// <summary>Cập nhật plan — Admin only</summary>
        Task<SubscriptionPlanResponse> UpdatePlanAsync(int id, UpdatePlanRequest request);

        /// <summary>Deactivate plan — Admin only</summary>
        Task DeletePlanAsync(int id);

        /// <summary>Lấy subscription hiện tại của user</summary>
        Task<UserSubscriptionResponse?> GetMySubscriptionAsync(Guid userId);

        /// <summary>Đăng ký plan cho user. Free plan (Price=0) tự động Active ngay.</summary>
        Task<UserSubscriptionResponse> SubscribeToPlanAsync(Guid userId, int planId);

        /// <summary>Kích hoạt gói trả phí sau khi thanh toán thành công.</summary>
        Task<UserSubscriptionResponse> ActivatePaidSubscriptionAsync(Guid userId, int planId, Guid paymentId);
    }
}
