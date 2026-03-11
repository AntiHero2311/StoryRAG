using Pgvector;

namespace Repository.Entities
{
    public class CharacterEntry
    {
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>AES-256 encrypted with user's DEK</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>Plain text — Protagonist | Antagonist | Supporting | Minor</summary>
        public string Role { get; set; } = "Supporting";

        /// <summary>AES-256 encrypted with user's DEK — appearance, personality</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted with user's DEK — backstory (nullable)</summary>
        public string? Background { get; set; }

        /// <summary>AES-256 encrypted with user's DEK — miscellaneous notes (nullable)</summary>
        public string? Notes { get; set; }

        /// <summary>vector(768) embedding of "Name\nRole\nDescription\nBackground" — null until embedded</summary>
        public Vector? Embedding { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
    }
}
