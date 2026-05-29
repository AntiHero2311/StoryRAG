using System;

namespace Repository.Entities
{
    public class ReportTimelineEvent
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ProjectReportId { get; set; }

        /// <summary>Historical | Story | Character | World | Other</summary>
        public string Category { get; set; } = "Story";

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted or plain time label, e.g. "Chương 1"</summary>
        public string? TimeLabel { get; set; }

        public int SortOrder { get; set; } = 0;

        /// <summary>Minor | Normal | Major | Critical</summary>
        public string Importance { get; set; } = "Normal";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ProjectReport ProjectReport { get; set; } = null!;
    }
}
