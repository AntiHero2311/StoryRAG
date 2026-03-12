using System;
using System.Collections.Generic;

namespace Service.DTOs
{
    public class CreateBugReportRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        // Bug | UX | Feature | Other
        public string Category { get; set; } = "Bug";
        // Low | Medium | High
        public string Priority { get; set; } = "Medium";
    }

    public class UpdateBugReportRequest
    {
        // Open | InProgress | Resolved | Closed
        public string Status { get; set; } = "Open";
        public string? StaffNote { get; set; }
    }

    public class BugReportResponse
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string ReporterName { get; set; } = string.Empty;
        public string ReporterEmail { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? StaffNote { get; set; }
        public string? ResolvedByName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class BugReportStatsResponse
    {
        public int Total { get; set; }
        public int Open { get; set; }
        public int InProgress { get; set; }
        public int Resolved { get; set; }
        public int Closed { get; set; }
    }
}
