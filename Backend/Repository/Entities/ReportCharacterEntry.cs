using System;

namespace Repository.Entities
{
    public class ReportCharacterEntry
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ProjectReportId { get; set; }

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>Protagonist | Antagonist | Supporting | Minor</summary>
        public string Role { get; set; } = "Supporting";

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string? Background { get; set; }

        /// <summary>AES-256 encrypted using user's DEK (JSON array of strings)</summary>
        public string? TraitsJson { get; set; }

        /// <summary>AES-256 encrypted using user's DEK (JSON array of relationships)</summary>
        public string? RelationshipsJson { get; set; }

        public int? FirstAppearance { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ProjectReport ProjectReport { get; set; } = null!;
    }
}
