using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    public class ChapterChunk
    {
        public Guid Id { get; set; }

        /// <summary>FK to ChapterVersions.Id</summary>
        public Guid VersionId { get; set; }

        /// <summary>FK to Projects.Id (denormalized để query nhanh)</summary>
        public Guid ProjectId { get; set; }

        /// <summary>Vị trí chunk trong version (0, 1, 2...)</summary>
        public int ChunkIndex { get; set; }

        /// <summary>AES-256 encrypted chunk content</summary>
        public string Content { get; set; } = string.Empty;

        /// <summary>Số token ước tính của chunk này</summary>
        public int TokenCount { get; set; } = 0;

        /// <summary>
        /// Vector embedding (1536 dims cho OpenAI text-embedding-3-small).
        /// [NotMapped] — column tồn tại trong DB qua SQL migration.
        /// Phase 2 sẽ dùng Pgvector.EntityFrameworkCore + value converter.
        /// </summary>
        [NotMapped]
        public float[]? Embedding { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ChapterVersion Version { get; set; } = null!;
        public Project Project { get; set; } = null!;
    }
}
