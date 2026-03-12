using Pgvector;

namespace Repository.Entities
{
    public class Project
    {
        public Guid Id { get; set; }

        /// <summary>FK to Users.Id</summary>
        public Guid AuthorId { get; set; }

        /// <summary>AES-256 encrypted with user's DEK</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted with user's DEK (nullable)</summary>
        public string? Summary { get; set; }

        /// <summary>AES-256 encrypted — tác giả dặn AI: tone, quy tắc, spoiler rules...</summary>
        public string? AiInstructions { get; set; }

        /// <summary>Plain text — public CDN URL, not sensitive</summary>
        public string? CoverImageURL { get; set; }

        /// <summary>Draft | Published | Archived</summary>
        public string Status { get; set; } = "Draft";

        public bool IsDeleted { get; set; } = false;

        /// <summary>vector(768) embedding of project Summary — null until summary is saved</summary>
        public Vector? SummaryEmbedding { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public User Author { get; set; } = null!;
        public ICollection<ProjectGenre> ProjectGenres { get; set; } = new List<ProjectGenre>();
    }
}
