using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("BugReports")]
    public class BugReport
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        // Bug | UX | Feature | Other
        [Required, MaxLength(30)]
        public string Category { get; set; } = "Bug";

        // Low | Medium | High
        [Required, MaxLength(20)]
        public string Priority { get; set; } = "Medium";

        // Open | InProgress | Resolved | Closed
        [Required, MaxLength(20)]
        public string Status { get; set; } = "Open";

        [MaxLength(1000)]
        public string? StaffNote { get; set; }

        public Guid? ResolvedById { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        [ForeignKey(nameof(ResolvedById))]
        public User? ResolvedBy { get; set; }
    }
}
