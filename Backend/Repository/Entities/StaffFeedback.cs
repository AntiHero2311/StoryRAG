using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("StaffFeedbacks")]
    public class StaffFeedback
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid ProjectId { get; set; }

        public Guid? ChapterId { get; set; }

        [Required]
        public Guid AuthorId { get; set; }

        [Required]
        public Guid StaffId { get; set; }

        [Required, MaxLength(3000)]
        public string Content { get; set; } = string.Empty;

        [Required, MaxLength(20)]
        public string Status { get; set; } = "Open";

        [MaxLength(3000)]
        public string? StaffNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [ForeignKey(nameof(ProjectId))]
        public Project Project { get; set; } = null!;

        [ForeignKey(nameof(ChapterId))]
        public Chapter? Chapter { get; set; }

        [ForeignKey(nameof(AuthorId))]
        public User Author { get; set; } = null!;

        [ForeignKey(nameof(StaffId))]
        public User Staff { get; set; } = null!;
    }
}
