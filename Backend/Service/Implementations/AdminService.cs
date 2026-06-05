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

            // Load genres for all Staff users in one query
            var staffIds = users.Where(u => u.Role == "Staff").Select(u => u.Id).ToList();
            var staffGenreMap = staffIds.Count > 0
                ? await _context.StaffGenres
                    .Where(sg => staffIds.Contains(sg.StaffId))
                    .Include(sg => sg.Genre)
                    .GroupBy(sg => sg.StaffId)
                    .ToDictionaryAsync(
                        g => g.Key,
                        g => g.Select(sg => new GenreResponse
                        {
                            Id = sg.Genre.Id,
                            Name = sg.Genre.Name,
                            Slug = sg.Genre.Slug,
                            Color = sg.Genre.Color,
                            Description = sg.Genre.Description
                        }).ToList())
                : new Dictionary<Guid, List<GenreResponse>>();

            var summaries = users.Select(u =>
            {
                var dto = MapSummary(u);
                if (u.Role == "Staff" && staffGenreMap.TryGetValue(u.Id, out var genres))
                    dto.Genres = genres;
                return dto;
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

            var oldFullName = user.FullName;
            var oldEmail = user.Email;
            var oldRole = user.Role;
            var oldIsActive = user.IsActive;
            var isPasswordChanged = !string.IsNullOrWhiteSpace(request.NewPassword);

            user.FullName = request.FullName.Trim();
            user.Email = email;
            user.Role = request.Role;
            user.IsActive = request.IsActive;

            if (isPasswordChanged)
            {
                PasswordHasher.CreateHash(request.NewPassword!, out var passwordHash, out var passwordSalt);
                user.PasswordHash = passwordHash;
                user.PasswordSalt = passwordSalt;
                user.PasswordFormatVersion = PasswordHasher.Pbkdf2PasswordFormatVersion;
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
            }

            await _context.SaveChangesAsync();

            var diffs = new System.Collections.Generic.List<string>();
            if (oldFullName != user.FullName) diffs.Add($"Họ tên: '{oldFullName}' -> '{user.FullName}'");
            if (oldEmail != user.Email) diffs.Add($"Email: '{oldEmail}' -> '{user.Email}'");
            if (oldRole != user.Role) diffs.Add($"Vai trò: '{oldRole}' -> '{user.Role}'");
            if (oldIsActive != user.IsActive) diffs.Add($"Hoạt động: {oldIsActive} -> {user.IsActive}");
            if (isPasswordChanged) diffs.Add("Mật khẩu: Đã thay đổi");

            var logMsg = $"Cập nhật user {user.Email}";
            if (diffs.Count > 0)
            {
                logMsg += $": [{string.Join(", ", diffs)}]";
            }

            var oldUser = new System.Collections.Generic.Dictionary<string, object>
            {
                ["FullName"] = oldFullName,
                ["Email"] = oldEmail,
                ["Role"] = oldRole,
                ["IsActive"] = oldIsActive
            };
            var newUser = new System.Collections.Generic.Dictionary<string, object>
            {
                ["FullName"] = user.FullName,
                ["Email"] = user.Email,
                ["Role"] = user.Role,
                ["IsActive"] = user.IsActive
            };
            var metadataJson = System.Text.Json.JsonSerializer.Serialize(new { old = oldUser, @new = newUser });

            await _auditLog.LogAsync("User", "Update", logMsg, actingAdminId, "Info", metadataJson);
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

            var smtpHost = await _sysConfig.GetAsync("smtp.host", _config["Email:SmtpHost"] ?? "smtp.gmail.com");
            var smtpPortRaw = await _sysConfig.GetAsync("smtp.port", _config["Email:SmtpPort"] ?? "587");
            var smtpPort = int.TryParse(smtpPortRaw.ToString(), out var sp) ? sp : 587;
            var smtpUsername = await _sysConfig.GetAsync("smtp.username", _config["Email:Username"] ?? "");
            var smtpPassword = await _sysConfig.GetAsync("smtp.password", _config["Email:Password"] ?? "");
            var smtpFromName = await _sysConfig.GetAsync("smtp.from_name", _config["Email:FromName"] ?? "StoryNest");
            var smtpFromAddress = await _sysConfig.GetAsync("smtp.from_address", _config["Email:FromAddress"] ?? smtpUsername);

            var vnPayPaymentUrl = await _sysConfig.GetAsync("vnpay.payment_url", _config["VnPay:PaymentUrl"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
            var vnPayTmnCode = await _sysConfig.GetAsync("vnpay.tmn_code", _config["VnPay:TmnCode"] ?? "");
            var vnPayHashSecret = await _sysConfig.GetAsync("vnpay.hash_secret", _config["VnPay:HashSecret"] ?? "");
            var vnPayReturnUrl = await _sysConfig.GetAsync("vnpay.return_url", _config["VnPay:ReturnUrl"] ?? "");

            return new SystemLimitsResponse
            {
                MaxUploadMb = maxUpload,
                MaxProjectsPerAuthor = maxProjects,
                MaintenanceMode = maintenance,
                TotalProjects = totalProjects,
                TotalChapters = totalChapters,
                TotalWordCount = totalWords,

                SmtpHost = smtpHost,
                SmtpPort = smtpPort,
                SmtpUsername = smtpUsername,
                SmtpPassword = smtpPassword,
                SmtpFromName = smtpFromName,
                SmtpFromAddress = smtpFromAddress,

                VnPayPaymentUrl = vnPayPaymentUrl,
                VnPayTmnCode = vnPayTmnCode,
                VnPayHashSecret = vnPayHashSecret,
                VnPayReturnUrl = vnPayReturnUrl
            };
        }

        public async Task<SystemLimitsResponse> UpdateSystemLimitsAsync(SystemLimitsRequest request, Guid adminId)
        {
            if (request.MaxUploadMb < 1 || request.MaxUploadMb > 100)
                throw new ArgumentException("max_upload_mb phải từ 1–100.");
            if (request.MaxProjectsPerAuthor < 1 || request.MaxProjectsPerAuthor > 500)
                throw new ArgumentException("max_projects_per_author phải từ 1–500.");

            var oldMaxUpload = await _sysConfig.GetAsync(KeyMaxUploadMb, 10);
            var oldMaxProjects = await _sysConfig.GetAsync(KeyMaxProjectsPerAuthor, 50);
            var oldMaintenance = await _sysConfig.GetAsync(KeyMaintenanceMode, false);

            var oldSmtpHost = await _sysConfig.GetAsync("smtp.host", _config["Email:SmtpHost"] ?? "smtp.gmail.com");
            var oldSmtpPortRaw = await _sysConfig.GetAsync("smtp.port", _config["Email:SmtpPort"] ?? "587");
            var oldSmtpPort = int.TryParse(oldSmtpPortRaw.ToString(), out var sp) ? sp : 587;
            var oldSmtpUsername = await _sysConfig.GetAsync("smtp.username", _config["Email:Username"] ?? "");
            var oldSmtpPassword = await _sysConfig.GetAsync("smtp.password", _config["Email:Password"] ?? "");
            var oldSmtpFromName = await _sysConfig.GetAsync("smtp.from_name", _config["Email:FromName"] ?? "StoryNest");
            var oldSmtpFromAddress = await _sysConfig.GetAsync("smtp.from_address", _config["Email:FromAddress"] ?? oldSmtpUsername);

            var oldVnPayPaymentUrl = await _sysConfig.GetAsync("vnpay.payment_url", _config["VnPay:PaymentUrl"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
            var oldVnPayTmnCode = await _sysConfig.GetAsync("vnpay.tmn_code", _config["VnPay:TmnCode"] ?? "");
            var oldVnPayHashSecret = await _sysConfig.GetAsync("vnpay.hash_secret", _config["VnPay:HashSecret"] ?? "");
            var oldVnPayReturnUrl = await _sysConfig.GetAsync("vnpay.return_url", _config["VnPay:ReturnUrl"] ?? "");

            await _sysConfig.SetAsync(KeyMaxUploadMb, request.MaxUploadMb, adminId);
            await _sysConfig.SetAsync(KeyMaxProjectsPerAuthor, request.MaxProjectsPerAuthor, adminId);
            await _sysConfig.SetAsync(KeyMaintenanceMode, request.MaintenanceMode, adminId);

            await _sysConfig.SetAsync("smtp.host", request.SmtpHost ?? "", adminId);
            await _sysConfig.SetAsync("smtp.port", request.SmtpPort.ToString(), adminId);
            await _sysConfig.SetAsync("smtp.username", request.SmtpUsername ?? "", adminId);
            await _sysConfig.SetAsync("smtp.password", request.SmtpPassword ?? "", adminId);
            await _sysConfig.SetAsync("smtp.from_name", request.SmtpFromName ?? "", adminId);
            await _sysConfig.SetAsync("smtp.from_address", request.SmtpFromAddress ?? "", adminId);

            await _sysConfig.SetAsync("vnpay.payment_url", request.VnPayPaymentUrl ?? "", adminId);
            await _sysConfig.SetAsync("vnpay.tmn_code", request.VnPayTmnCode ?? "", adminId);
            await _sysConfig.SetAsync("vnpay.hash_secret", request.VnPayHashSecret ?? "", adminId);
            await _sysConfig.SetAsync("vnpay.return_url", request.VnPayReturnUrl ?? "", adminId);

            var diffs = new System.Collections.Generic.List<string>();
            if (oldMaxUpload != request.MaxUploadMb) diffs.Add($"Dung lượng tải lên tối đa: {oldMaxUpload}MB -> {request.MaxUploadMb}MB");
            if (oldMaxProjects != request.MaxProjectsPerAuthor) diffs.Add($"Số dự án tối đa/tác giả: {oldMaxProjects} -> {request.MaxProjectsPerAuthor}");
            if (oldMaintenance != request.MaintenanceMode) diffs.Add($"Bảo trì: {oldMaintenance} -> {request.MaintenanceMode}");

            if (oldSmtpHost != request.SmtpHost) diffs.Add($"SMTP Host: '{oldSmtpHost}' -> '{request.SmtpHost}'");
            if (oldSmtpPort != request.SmtpPort) diffs.Add($"SMTP Port: {oldSmtpPort} -> {request.SmtpPort}");
            if (oldSmtpUsername != request.SmtpUsername) diffs.Add($"SMTP Username: '{oldSmtpUsername}' -> '{request.SmtpUsername}'");
            if (oldSmtpPassword != request.SmtpPassword) diffs.Add($"SMTP Password: '***' -> '***'");
            if (oldSmtpFromName != request.SmtpFromName) diffs.Add($"SMTP From Name: '{oldSmtpFromName}' -> '{request.SmtpFromName}'");
            if (oldSmtpFromAddress != request.SmtpFromAddress) diffs.Add($"SMTP From Address: '{oldSmtpFromAddress}' -> '{request.SmtpFromAddress}'");

            if (oldVnPayPaymentUrl != request.VnPayPaymentUrl) diffs.Add($"VNPay Url: '{oldVnPayPaymentUrl}' -> '{request.VnPayPaymentUrl}'");
            if (oldVnPayTmnCode != request.VnPayTmnCode) diffs.Add($"VNPay TmnCode: '{oldVnPayTmnCode}' -> '{request.VnPayTmnCode}'");
            if (oldVnPayHashSecret != request.VnPayHashSecret) diffs.Add($"VNPay HashSecret: '***' -> '***'");
            if (oldVnPayReturnUrl != request.VnPayReturnUrl) diffs.Add($"VNPay ReturnUrl: '{oldVnPayReturnUrl}' -> '{request.VnPayReturnUrl}'");

            var logMsg = "Cập nhật cấu hình hệ thống";
            if (diffs.Count > 0)
            {
                logMsg += $": [{string.Join(", ", diffs)}]";
            }
            else
            {
                logMsg += " (không thay đổi dữ liệu)";
            }

            var oldLimits = new System.Collections.Generic.Dictionary<string, object>
            {
                ["MaxUploadMb"] = oldMaxUpload,
                ["MaxProjectsPerAuthor"] = oldMaxProjects,
                ["MaintenanceMode"] = oldMaintenance,
                ["SmtpHost"] = oldSmtpHost,
                ["SmtpPort"] = oldSmtpPort,
                ["SmtpUsername"] = oldSmtpUsername,
                ["SmtpFromName"] = oldSmtpFromName,
                ["SmtpFromAddress"] = oldSmtpFromAddress,
                ["VnPayPaymentUrl"] = oldVnPayPaymentUrl,
                ["VnPayTmnCode"] = oldVnPayTmnCode,
                ["VnPayReturnUrl"] = oldVnPayReturnUrl
            };
            var newLimits = new System.Collections.Generic.Dictionary<string, object>
            {
                ["MaxUploadMb"] = request.MaxUploadMb,
                ["MaxProjectsPerAuthor"] = request.MaxProjectsPerAuthor,
                ["MaintenanceMode"] = request.MaintenanceMode,
                ["SmtpHost"] = request.SmtpHost ?? "",
                ["SmtpPort"] = request.SmtpPort,
                ["SmtpUsername"] = request.SmtpUsername ?? "",
                ["SmtpFromName"] = request.SmtpFromName ?? "",
                ["SmtpFromAddress"] = request.SmtpFromAddress ?? "",
                ["VnPayPaymentUrl"] = request.VnPayPaymentUrl ?? "",
                ["VnPayTmnCode"] = request.VnPayTmnCode ?? "",
                ["VnPayReturnUrl"] = request.VnPayReturnUrl ?? ""
            };
            var metadataJson = System.Text.Json.JsonSerializer.Serialize(new { old = oldLimits, @new = newLimits });

            await _auditLog.LogAsync("Config", "Limits", logMsg, adminId, "Info", metadataJson);

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

        // ── Staff Genre Specialization ────────────────────────────────────────────

        public async Task<List<UserSummaryDto>> GetAllStaffWithGenresAsync()
        {
            var staffUsers = await _context.Users
                .AsNoTracking()
                .Where(u => u.Role == "Staff")
                .OrderBy(u => u.FullName)
                .ToListAsync();

            var staffIds = staffUsers.Select(u => u.Id).ToList();
            var genreMap = await BuildGenreMapAsync(staffIds);

            return staffUsers.Select(u =>
            {
                var dto = MapSummary(u);
                if (genreMap.TryGetValue(u.Id, out var genres))
                    dto.Genres = genres;
                return dto;
            }).ToList();
        }

        public async Task<UserSummaryDto> GetStaffGenresAsync(Guid staffId)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == staffId)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");
            if (user.Role != "Staff")
                throw new InvalidOperationException("Chỉ Staff mới có thể loại chuyên môn.");

            var dto = MapSummary(user);
            var genreMap = await BuildGenreMapAsync(new List<Guid> { staffId });
            if (genreMap.TryGetValue(staffId, out var genres))
                dto.Genres = genres;
            return dto;
        }

        public async Task<UserSummaryDto> AssignStaffGenresAsync(Guid staffId, StaffGenreAssignRequest request, Guid adminId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == staffId)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");
            if (user.Role != "Staff")
                throw new InvalidOperationException("Chỉ có thể gán thể loại cho Staff.");

            // Validate genres exist
            if (request.GenreIds.Count > 0)
            {
                var validIds = await _context.Genres
                    .Where(g => request.GenreIds.Contains(g.Id))
                    .Select(g => g.Id)
                    .ToListAsync();
                var invalid = request.GenreIds.Except(validIds).ToList();
                if (invalid.Count > 0)
                    throw new ArgumentException($"Genre không hợp lệ: {string.Join(", ", invalid)}");
            }

            // Replace all — remove old, add new
            var existing = await _context.StaffGenres.Where(sg => sg.StaffId == staffId).ToListAsync();
            _context.StaffGenres.RemoveRange(existing);

            var now = DateTime.UtcNow;
            foreach (var genreId in request.GenreIds.Distinct())
            {
                _context.StaffGenres.Add(new Repository.Entities.StaffGenre
                {
                    StaffId = staffId,
                    GenreId = genreId,
                    AssignedAt = now,
                    AssignedBy = adminId
                });
            }

            await _context.SaveChangesAsync();
            await _auditLog.LogAsync("Staff", "AssignGenres",
                $"Gán {request.GenreIds.Count} thể loại cho staff {user.Email}", adminId);

            return await GetStaffGenresAsync(staffId);
        }

        private async Task<Dictionary<Guid, List<GenreResponse>>> BuildGenreMapAsync(List<Guid> staffIds)
        {
            if (staffIds.Count == 0)
                return new Dictionary<Guid, List<GenreResponse>>();

            return await _context.StaffGenres
                .AsNoTracking()
                .Where(sg => staffIds.Contains(sg.StaffId))
                .Include(sg => sg.Genre)
                .GroupBy(sg => sg.StaffId)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.OrderBy(sg => sg.Genre.Name)
                          .Select(sg => new GenreResponse
                          {
                              Id = sg.Genre.Id,
                              Name = sg.Genre.Name,
                              Slug = sg.Genre.Slug,
                              Color = sg.Genre.Color,
                              Description = sg.Genre.Description
                          }).ToList());
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

        public async Task<UserSummaryDto> BanUserAsync(Guid id, bool isBanned, string? reason, Guid actingAdminId)
        {
            if (id == actingAdminId)
                throw new InvalidOperationException("Bạn không thể tự khóa/mở khóa tài khoản của chính mình.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");

            if (isBanned && user.Role == "Admin")
                await EnsureAnotherAdminExistsAsync(id);

            user.IsBanned = isBanned;
            user.BanReason = isBanned ? reason : null;
            user.IsActive = !isBanned; // Automatically deactivate if banned, activate if unbanned

            // Clear request flags
            user.IsBanRequested = false;
            user.BanRequestReason = null;
            user.BanRequestedBy = null;

            if (isBanned)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
            }

            await _context.SaveChangesAsync();

            var logMsg = $"{(isBanned ? "Khóa" : "Mở khóa")} tài khoản user {user.Email}. Lý do: {reason ?? "Không có"}";
            await _auditLog.LogAsync("User", isBanned ? "Ban" : "Unban", logMsg, actingAdminId);

            return MapSummary(user);
        }

        private static UserSummaryDto MapSummary(User u) => new()
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Role = u.Role,
            IsActive = u.IsActive,
            CreatedAt = u.CreatedAt,
            StrikeCount = u.StrikeCount,
            IsBanned = u.IsBanned,
            BanReason = u.BanReason,
            IsBanRequested = u.IsBanRequested,
            BanRequestReason = u.BanRequestReason,
            BanRequestedBy = u.BanRequestedBy,
        };
    }
}
