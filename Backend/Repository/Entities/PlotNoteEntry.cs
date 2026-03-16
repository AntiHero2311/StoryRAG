using Pgvector;
using System;
using System.ComponentModel.DataAnnotations;

namespace Repository.Entities
{
    public class PlotNoteEntry
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ProjectId { get; set; }
        public virtual Project? Project { get; set; }

        /// <summary>Expected values: Arc | Conflict | Foreshadowing | Twist | Climax | Resolution | Other</summary>
        public string Type { get; set; } = "Other";

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Content { get; set; } = string.Empty;

        /// <summary>vector(768) embedding of "Type\nTitle\nContent" — null until embedded</summary>
        public Vector? Embedding { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
