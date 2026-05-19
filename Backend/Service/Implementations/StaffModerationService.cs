using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class StaffModerationService : IStaffModerationService
    {
        private readonly AppDbContext _db;
        private readonly IEmailService _emailService;
        private readonly ISystemAuditLogService _auditLog;
        private readonly ILogger<StaffModerationService> _logger;

        public StaffModerationService(
            AppDbContext db,
            IEmailService emailService,
            ISystemAuditLogService auditLog,
            ILogger<StaffModerationService> logger)
        {
            _db = db;
            _emailService = emailService;
            _auditLog = auditLog;
            _logger = logger;
        }

        public async Task<StaffPerformanceResponse> GetStaffPerformanceAsync(Guid staffId)
        {
            var staff = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == staffId)
                ?? throw new KeyNotFoundException("Không tìm thấy staff.");

            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var reviewsThisMonth = await _db.StaffAnalysisReviews
                .CountAsync(r => r.ReviewedBy == staffId && r.CreatedAt >= monthStart);

            var resolvedFeedbacks = await _db.StaffFeedbacks
                .Where(f => f.StaffId == staffId && f.Status == "Resolved" && f.UpdatedAt >= monthStart)
                .Select(f => new { f.CreatedAt, f.UpdatedAt })
                .ToListAsync();

            double? avgHours = null;
            if (resolvedFeedbacks.Count > 0)
            {
                var hours = resolvedFeedbacks
                    .Where(f => f.UpdatedAt.HasValue)
                    .Select(f => (f.UpdatedAt!.Value - f.CreatedAt).TotalHours)
                    .ToList();
                if (hours.Count > 0)
                    avgHours = Math.Round(hours.Average(), 1);
            }

            return new StaffPerformanceResponse
            {
                StaffId = staffId,
                StaffName = staff.FullName,
                ReviewsThisMonth = reviewsThisMonth,
                FeedbacksResolvedThisMonth = resolvedFeedbacks.Count,
                AvgFeedbackResponseHours = avgHours,
                OpenFeedbacksAssigned = await _db.StaffFeedbacks.CountAsync(f => f.StaffId == staffId && f.Status == "Open"),
            };
        }

        public async Task WarnAuthorAsync(Guid staffId, ModerationWarnRequest request)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.UserId)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");

            await _emailService.SendModerationWarningEmailAsync(
                user.Email,
                user.FullName,
                request.Message.Trim());

            await _auditLog.LogAsync("Moderation", "Warn", $"Cảnh báo tác giả {user.Email}", staffId);

            _logger.LogInformation(
                "Staff {StaffId} sent moderation warning to user {UserId}, project {ProjectId}",
                staffId, request.UserId, request.ProjectId);
        }

        public async Task SuspendProjectAsync(Guid staffId, ModerationSuspendProjectRequest request)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted)
                ?? throw new KeyNotFoundException("Không tìm thấy dự án.");

            project.Status = "Archived";
            project.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await _auditLog.LogAsync("Moderation", "SuspendProject", $"Khoá dự án {project.Title}", staffId);

            _logger.LogInformation(
                "Staff {StaffId} archived project {ProjectId}. Reason: {Reason}",
                staffId, request.ProjectId, request.Reason);
        }

        public async Task RecommendBanAsync(Guid staffId, ModerationRecommendBanRequest request)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.UserId)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");

            await _auditLog.LogAsync(
                "Moderation",
                "RecommendBan",
                $"Đề xuất khóa tài khoản {user.Email}: {request.Reason.Trim()}",
                staffId,
                level: "Warning");

            _logger.LogWarning(
                "Staff {StaffId} recommended ban for user {UserId}. Reason: {Reason}",
                staffId, request.UserId, request.Reason);
        }
    }
}
