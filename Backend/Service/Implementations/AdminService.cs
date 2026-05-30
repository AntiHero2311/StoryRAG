using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Service.Implementations
{
    public class AdminService : IAdminService
    {
        private static readonly string[] AllowedRoles = { "Author", "Staff", "Admin" };

        internal const string KeyMaxUploadMb = "storage.max_upload_mb";
        internal const string KeyMaxProjectsPerAuthor = "storage.max_projects_per_author";
        internal const string KeyMaintenanceMode = "system.maintenance_mode";

        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly ISystemConfigService _sysConfig;
        private readonly ISystemAuditLogService _auditLog;

        public AdminService(
            AppDbContext context,
            IConfiguration config,
            ISystemConfigService sysConfig,
            ISystemAuditLogService auditLog)
        {
            _context = context;
            _config = config;
            _sysConfig = sysConfig;
            _auditLog = auditLog;
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
            var totalCharacters = await _context.ReportCharacterEntries.CountAsync();
            var totalWorldbuildingEntries = await _context.ReportWorldbuildingEntries.CountAsync();

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

        public async Task<UserSummaryDto> GetUserByIdAsync(Guid id)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");
            return MapSummary(user);
        }

        public async Task<UserSummaryDto> CreateUserAsync(AdminCreateUserRequest request)
        {
            ValidateRole(request.Role);
            var email = request.Email.Trim().ToLowerInvariant();

            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
                throw new InvalidOperationException("Email đã được sử dụng.");

            PasswordHasher.CreateHash(request.Password, out var passwordHash, out var passwordSalt);

            var rawDek = EncryptionHelper.GenerateDataEncryptionKey();
            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("MasterKey chưa được cấu hình.");
            var encryptedDek = EncryptionHelper.EncryptWithMasterKey(rawDek, masterKey);

            var user = new User
            {
                Id = Guid.NewGuid(),
                FullName = request.FullName.Trim(),
                Email = request.Email.Trim(),
                PasswordHash = passwordHash,
                PasswordSalt = passwordSalt,
                PasswordFormatVersion = PasswordHasher.Pbkdf2PasswordFormatVersion,
                DataEncryptionKey = encryptedDek,
                Role = request.Role,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            await _auditLog.LogAsync("User", "Create", $"Tạo user {user.Email} ({user.Role})", null);
            return MapSummary(user);
        }

        public async Task<UserSummaryDto> UpdateUserAsync(Guid id, AdminUpdateUserRequest request, Guid actingAdminId)
        {
            ValidateRole(request.Role);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");

            var email = request.Email.Trim();
            if (await _context.Users.AnyAsync(u => u.Id != id && u.Email.ToLower() == email.ToLower()))
                throw new InvalidOperationException("Email đã được sử dụng.");

            if (id == actingAdminId && request.Role != "Admin")
                throw new InvalidOperationException("Bạn không thể hạ quyền tài khoản Admin của chính mình.");

            if (id == actingAdminId && !request.IsActive)
                throw new InvalidOperationException("Bạn không thể khoá tài khoản Admin của chính mình.");

            if (user.Role == "Admin" && request.Role != "Admin")
                await EnsureAnotherAdminExistsAsync(id);

            if (!request.IsActive && user.Role == "Admin")
                await EnsureAnotherAdminExistsAsync(id);

            user.FullName = request.FullName.Trim();
            user.Email = email;
            user.Role = request.Role;
            user.IsActive = request.IsActive;

            if (!string.IsNullOrWhiteSpace(request.NewPassword))
            {
                PasswordHasher.CreateHash(request.NewPassword, out var passwordHash, out var passwordSalt);
                user.PasswordHash = passwordHash;
                user.PasswordSalt = passwordSalt;
                user.PasswordFormatVersion = PasswordHasher.Pbkdf2PasswordFormatVersion;
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
            }

            await _context.SaveChangesAsync();
            await _auditLog.LogAsync("User", "Update", $"Cập nhật user {user.Email}", actingAdminId);
            return MapSummary(user);
        }

        public async Task<UserSummaryDto> SetUserActiveAsync(Guid id, bool isActive, Guid actingAdminId)
        {
            if (id == actingAdminId && !isActive)
                throw new InvalidOperationException("Bạn không thể khoá tài khoản của chính mình.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");

            if (!isActive && user.Role == "Admin")
                await EnsureAnotherAdminExistsAsync(id);

            user.IsActive = isActive;
            if (!isActive)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
            }

            await _context.SaveChangesAsync();
            await _auditLog.LogAsync("User", isActive ? "Activate" : "Deactivate", $"{(isActive ? "Mở khoá" : "Khoá")} user {user.Email}", actingAdminId);
            return MapSummary(user);
        }

        public async Task DeleteUserAsync(Guid id, Guid actingAdminId)
        {
            if (id == actingAdminId)
                throw new InvalidOperationException("Bạn không thể xoá tài khoản của chính mình.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");

            if (user.Role == "Admin")
                await EnsureAnotherAdminExistsAsync(id);

            var hasProjects = await _context.Projects.AnyAsync(p => p.AuthorId == id && !p.IsDeleted);
            if (hasProjects)
            {
                user.IsActive = false;
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
                await _context.SaveChangesAsync();
                await _auditLog.LogAsync("User", "Deactivate", $"Khoá user {user.Email} (còn dự án)", actingAdminId);
                return;
            }

            var email = user.Email;
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            await _auditLog.LogAsync("User", "Delete", $"Xoá user {email}", actingAdminId);
        }

        public async Task<SystemLimitsResponse> GetSystemLimitsAsync()
        {
            var maxUpload = await _sysConfig.GetAsync(KeyMaxUploadMb, 10);
            var maxProjects = await _sysConfig.GetAsync(KeyMaxProjectsPerAuthor, 50);
            var maintenance = await _sysConfig.GetAsync(KeyMaintenanceMode, false);

            var totalProjects = await _context.Projects.LongCountAsync(p => !p.IsDeleted);
            var totalChapters = await _context.Chapters.LongCountAsync(c => !c.IsDeleted);
            var totalWords = await _context.Chapters.Where(c => !c.IsDeleted).SumAsync(c => (long)c.WordCount);

            return new SystemLimitsResponse
            {
                MaxUploadMb = maxUpload,
                MaxProjectsPerAuthor = maxProjects,
                MaintenanceMode = maintenance,
                TotalProjects = totalProjects,
                TotalChapters = totalChapters,
                TotalWordCount = totalWords,
            };
        }

        public async Task<SystemLimitsResponse> UpdateSystemLimitsAsync(SystemLimitsRequest request, Guid adminId)
        {
            if (request.MaxUploadMb < 1 || request.MaxUploadMb > 100)
                throw new ArgumentException("max_upload_mb phải từ 1–100.");
            if (request.MaxProjectsPerAuthor < 1 || request.MaxProjectsPerAuthor > 500)
                throw new ArgumentException("max_projects_per_author phải từ 1–500.");

            await _sysConfig.SetAsync(KeyMaxUploadMb, request.MaxUploadMb, adminId);
            await _sysConfig.SetAsync(KeyMaxProjectsPerAuthor, request.MaxProjectsPerAuthor, adminId);
            await _sysConfig.SetAsync(KeyMaintenanceMode, request.MaintenanceMode, adminId);
            await _auditLog.LogAsync("Config", "Limits", "Cập nhật giới hạn hệ thống", adminId);

            return await GetSystemLimitsAsync();
        }

        private async Task EnsureAnotherAdminExistsAsync(Guid excludeId)
        {
            var otherAdmins = await _context.Users.CountAsync(u => u.Role == "Admin" && u.IsActive && u.Id != excludeId);
            if (otherAdmins == 0)
                throw new InvalidOperationException("Phải giữ ít nhất một Admin đang hoạt động.");
        }

        private static void ValidateRole(string role)
        {
            if (!AllowedRoles.Contains(role))
                throw new ArgumentException("Role không hợp lệ. Chọn Author, Staff hoặc Admin.");
        }

        public async Task<AdminRevenueDashboardResponse> GetRevenueDashboardAsync(int year, int month, int? planId)
        {
            if (month < 1 || month > 12)
                throw new ArgumentException("Tháng không hợp lệ.");

            var completed = _context.Payments
                .AsNoTracking()
                .Where(p => p.Status == "Completed");

            var totalRevenue = await completed.SumAsync(p => (decimal?)p.Amount) ?? 0m;
            var totalOrders = await completed.CountAsync();

            var monthStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var monthEnd = monthStart.AddMonths(1);
            var prevStart = monthStart.AddMonths(-1);

            var monthCompleted = completed.Where(p =>
                (p.PaidAt ?? p.CreatedAt) >= monthStart && (p.PaidAt ?? p.CreatedAt) < monthEnd);

            if (planId.HasValue)
                monthCompleted = monthCompleted.Where(p => p.PlanId == planId.Value);

            var selectedMonthRevenue = await monthCompleted.SumAsync(p => (decimal?)p.Amount) ?? 0m;
            var selectedMonthOrders = await monthCompleted.CountAsync();

            var prevRevenue = await completed
                .Where(p => (p.PaidAt ?? p.CreatedAt) >= prevStart && (p.PaidAt ?? p.CreatedAt) < monthStart)
                .Where(p => !planId.HasValue || p.PlanId == planId.Value)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            decimal? growthPercent = prevRevenue > 0
                ? Math.Round((selectedMonthRevenue - prevRevenue) / prevRevenue * 100m, 1)
                : (selectedMonthRevenue > 0 ? 100m : 0m);

            var allInMonth = _context.Payments.AsNoTracking()
                .Where(p => (p.PaidAt ?? p.CreatedAt) >= monthStart && (p.PaidAt ?? p.CreatedAt) < monthEnd);
            if (planId.HasValue)
                allInMonth = allInMonth.Where(p => p.PlanId == planId.Value);

            var totalAttempts = await allInMonth.CountAsync();
            var completedInMonth = await allInMonth.CountAsync(p => p.Status == "Completed");
            var successRate = totalAttempts > 0
                ? Math.Round((decimal)completedInMonth / totalAttempts * 100m, 1)
                : 0m;

            var plans = await _context.SubscriptionPlans
                .AsNoTracking()
                .OrderBy(p => p.Price)
                .Select(p => new { p.Id, p.PlanName })
                .ToListAsync();

            var revenueByPlan = await completed
                .Where(p => (p.PaidAt ?? p.CreatedAt) >= monthStart && (p.PaidAt ?? p.CreatedAt) < monthEnd)
                .GroupBy(p => p.PlanId)
                .Select(g => new PlanRevenueItemDto
                {
                    PlanId = g.Key,
                    Revenue = g.Sum(x => x.Amount),
                    OrderCount = g.Count(),
                })
                .ToListAsync();

            foreach (var item in revenueByPlan)
            {
                item.PlanName = plans.FirstOrDefault(p => p.Id == item.PlanId)?.PlanName ?? $"Plan #{item.PlanId}";
            }

            revenueByPlan = revenueByPlan.OrderByDescending(x => x.Revenue).ToList();

            var trendStart = monthStart.AddMonths(-11);
            var trendPayments = await completed
                .Where(p => (p.PaidAt ?? p.CreatedAt) >= trendStart && (p.PaidAt ?? p.CreatedAt) < monthEnd)
                .Where(p => !planId.HasValue || p.PlanId == planId.Value)
                .Select(p => new { p.Amount, At = p.PaidAt ?? p.CreatedAt })
                .ToListAsync();

            var monthlyTrend = new List<MonthlyRevenueItemDto>();
            decimal? prevTrendRevenue = null;
            for (var i = 0; i < 12; i++)
            {
                var start = trendStart.AddMonths(i);
                var end = start.AddMonths(1);
                var inMonth = trendPayments.Where(p => p.At >= start && p.At < end).ToList();
                var rev = inMonth.Sum(p => p.Amount);
                decimal? g = prevTrendRevenue.HasValue && prevTrendRevenue.Value > 0
                    ? Math.Round((rev - prevTrendRevenue.Value) / prevTrendRevenue.Value * 100m, 1)
                    : (rev > 0 && prevTrendRevenue == 0 ? 100m : 0m);

                monthlyTrend.Add(new MonthlyRevenueItemDto
                {
                    Year = start.Year,
                    Month = start.Month,
                    Label = $"T{start.Month}-{start.Year}",
                    Revenue = rev,
                    OrderCount = inMonth.Count,
                    GrowthPercent = prevTrendRevenue.HasValue ? g : null,
                });
                prevTrendRevenue = rev;
            }

            return new AdminRevenueDashboardResponse
            {
                Year = year,
                Month = month,
                TotalRevenue = totalRevenue,
                SelectedMonthRevenue = selectedMonthRevenue,
                TotalCompletedOrders = totalOrders,
                SelectedMonthOrders = selectedMonthOrders,
                RevenueGrowthPercent = growthPercent,
                PaymentSuccessRate = successRate,
                RevenueByPlan = revenueByPlan,
                MonthlyTrend = monthlyTrend,
                Plans = plans.Select(p => new PlanRevenueItemDto
                {
                    PlanId = p.Id,
                    PlanName = p.PlanName,
                    Revenue = 0,
                    OrderCount = 0,
                }).ToList(),
            };
        }

        private static UserSummaryDto MapSummary(User u) => new()
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Role = u.Role,
            IsActive = u.IsActive,
            CreatedAt = u.CreatedAt,
        };
    }
}
