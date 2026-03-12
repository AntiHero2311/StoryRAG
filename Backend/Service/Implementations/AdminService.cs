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

            // Run all queries in parallel for performance
            var totalUsersTask          = _context.Users.CountAsync();
            var activeUsersTask         = _context.Users.CountAsync(u => u.IsActive);
            var newUsers7Task           = _context.Users.CountAsync(u => u.CreatedAt >= day7ago);
            var newUsers30Task          = _context.Users.CountAsync(u => u.CreatedAt >= day30ago);
            var authorsTask             = _context.Users.CountAsync(u => u.Role == "Author");
            var staffTask               = _context.Users.CountAsync(u => u.Role == "Staff");
            var adminsTask              = _context.Users.CountAsync(u => u.Role == "Admin");

            var totalProjectsTask       = _context.Projects.CountAsync(p => !p.IsDeleted);
            var totalChaptersTask       = _context.Chapters.CountAsync(c => !c.IsDeleted);
            var totalWordCountTask      = _context.Chapters.Where(c => !c.IsDeleted).SumAsync(c => (long)c.WordCount);
            var totalCharsTask          = _context.CharacterEntries.CountAsync();
            var totalWorldTask          = _context.WorldbuildingEntries.CountAsync();

            var totalTokensTask         = _context.ChatMessages.SumAsync(m => (long)m.TotalTokens);
            var totalChatMsgTask        = _context.ChatMessages.CountAsync();
            var totalAnalysesTask       = _context.ProjectReports.CountAsync(r => r.Status == "Completed");

            var activeSubsTask          = _context.UserSubscriptions.CountAsync(s => s.Status == "Active" && s.EndDate >= now);
            var expiredSubsTask         = _context.UserSubscriptions.CountAsync(s => s.Status == "Active" && s.EndDate < now);
            var cancelledSubsTask       = _context.UserSubscriptions.CountAsync(s => s.Status == "Cancelled");

            var openBugsTask            = _context.BugReports.CountAsync(b => b.Status == "Open");
            var inProgressBugsTask      = _context.BugReports.CountAsync(b => b.Status == "InProgress");
            var resolvedBugsTask        = _context.BugReports.CountAsync(b => b.Status == "Resolved");
            var highPriorityBugsTask    = _context.BugReports.CountAsync(b => b.Status == "Open" && b.Priority == "High");

            await Task.WhenAll(
                totalUsersTask, activeUsersTask, newUsers7Task, newUsers30Task,
                authorsTask, staffTask, adminsTask,
                totalProjectsTask, totalChaptersTask, totalWordCountTask, totalCharsTask, totalWorldTask,
                totalTokensTask, totalChatMsgTask, totalAnalysesTask,
                activeSubsTask, expiredSubsTask, cancelledSubsTask,
                openBugsTask, inProgressBugsTask, resolvedBugsTask, highPriorityBugsTask
            );

            return new AdminOverviewStats
            {
                TotalUsers            = await totalUsersTask,
                ActiveUsers           = await activeUsersTask,
                NewUsersLast7Days     = await newUsers7Task,
                NewUsersLast30Days    = await newUsers30Task,
                TotalAuthors          = await authorsTask,
                TotalStaff            = await staffTask,
                TotalAdmins           = await adminsTask,

                TotalProjects              = await totalProjectsTask,
                TotalChapters              = await totalChaptersTask,
                TotalWordCount             = await totalWordCountTask,
                TotalCharacters            = await totalCharsTask,
                TotalWorldbuildingEntries  = await totalWorldTask,

                TotalAiTokens         = await totalTokensTask,
                TotalAiChatMessages   = await totalChatMsgTask,
                TotalAiAnalyses       = await totalAnalysesTask,

                ActiveSubscriptions   = await activeSubsTask,
                ExpiredSubscriptions  = await expiredSubsTask,
                CancelledSubscriptions = await cancelledSubsTask,

                OpenBugReports        = await openBugsTask,
                InProgressBugReports  = await inProgressBugsTask,
                ResolvedBugReports    = await resolvedBugsTask,
                HighPriorityOpenBugs  = await highPriorityBugsTask,
            };
        }
    }
}
