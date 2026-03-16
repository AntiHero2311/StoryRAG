using Pgvector;
using System;
using System.ComponentModel.DataAnnotations;

namespace Repository.Entities
{
    public class ThemeEntry
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ProjectId { get; set; }
        public virtual Project? Project { get; set; }

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted using user's DEK</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted with user's DEK — miscellaneous notes (nullable)</summary>
        public string? Notes { get; set; }

        /// <summary>vector(768) embedding of "Title\nDescription\nNotes" — null until embedded</summary>
        public Vector? Embedding { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
