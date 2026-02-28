using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    // ── Chapter Requests ───────────────────────────────────────────────────────

    public class CreateChapterRequest
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "ChapterNumber phải lớn hơn 0.")]
        public int ChapterNumber { get; set; }

        [MaxLength(255)]
        public string? Title { get; set; }

        [Required(AllowEmptyStrings = true)]
        public string Content { get; set; } = string.Empty;
    }

    /// <summary>Cập nhật chapter title + lưu in-place content vào version đang active.</summary>
    public class UpdateChapterRequest
    {
        [MaxLength(255)]
        public string? Title { get; set; }

        [Required(AllowEmptyStrings = true)]
        public string Content { get; set; } = string.Empty;
    }

    /// <summary>Tạo version mới (trống hoàn toàn) theo ý muốn của người dùng.</summary>
    public class CreateVersionRequest
    {
        [MaxLength(255)]
        public string? Title { get; set; }
    }

    /// <summary>Đổi tên version.</summary>
    public class UpdateVersionTitleRequest
    {
        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;
    }

    // ── Chapter Responses ──────────────────────────────────────────────────────

    public class ChapterResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public int ChapterNumber { get; set; }
        public string? Title { get; set; }
        public int WordCount { get; set; }
        public string Status { get; set; } = "Draft";
        public int CurrentVersionNum { get; set; }
        public Guid? CurrentVersionId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class ChapterDetailResponse : ChapterResponse
    {
        /// <summary>Nội dung đã decrypt của version đang active</summary>
        public string? Content { get; set; }
        public List<ChapterVersionSummary> Versions { get; set; } = new();
    }

    // ── ChapterVersion Responses ───────────────────────────────────────────────

    public class ChapterVersionSummary
    {
        public Guid Id { get; set; }
        public int VersionNumber { get; set; }
        public string? Title { get; set; }
        public int WordCount { get; set; }
        public int TokenCount { get; set; }
        public bool IsChunked { get; set; }
        public bool IsEmbedded { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
    }

    public class ChapterVersionDetailResponse : ChapterVersionSummary
    {
        /// <summary>Nội dung đã decrypt</summary>
        public string Content { get; set; } = string.Empty;
        public List<ChapterChunkResponse> Chunks { get; set; } = new();
    }

    // ── ChapterChunk Responses ─────────────────────────────────────────────────

    public class ChapterChunkResponse
    {
        public Guid Id { get; set; }
        public int ChunkIndex { get; set; }
        public string Content { get; set; } = string.Empty;
        public int TokenCount { get; set; }
        public bool HasEmbedding { get; set; }
    }
}
