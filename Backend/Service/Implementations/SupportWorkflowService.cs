using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class SupportWorkflowService : ISupportWorkflowService
    {
        private readonly AppDbContext _db;
        private readonly IEmailService _emailService;
        private readonly ILogger<SupportWorkflowService> _logger;

        public SupportWorkflowService(
            AppDbContext db,
            IEmailService emailService,
            ILogger<SupportWorkflowService> logger)
        {
            _db = db;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<SupportTicketResponse> CreateTicketAsync(Guid userId, CreateSupportTicketRequest request)
        {
            var ticket = new SupportTicket
            {
                UserId = userId,
                Category = request.Category,
                Subject = request.Subject.Trim(),
                Description = request.Description.Trim(),
                Status = "Open",
                CreatedAt = DateTime.UtcNow
            };
            _db.SupportTickets.Add(ticket);
            await _db.SaveChangesAsync();
            return await MapTicketAsync(ticket.Id);
        }

        public async Task<IReadOnlyList<SupportTicketResponse>> GetMyTicketsAsync(Guid userId)
        {
            var ids = await _db.SupportTickets
                .AsNoTracking()
                .Where(t => t.UserId == userId && t.Category != "BanRecommendation")
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => t.Id)
                .ToListAsync();

            var results = new List<SupportTicketResponse>();
            foreach (var id in ids)
                results.Add(await MapTicketAsync(id));
            return results;
        }

        public async Task<StaffPagedResponse<SupportTicketResponse>> GetTicketsForStaffAsync(
            string? status, string? category, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.SupportTickets.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(t => t.Status == status);
            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(t => t.Category == category);

            var total = await query.CountAsync();
            var ids = await query
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => t.Id)
                .ToListAsync();

            var items = new List<SupportTicketResponse>();
            foreach (var id in ids)
                items.Add(await MapTicketAsync(id));

            return new StaffPagedResponse<SupportTicketResponse>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<SupportTicketResponse> UpdateTicketAsync(
            Guid ticketId, Guid staffId, UpdateSupportTicketRequest request)
        {
            var ticket = await _db.SupportTickets.FirstOrDefaultAsync(t => t.Id == ticketId)
                ?? throw new KeyNotFoundException("Không tìm thấy ticket.");

            if (!string.IsNullOrWhiteSpace(request.Status))
                ticket.Status = request.Status;
            if (request.StaffReply != null)
                ticket.StaffReply = request.StaffReply.Trim();

            ticket.AssignedStaffId ??= staffId;
            ticket.UpdatedAt = DateTime.UtcNow;
            if (ticket.Status is "Resolved" or "Closed")
                ticket.ResolvedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return await MapTicketAsync(ticket.Id);
        }

        public async Task<AuthorAppealResponse> CreateAppealAsync(Guid authorId, CreateAuthorAppealRequest request)
        {
            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.AuthorId == authorId && !p.IsDeleted)
                ?? throw new KeyNotFoundException("Không tìm thấy dự án của bạn.");

            var pendingExists = await _db.AuthorAppeals.AnyAsync(a =>
                a.AuthorId == authorId &&
                a.ProjectId == request.ProjectId &&
                a.AppealType == request.AppealType &&
                a.ReferenceId == request.ReferenceId &&
                a.Status == "Pending");

            if (pendingExists)
                throw new InvalidOperationException("Bạn đã có kháng cáo đang chờ xử lý cho mục này.");

            var appeal = new AuthorAppeal
            {
                AuthorId = authorId,
                ProjectId = project.Id,
                AppealType = request.AppealType,
                ReferenceId = request.ReferenceId,
                Reason = request.Reason.Trim(),
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };
            _db.AuthorAppeals.Add(appeal);
            await _db.SaveChangesAsync();
            return await MapAppealAsync(appeal.Id);
        }

        public async Task<IReadOnlyList<AuthorAppealResponse>> GetMyAppealsAsync(Guid authorId)
        {
            var ids = await _db.AuthorAppeals
                .AsNoTracking()
                .Where(a => a.AuthorId == authorId)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => a.Id)
                .ToListAsync();

            var results = new List<AuthorAppealResponse>();
            foreach (var id in ids)
                results.Add(await MapAppealAsync(id));
            return results;
        }

        public async Task<StaffPagedResponse<AuthorAppealResponse>> GetAppealsForStaffAsync(
            string? status, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.AuthorAppeals.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(a => a.Status == status);

            var total = await query.CountAsync();
            var ids = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => a.Id)
                .ToListAsync();

            var items = new List<AuthorAppealResponse>();
            foreach (var id in ids)
                items.Add(await MapAppealAsync(id));

            return new StaffPagedResponse<AuthorAppealResponse>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<AuthorAppealResponse> ReviewAppealAsync(
            Guid appealId, Guid staffId, ReviewAuthorAppealRequest request)
        {
            var appeal = await _db.AuthorAppeals.FirstOrDefaultAsync(a => a.Id == appealId)
                ?? throw new KeyNotFoundException("Không tìm thấy kháng cáo.");

            if (appeal.Status != "Pending")
                throw new InvalidOperationException("Kháng cáo đã được xử lý.");

            appeal.Status = request.Status;
            appeal.StaffNote = request.StaffNote?.Trim();
            appeal.ReviewedByStaffId = staffId;
            appeal.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return await MapAppealAsync(appeal.Id);
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

            var appealsReviewed = await _db.AuthorAppeals
                .CountAsync(a => a.ReviewedByStaffId == staffId && a.UpdatedAt >= monthStart);

            var ticketsResolved = await _db.SupportTickets
                .CountAsync(t =>
                    t.AssignedStaffId == staffId &&
                    t.Status == "Resolved" &&
                    t.ResolvedAt >= monthStart);

            return new StaffPerformanceResponse
            {
                StaffId = staffId,
                StaffName = staff.FullName,
                ReviewsThisMonth = reviewsThisMonth,
                FeedbacksResolvedThisMonth = resolvedFeedbacks.Count,
                AppealsReviewedThisMonth = appealsReviewed,
                TicketsResolvedThisMonth = ticketsResolved,
                AvgFeedbackResponseHours = avgHours,
                OpenFeedbacksAssigned = await _db.StaffFeedbacks.CountAsync(f => f.StaffId == staffId && f.Status == "Open"),
                PendingAppeals = await _db.AuthorAppeals.CountAsync(a => a.Status == "Pending"),
                OpenSupportTickets = await _db.SupportTickets.CountAsync(t =>
                    t.Status == "Open" || t.Status == "InProgress")
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

            _logger.LogInformation(
                "Staff {StaffId} archived project {ProjectId}. Reason: {Reason}",
                staffId, request.ProjectId, request.Reason);
        }

        public async Task<SupportTicketResponse> RecommendBanAsync(Guid staffId, ModerationRecommendBanRequest request)
        {
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.UserId)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");

            var ticket = new SupportTicket
            {
                UserId = request.UserId,
                AssignedStaffId = staffId,
                Category = "BanRecommendation",
                Subject = $"Đề xuất khóa tài khoản: {user.Email}",
                Description = request.Reason.Trim(),
                Status = "Open",
                CreatedAt = DateTime.UtcNow
            };
            _db.SupportTickets.Add(ticket);
            await _db.SaveChangesAsync();
            return await MapTicketAsync(ticket.Id);
        }

        private async Task<SupportTicketResponse> MapTicketAsync(Guid id)
        {
            var t = await _db.SupportTickets
                .AsNoTracking()
                .Include(x => x.User)
                .Include(x => x.AssignedStaff)
                .FirstAsync(x => x.Id == id);

            return new SupportTicketResponse
            {
                Id = t.Id,
                UserId = t.UserId,
                UserName = t.User.FullName,
                UserEmail = t.User.Email,
                AssignedStaffId = t.AssignedStaffId,
                AssignedStaffName = t.AssignedStaff?.FullName,
                Category = t.Category,
                Subject = t.Subject,
                Description = t.Description,
                Status = t.Status,
                StaffReply = t.StaffReply,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt,
                ResolvedAt = t.ResolvedAt
            };
        }

        private async Task<AuthorAppealResponse> MapAppealAsync(Guid id)
        {
            var a = await _db.AuthorAppeals
                .AsNoTracking()
                .Include(x => x.Author)
                .Include(x => x.ReviewedByStaff)
                .FirstAsync(x => x.Id == id);

            return new AuthorAppealResponse
            {
                Id = a.Id,
                AuthorId = a.AuthorId,
                AuthorName = a.Author.FullName,
                ProjectId = a.ProjectId,
                AppealType = a.AppealType,
                ReferenceId = a.ReferenceId,
                Reason = a.Reason,
                Status = a.Status,
                ReviewedByStaffId = a.ReviewedByStaffId,
                ReviewedByStaffName = a.ReviewedByStaff?.FullName,
                StaffNote = a.StaffNote,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt
            };
        }
    }
}
