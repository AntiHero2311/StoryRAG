using System;
using System.ComponentModel.DataAnnotations;

namespace Repository.Entities
{
    public class TimelineEvent
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ProjectId { get; set; }
        public virtual Project? Project { get; set; }

        /// <summary>Category: Historical | Story | Character | World | Other</summary>
        public string Category { get; set; } = "Story";

        /// <summary>AES-256 encrypted event title</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted description</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>Display label for the time point, e.g. "Năm 432 TCN", "Tháng 3, Năm thứ 5", "Ngày 0"</summary>
        public string? TimeLabel { get; set; }

        /// <summary>Numeric sort order for timeline rendering</summary>
        public int SortOrder { get; set; } = 0;

        public string Importance { get; set; } = "Normal"; // Minor | Normal | Major | Critical

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
