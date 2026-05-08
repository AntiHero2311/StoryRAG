using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("character_relationships")]
    public class CharacterRelationship
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid ProjectId { get; set; }

        [Required]
        public Guid CharAId { get; set; }

        [Required]
        public Guid CharBId { get; set; }

        /// <summary>Relationship type (enum-like string).</summary>
        [Required, MaxLength(50)]
        public string RelationType { get; set; } = "Other";

        public float StrengthScore { get; set; } = 0;

        /// <summary>Evidence chunk ordinals/ids (JSON array of ints).</summary>
        public List<int>? EvidenceChunkIds { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation (optional)
        [ForeignKey(nameof(ProjectId))]
        public Project Project { get; set; } = null!;

        [ForeignKey(nameof(CharAId))]
        public CharacterEntry CharA { get; set; } = null!;

        [ForeignKey(nameof(CharBId))]
        public CharacterEntry CharB { get; set; } = null!;
    }
}

