using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("StaffKnowledgeBaseItems")]
    public class StaffKnowledgeBaseItem
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(20)]
        public string Type { get; set; } = "FAQ";

        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required, MaxLength(5000)]
        public string Content { get; set; } = string.Empty;

        [MaxLength(300)]
        public string? Tags { get; set; }

        public bool IsPublished { get; set; } = true;
        public int SortOrder { get; set; } = 0;

        [Required]
        public Guid CreatedBy { get; set; }

        public Guid? UpdatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [ForeignKey(nameof(CreatedBy))]
        public User Creator { get; set; } = null!;

        [ForeignKey(nameof(UpdatedBy))]
        public User? Updater { get; set; }
    }
}
