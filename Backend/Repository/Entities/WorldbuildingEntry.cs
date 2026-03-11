using Pgvector;

namespace Repository.Entities
{
    public class WorldbuildingEntry
    {
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>AES-256 encrypted with user's DEK</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted with user's DEK</summary>
        public string Content { get; set; } = string.Empty;

        /// <summary>Plain text — World | Magic | History | Religion | Geography | Technology | Other</summary>
        public string Category { get; set; } = "Other";

        /// <summary>vector(768) embedding of "Title\n\nContent" — null until embedded</summary>
        public Vector? Embedding { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
    }
}
