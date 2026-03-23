using System;

namespace Service.DTOs
{
    public class TimelineEventDto
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string Category { get; set; } = "Story";
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? TimeLabel { get; set; }
        public int SortOrder { get; set; }
        public string Importance { get; set; } = "Normal";
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateTimelineEventRequest
    {
        public string Category { get; set; } = "Story";
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? TimeLabel { get; set; }
        public int SortOrder { get; set; } = 0;
        public string Importance { get; set; } = "Normal";
    }

    public class UpdateTimelineEventRequest
    {
        public string? Category { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? TimeLabel { get; set; }
        public int? SortOrder { get; set; }
        public string? Importance { get; set; }
    }
}
