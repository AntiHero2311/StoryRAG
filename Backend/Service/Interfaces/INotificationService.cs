using Service.DTOs;

namespace Service.Interfaces
{
    /// <summary>
    /// Dịch vụ quản lý và gửi thông báo trong hệ thống (Thông báo cá nhân, thông báo theo vai trò/roles).
    /// </summary>
    public interface INotificationService
    {
        /// <summary>
        /// Lấy danh sách thông báo của người dùng hiện tại, có giới hạn số lượng.
        /// </summary>
        Task<List<NotificationResponse>> GetMyAsync(Guid userId, int limit = 50, CancellationToken cancellationToken = default);

        /// <summary>
        /// Đánh dấu một thông báo cụ thể là đã đọc.
        /// </summary>
        Task<NotificationResponse?> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Đánh dấu tất cả thông báo của người dùng là đã đọc.
        /// </summary>
        Task<int> MarkAllReadAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Tạo và gửi thông báo dựa trên yêu cầu chung (được gọi từ controller/services).
        /// </summary>
        Task<NotificationCreateResult> CreateAsync(Guid actorId, NotificationCreateRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gửi thông báo trực tiếp cho một người dùng cụ thể.
        /// </summary>
        Task<NotificationResponse> CreateForUserAsync(
            Guid userId,
            string type,
            string title,
            string message,
            string? tag = null,
            Guid? createdByUserId = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Gửi thông báo hàng loạt cho tất cả người dùng thuộc các vai trò (roles) được chỉ định.
        /// </summary>
        Task<int> CreateForRolesAsync(
            IReadOnlyCollection<string> roles,
            string type,
            string title,
            string message,
            string? tag = null,
            Guid? createdByUserId = null,
            CancellationToken cancellationToken = default);
    }
}
