using System;
using System.Collections.Generic;

namespace Service.DTOs
{
    public class UserSummaryDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
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

        // ── Bug Reports ────────────────────────────────────────
        public int OpenBugReports { get; set; }
        public int InProgressBugReports { get; set; }
        public int ResolvedBugReports { get; set; }
        public int HighPriorityOpenBugs { get; set; }
    }
}
