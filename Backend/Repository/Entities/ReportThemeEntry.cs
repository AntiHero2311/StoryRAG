using System;

namespace Repository.Entities
{
    public class ReportThemeEntry
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ProjectReportId { get; set; }

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string? Evidence { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ProjectReport ProjectReport { get; set; } = null!;
    }
}
