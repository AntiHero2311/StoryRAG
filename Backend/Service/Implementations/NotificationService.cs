using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class NotificationService : INotificationService
    {
        private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
        {
            "Author", "Staff", "Admin"
        };

        private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "success", "error", "info", "warning"
        };

        private readonly AppDbContext _db;

        public NotificationService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<List<NotificationResponse>> GetMyAsync(Guid userId, int limit = 50, CancellationToken cancellationToken = default)
        {
            var safeLimit = Math.Clamp(limit, 1, 200);
            var entities = await _db.Notifications
                .AsNoTracking()
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(safeLimit)
                .Select(n => new NotificationResponse
                {
                    Id = n.Id,
                    UserId = n.UserId,
                    CreatedByUserId = n.CreatedByUserId,
                    CreatedByName = n.CreatedByUser != null ? n.CreatedByUser.FullName : null,
                    Type = n.Type,
                    Title = n.Title,
                    Message = n.Message,
                    Tag = n.Tag,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    ReadAt = n.ReadAt,
                })
                .ToListAsync(cancellationToken);

            return entities;
        }

        public async Task<NotificationResponse?> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default)
        {
            var entity = await _db.Notifications
                .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId, cancellationToken);

            if (entity == null)
                return null;

            if (!entity.IsRead)
            {
                entity.IsRead = true;
                entity.ReadAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(cancellationToken);
            }

            var createdByName = entity.CreatedByUserId.HasValue
                ? await _db.Users
                    .Where(u => u.Id == entity.CreatedByUserId.Value)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync(cancellationToken)
                : null;

            return Map(entity, createdByName);
        }

        public async Task<int> MarkAllReadAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var items = await _db.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync(cancellationToken);

            if (items.Count == 0)
                return 0;

            var now = DateTime.UtcNow;
            foreach (var item in items)
            {
                item.IsRead = true;
                item.ReadAt = now;
            }

            await _db.SaveChangesAsync(cancellationToken);
            return items.Count;
        }

        public async Task<NotificationCreateResult> CreateAsync(Guid actorId, NotificationCreateRequest request, CancellationToken cancellationToken = default)
        {
            var title = NormalizeRequired(request.Title, "Tiêu đề thông báo không được để trống.", 200);
            var message = NormalizeRequired(request.Message, "Nội dung thông báo không được để trống.", 3000);
            var type = NormalizeType(request.Type);
            var tag = NormalizeOptional(request.Tag, 120);

            var targetRoles = (request.TargetRoles ?? [])
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Select(NormalizeRole)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (targetRoles.Count == 0)
                targetRoles = ["Author", "Staff", "Admin"];

            var created = await CreateForRolesAsync(
                targetRoles,
                type,
                title,
                message,
                tag,
                actorId,
                cancellationToken);

            return new NotificationCreateResult { CreatedCount = created };
        }

        public async Task<NotificationResponse> CreateForUserAsync(
            Guid userId,
            string type,
            string title,
            string message,
            string? tag = null,
            Guid? createdByUserId = null,
            CancellationToken cancellationToken = default)
        {
            var normalizedType = NormalizeType(type);
            var normalizedTitle = NormalizeRequired(title, "Tiêu đề thông báo không được để trống.", 200);
            var normalizedMessage = NormalizeRequired(message, "Nội dung thông báo không được để trống.", 3000);
            var normalizedTag = NormalizeOptional(tag, 120);

            var exists = await _db.Users
                .AnyAsync(u => u.Id == userId && u.IsActive, cancellationToken);
            if (!exists)
                throw new KeyNotFoundException("Không tìm thấy người dùng nhận thông báo.");

            if (!string.IsNullOrWhiteSpace(normalizedTag))
            {
                var hasTag = await _db.Notifications
                    .AnyAsync(n => n.UserId == userId && n.Tag == normalizedTag, cancellationToken);
                if (hasTag)
                {
                    var existing = await _db.Notifications
                        .AsNoTracking()
                        .Where(n => n.UserId == userId && n.Tag == normalizedTag)
                        .OrderByDescending(n => n.CreatedAt)
                        .Select(n => new NotificationResponse
                        {
                            Id = n.Id,
                            UserId = n.UserId,
                            CreatedByUserId = n.CreatedByUserId,
                            CreatedByName = n.CreatedByUser != null ? n.CreatedByUser.FullName : null,
                            Type = n.Type,
                            Title = n.Title,
                            Message = n.Message,
                            Tag = n.Tag,
                            IsRead = n.IsRead,
                            CreatedAt = n.CreatedAt,
                            ReadAt = n.ReadAt,
                        })
                        .FirstAsync(cancellationToken);
                    return existing;
                }
            }

            var entity = new Notification
            {
                UserId = userId,
                CreatedByUserId = createdByUserId,
                Type = normalizedType,
                Title = normalizedTitle,
                Message = normalizedMessage,
                Tag = normalizedTag,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            };

            _db.Notifications.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            var creatorName = createdByUserId.HasValue
                ? await _db.Users
                    .Where(u => u.Id == createdByUserId.Value)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync(cancellationToken)
                : null;

            return Map(entity, creatorName);
        }

        public async Task<int> CreateForRolesAsync(
            IReadOnlyCollection<string> roles,
            string type,
            string title,
            string message,
            string? tag = null,
            Guid? createdByUserId = null,
            CancellationToken cancellationToken = default)
        {
            if (roles.Count == 0)
                throw new InvalidOperationException("Phải có ít nhất một vai trò nhận thông báo.");

            var normalizedRoles = roles.Select(NormalizeRole).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var normalizedType = NormalizeType(type);
            var normalizedTitle = NormalizeRequired(title, "Tiêu đề thông báo không được để trống.", 200);
            var normalizedMessage = NormalizeRequired(message, "Nội dung thông báo không được để trống.", 3000);
            var normalizedTag = NormalizeOptional(tag, 120);

            var recipientIds = await _db.Users
                .Where(u => u.IsActive && normalizedRoles.Contains(u.Role))
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);

            if (recipientIds.Count == 0)
                return 0;

            HashSet<Guid> existedByTag = [];
            if (!string.IsNullOrWhiteSpace(normalizedTag))
            {
                existedByTag = await _db.Notifications
                    .Where(n => n.Tag == normalizedTag && recipientIds.Contains(n.UserId))
                    .Select(n => n.UserId)
                    .ToHashSetAsync(cancellationToken);
            }

            var now = DateTime.UtcNow;
            var toInsert = recipientIds
                .Where(id => !existedByTag.Contains(id))
                .Select(id => new Notification
                {
                    UserId = id,
                    CreatedByUserId = createdByUserId,
                    Type = normalizedType,
                    Title = normalizedTitle,
                    Message = normalizedMessage,
                    Tag = normalizedTag,
                    IsRead = false,
                    CreatedAt = now,
                })
                .ToList();

            if (toInsert.Count == 0)
                return 0;

            _db.Notifications.AddRange(toInsert);
            await _db.SaveChangesAsync(cancellationToken);
            return toInsert.Count;
        }

        private static NotificationResponse Map(Notification entity, string? createdByName)
        {
            return new NotificationResponse
            {
                Id = entity.Id,
                UserId = entity.UserId,
                CreatedByUserId = entity.CreatedByUserId,
                CreatedByName = createdByName,
                Type = entity.Type,
                Title = entity.Title,
                Message = entity.Message,
                Tag = entity.Tag,
                IsRead = entity.IsRead,
                CreatedAt = entity.CreatedAt,
                ReadAt = entity.ReadAt,
            };
        }

        private static string NormalizeRole(string role)
        {
            var trimmed = role.Trim();
            if (!AllowedRoles.Contains(trimmed))
                throw new InvalidOperationException($"Vai trò không hợp lệ: {trimmed}");

            return trimmed switch
            {
                "author" => "Author",
                "staff" => "Staff",
                "admin" => "Admin",
                _ => char.ToUpperInvariant(trimmed[0]) + trimmed[1..].ToLowerInvariant(),
            };
        }

        private static string NormalizeType(string type)
        {
            var normalized = type.Trim().ToLowerInvariant();
            if (!AllowedTypes.Contains(normalized))
                throw new InvalidOperationException("Loại thông báo không hợp lệ.");
            return normalized;
        }

        private static string NormalizeRequired(string value, string errorMessage, int maxLength)
        {
            var trimmed = value?.Trim() ?? string.Empty;
            if (trimmed.Length == 0)
                throw new InvalidOperationException(errorMessage);
            if (trimmed.Length > maxLength)
                throw new InvalidOperationException($"Dữ liệu vượt quá giới hạn {maxLength} ký tự.");
            return trimmed;
        }

        private static string? NormalizeOptional(string? value, int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var trimmed = value.Trim();
            if (trimmed.Length > maxLength)
                throw new InvalidOperationException($"Dữ liệu vượt quá giới hạn {maxLength} ký tự.");
            return trimmed;
        }
    }
}
