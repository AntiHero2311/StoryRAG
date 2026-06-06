using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    /// <summary>
    /// Dịch vụ ghi nhật ký kiểm toán hệ thống (System Audit Logs) nhằm theo dõi các hành động nhạy cảm.
    /// </summary>
    public class SystemAuditLogService : ISystemAuditLogService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<SystemAuditLogService> _logger;

        public SystemAuditLogService(IServiceScopeFactory scopeFactory, ILogger<SystemAuditLogService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        /// <summary>
        /// Ghi nhận một sự kiện hoạt động mới vào nhật ký hệ thống.
        /// </summary>
        public async Task LogAsync(string category, string action, string message, Guid? actorId = null, string level = "Info", string? metadataJson = null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.SystemLogs.Add(new SystemLog
                {
                    Id = Guid.NewGuid(),
                    Level = level,
                    Category = category,
                    Action = action,
                    Message = message.Length > 1000 ? message[..1000] : message,
                    ActorId = actorId,
                    MetadataJson = metadataJson,
                    CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Không làm fail thao tác chính (xóa user, đổi config…) nếu bảng log chưa migrate
                _logger.LogWarning(ex, "Không ghi được audit log [{Category}/{Action}]. Chạy migration AddSystemLogs hoặc Scripts/add_system_logs.sql", category, action);
            }
        }

        /// <summary>
        /// Truy xuất danh sách nhật ký hoạt động phân trang theo danh mục (category) và cấp độ lỗi (level).
        /// </summary>
        public async Task<SystemLogsPageResponse> GetLogsAsync(int page, int pageSize, string? category, string? level)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 10, 100);

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var query = db.SystemLogs.AsNoTracking().AsQueryable();
                if (!string.IsNullOrWhiteSpace(category))
                    query = query.Where(l => l.Category == category);
                if (!string.IsNullOrWhiteSpace(level))
                    query = query.Where(l => l.Level == level);

                var total = await query.CountAsync();
                var rows = await (
                    from l in query
                    join u in db.Users.AsNoTracking() on l.ActorId equals u.Id into actors
                    from u in actors.DefaultIfEmpty()
                    orderby l.CreatedAt descending
                    select new
                    {
                        l.Id,
                        l.Level,
                        l.Category,
                        l.Action,
                        l.Message,
                        l.ActorId,
                        ActorName = u != null ? u.FullName : null,
                        l.CreatedAt,
                        l.MetadataJson,
                    })
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                return new SystemLogsPageResponse
                {
                    Total = total,
                    Page = page,
                    PageSize = pageSize,
                    StorageReady = true,
                    Items = rows.Select(r => new SystemLogItemDto
                    {
                        Id = r.Id,
                        Level = r.Level,
                        Category = r.Category,
                        Action = r.Action,
                        Message = r.Message,
                        ActorId = r.ActorId,
                        ActorName = r.ActorName,
                        CreatedAt = r.CreatedAt,
                        MetadataJson = r.MetadataJson,
                    }).ToList(),
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không đọc được system_logs — bảng có thể chưa tồn tại.");
                return new SystemLogsPageResponse { Page = page, PageSize = pageSize, StorageReady = false };
            }
        }
    }
}
