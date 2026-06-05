using System;

namespace Repository.Entities
{
    public class ReportWorldbuildingEntry
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ProjectReportId { get; set; }

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Content { get; set; } = string.Empty;

        /// <summary>World | Magic | History | Religion | Geography | Technology | Other</summary>
        public string Category { get; set; } = "Other";

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string? Importance { get; set; }

        /// <summary>AES-256 encrypted using user's DEK (JSON array of chapter numbers)</summary>
        public string? SourceChaptersJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ProjectReport ProjectReport { get; set; } = null!;
    }
}
