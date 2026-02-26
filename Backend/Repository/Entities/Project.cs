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

        /// <summary>Plain text — public CDN URL, not sensitive</summary>
        public string? CoverImageURL { get; set; }

        /// <summary>Draft | Published | Archived</summary>
        public string Status { get; set; } = "Draft";

        public bool IsDeleted { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public User Author { get; set; } = null!;
    }
}
