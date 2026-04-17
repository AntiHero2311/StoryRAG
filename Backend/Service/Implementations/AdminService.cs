using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.DTOs;
using Service.Interfaces;
using System.Linq;
using System.Threading.Tasks;

namespace Service.Implementations
{
    public class AdminService : IAdminService
    {
        private readonly AppDbContext _context;

        public AdminService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<UserStatsResponse> GetUserStatsAsync()
        {
            var users = await _context.Users
                .OrderByDescending(u => u.CreatedAt)
                .ToListAsync();

            var summaries = users.Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                Role = u.Role,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            }).ToList();

            return new UserStatsResponse
            {
                TotalUsers = users.Count,
                ActiveUsers = users.Count(u => u.IsActive),
                InactiveUsers = users.Count(u => !u.IsActive),
                TotalAuthors = users.Count(u => u.Role == "Author"),
                TotalStaff = users.Count(u => u.Role == "Staff"),
                TotalAdmins = users.Count(u => u.Role == "Admin"),
                Users = summaries
            };
        }

        public async Task<AdminOverviewStats> GetOverviewStatsAsync()
        {
            var now = DateTime.UtcNow;
            var day7ago  = now.AddDays(-7);
            var day30ago = now.AddDays(-30);

            var totalUsers = await _context.Users.CountAsync();
            var activeUsers = await _context.Users.CountAsync(u => u.IsActive);
            var newUsers7 = await _context.Users.CountAsync(u => u.CreatedAt >= day7ago);
            var newUsers30 = await _context.Users.CountAsync(u => u.CreatedAt >= day30ago);
            var totalAuthors = await _context.Users.CountAsync(u => u.Role == "Author");
            var totalStaff = await _context.Users.CountAsync(u => u.Role == "Staff");
            var totalAdmins = await _context.Users.CountAsync(u => u.Role == "Admin");

            var totalProjects = await _context.Projects.CountAsync(p => !p.IsDeleted);
            var totalChapters = await _context.Chapters.CountAsync(c => !c.IsDeleted);
            var totalWordCount = await _context.Chapters.Where(c => !c.IsDeleted).SumAsync(c => (long)c.WordCount);
            var totalCharacters = await _context.CharacterEntries.CountAsync();
            var totalWorldbuildingEntries = await _context.WorldbuildingEntries.CountAsync();

            var totalAiTokens = await _context.ChatMessages.SumAsync(m => (long)m.TotalTokens);
            var totalAiChatMessages = await _context.ChatMessages.CountAsync();
            var totalAiAnalyses = await _context.ProjectReports.CountAsync(r => r.Status == "Completed");

            var activeSubscriptions = await _context.UserSubscriptions.CountAsync(s => s.Status == "Active" && s.EndDate >= now);
            var expiredSubscriptions = await _context.UserSubscriptions.CountAsync(s => s.Status == "Active" && s.EndDate < now);
            var cancelledSubscriptions = await _context.UserSubscriptions.CountAsync(s => s.Status == "Cancelled");
            var successfulPayments = await _context.Payments.CountAsync(p => p.Status == "Completed");
            var totalRevenue = await _context.Payments
                .Where(p => p.Status == "Completed")
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;
            var revenueLast7Days = await _context.Payments
                .Where(p => p.Status == "Completed" && p.PaidAt.HasValue && p.PaidAt.Value >= day7ago)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;
            var revenueLast30Days = await _context.Payments
                .Where(p => p.Status == "Completed" && p.PaidAt.HasValue && p.PaidAt.Value >= day30ago)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            var openBugReports = await _context.BugReports.CountAsync(b => b.Status == "Open");
            var inProgressBugReports = await _context.BugReports.CountAsync(b => b.Status == "InProgress");
            var resolvedBugReports = await _context.BugReports.CountAsync(b => b.Status == "Resolved");
            var highPriorityOpenBugs = await _context.BugReports.CountAsync(b => b.Status == "Open" && b.Priority == "High");

            return new AdminOverviewStats
            {
                TotalUsers = totalUsers,
                ActiveUsers = activeUsers,
                NewUsersLast7Days = newUsers7,
                NewUsersLast30Days = newUsers30,
                TotalAuthors = totalAuthors,
                TotalStaff = totalStaff,
                TotalAdmins = totalAdmins,

                TotalProjects = totalProjects,
                TotalChapters = totalChapters,
                TotalWordCount = totalWordCount,
                TotalCharacters = totalCharacters,
                TotalWorldbuildingEntries = totalWorldbuildingEntries,

                TotalAiTokens = totalAiTokens,
                TotalAiChatMessages = totalAiChatMessages,
                TotalAiAnalyses = totalAiAnalyses,

                ActiveSubscriptions = activeSubscriptions,
                ExpiredSubscriptions = expiredSubscriptions,
                CancelledSubscriptions = cancelledSubscriptions,
                SuccessfulPayments = successfulPayments,
                TotalRevenue = totalRevenue,
                RevenueLast7Days = revenueLast7Days,
                RevenueLast30Days = revenueLast30Days,

                OpenBugReports = openBugReports,
                InProgressBugReports = inProgressBugReports,
                ResolvedBugReports = resolvedBugReports,
                HighPriorityOpenBugs = highPriorityOpenBugs,
            };
        }
    }
}
