using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("StaffAnalysisReviews")]
    public class StaffAnalysisReview
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid ProjectReportId { get; set; }

        [Required]
        public Guid ProjectId { get; set; }

        [Required]
        public Guid AuthorId { get; set; }

        [Required]
        public Guid ReviewedBy { get; set; }

        [Required, MaxLength(20)]
        public string Action { get; set; } = "Verified";

        [MaxLength(2000)]
        public string? Note { get; set; }

        public Guid? RerunReportId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [ForeignKey(nameof(ProjectReportId))]
        public ProjectReport ProjectReport { get; set; } = null!;

        [ForeignKey(nameof(ProjectId))]
        public Project Project { get; set; } = null!;

        [ForeignKey(nameof(AuthorId))]
        public User Author { get; set; } = null!;

        [ForeignKey(nameof(ReviewedBy))]
        public User Reviewer { get; set; } = null!;

        [ForeignKey(nameof(RerunReportId))]
        public ProjectReport? RerunReport { get; set; }
    }
}
