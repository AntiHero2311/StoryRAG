using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    // ── Worldbuilding Requests ─────────────────────────────────────────────────

    public class CreateWorldbuildingRequest
    {
        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [Required(AllowEmptyStrings = true)]
        public string Content { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Category { get; set; } = "Other";
    }

    public class UpdateWorldbuildingRequest
    {
        [MaxLength(255)]
        public string? Title { get; set; }

        public string? Content { get; set; }

        [MaxLength(50)]
        public string? Category { get; set; }
    }

    // ── Worldbuilding Response ─────────────────────────────────────────────────

    public class WorldbuildingResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public bool HasEmbedding { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
