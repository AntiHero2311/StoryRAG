using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    // ── Character Requests ─────────────────────────────────────────────────────

    public class CreateCharacterRequest
    {
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Role { get; set; } = "Supporting";

        [Required(AllowEmptyStrings = true)]
        public string Description { get; set; } = string.Empty;

        public string? Background { get; set; }

        public string? Notes { get; set; }
    }

    public class UpdateCharacterRequest
    {
        [MaxLength(255)]
        public string? Name { get; set; }

        [MaxLength(50)]
        public string? Role { get; set; }

        public string? Description { get; set; }

        public string? Background { get; set; }

        public string? Notes { get; set; }
    }

    // ── Character Response ─────────────────────────────────────────────────────

    public class CharacterResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Background { get; set; }
        public string? Notes { get; set; }
        public bool HasEmbedding { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CharacterRelationshipDto
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public Guid CharAId { get; set; }
        public Guid CharBId { get; set; }
        public string RelationType { get; set; } = string.Empty;
        public float StrengthScore { get; set; }
        public List<int>? EvidenceChunkIds { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CharacterRelationshipExtractResult
    {
        public int CandidatesConsidered { get; set; }
        public int PairsSentToAi { get; set; }
        public int Upserted { get; set; }
        public int SkippedNoEvidence { get; set; }
    }
}
