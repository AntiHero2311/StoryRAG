using Service.DTOs;

namespace Service.Interfaces
{
    public interface INotificationService
    {
        Task<List<NotificationResponse>> GetMyAsync(Guid userId, int limit = 50, CancellationToken cancellationToken = default);
        Task<NotificationResponse?> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default);
        Task<int> MarkAllReadAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<NotificationCreateResult> CreateAsync(Guid actorId, NotificationCreateRequest request, CancellationToken cancellationToken = default);
        Task<NotificationResponse> CreateForUserAsync(
            Guid userId,
            string type,
            string title,
            string message,
            string? tag = null,
            Guid? createdByUserId = null,
            CancellationToken cancellationToken = default);
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
