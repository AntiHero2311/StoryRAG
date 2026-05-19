using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("AuthorAppeals")]
    public class AuthorAppeal
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid AuthorId { get; set; }

        [Required]
        public Guid ProjectId { get; set; }

        /// <summary>ProjectFlag | StaffFeedback | ReportReview</summary>
        [Required, MaxLength(30)]
        public string AppealType { get; set; } = "ProjectFlag";

        /// <summary>Id of ProjectAbuseFlag, StaffFeedback, or ProjectReport depending on type.</summary>
        public Guid? ReferenceId { get; set; }

        [Required, MaxLength(3000)]
        public string Reason { get; set; } = string.Empty;

        /// <summary>Pending | Approved | Rejected</summary>
        [Required, MaxLength(20)]
        public string Status { get; set; } = "Pending";

        public Guid? ReviewedByStaffId { get; set; }

        [MaxLength(3000)]
        public string? StaffNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        [ForeignKey(nameof(AuthorId))]
        public User Author { get; set; } = null!;

        [ForeignKey(nameof(ProjectId))]
        public Project Project { get; set; } = null!;

        [ForeignKey(nameof(ReviewedByStaffId))]
        public User? ReviewedByStaff { get; set; }
    }
}
