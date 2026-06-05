using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class AdminCreateUserRequest
    {
        [Required, MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(6)]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = "Author";
    }

    public class SetUserActiveRequest
    {
        public bool IsActive { get; set; }
    }

    public class AdminUpdateUserRequest
    {
        [Required, MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = "Author";

        public bool IsActive { get; set; } = true;

        [MinLength(6)]
        public string? NewPassword { get; set; }
    }

    public class UserSummaryDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public int StrikeCount { get; set; }
        public bool IsBanned { get; set; }
        public string? BanReason { get; set; }
        public bool IsBanRequested { get; set; }
        public string? BanRequestReason { get; set; }
        public Guid? BanRequestedBy { get; set; }

        /// <summary>Chỉ có giá trị với Staff — danh sách thể loại chuyên môn.</summary>
        public List<GenreResponse> Genres { get; set; } = new();
    }

    public class BanUserRequest
    {
        public bool IsBanned { get; set; }
        public string? BanReason { get; set; }
    }

    public class UserStatsResponse
    {
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int InactiveUsers { get; set; }
        public int TotalAuthors { get; set; }
        public int TotalStaff { get; set; }
        public int TotalAdmins { get; set; }
        public List<UserSummaryDto> Users { get; set; } = new();
    }

    /// <summary>Body để admin gán/thay thế toàn bộ genres cho một Staff.</summary>
    public class StaffGenreAssignRequest
    {
        /// <summary>Danh sách GenreId muốn gán (rỗng = bỏ hết).</summary>
        public List<int> GenreIds { get; set; } = new();
    }

    public class AdminOverviewStats
    {
        // ── Users ──────────────────────────────────────────────
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int NewUsersLast7Days { get; set; }
        public int NewUsersLast30Days { get; set; }
        public int TotalAuthors { get; set; }
        public int TotalStaff { get; set; }
        public int TotalAdmins { get; set; }

        // ── Content ────────────────────────────────────────────
        public int TotalProjects { get; set; }
        public int TotalChapters { get; set; }
        public long TotalWordCount { get; set; }
        public int TotalCharacters { get; set; }
        public int TotalWorldbuildingEntries { get; set; }

        // ── AI Usage ───────────────────────────────────────────
        public long TotalAiTokens { get; set; }
        public int TotalAiChatMessages { get; set; }
        public int TotalAiAnalyses { get; set; }

        // ── Subscriptions ──────────────────────────────────────
        public int ActiveSubscriptions { get; set; }
        public int ExpiredSubscriptions { get; set; }
        public int CancelledSubscriptions { get; set; }
        public int SuccessfulPayments { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal RevenueLast7Days { get; set; }
        public decimal RevenueLast30Days { get; set; }

        // ── Bug Reports ────────────────────────────────────────
        public int OpenBugReports { get; set; }
        public int InProgressBugReports { get; set; }
        public int ResolvedBugReports { get; set; }
        public int HighPriorityOpenBugs { get; set; }
    }

    public class PlanRevenueItemDto
    {
        public int PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public decimal Revenue { get; set; }
        public int OrderCount { get; set; }
    }

    public class MonthlyRevenueItemDto
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public string Label { get; set; } = string.Empty;
        public decimal Revenue { get; set; }
        public int OrderCount { get; set; }
        public decimal? GrowthPercent { get; set; }
    }

    public class AdminRevenueDashboardResponse
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal SelectedMonthRevenue { get; set; }
        public int TotalCompletedOrders { get; set; }
        public int SelectedMonthOrders { get; set; }
        public decimal? RevenueGrowthPercent { get; set; }
        public decimal PaymentSuccessRate { get; set; }
        public List<PlanRevenueItemDto> RevenueByPlan { get; set; } = new();
        public List<MonthlyRevenueItemDto> MonthlyTrend { get; set; } = new();
        public List<PlanRevenueItemDto> Plans { get; set; } = new();
    }
}
