using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("SupportTickets")]
    public class SupportTicket
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }

        public Guid? AssignedStaffId { get; set; }

        /// <summary>Payment | Subscription | Usage | DataDeletion | Other</summary>
        [Required, MaxLength(30)]
        public string Category { get; set; } = "Other";

        [Required, MaxLength(200)]
        public string Subject { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        /// <summary>Open | InProgress | Resolved | Closed</summary>
        [Required, MaxLength(20)]
        public string Status { get; set; } = "Open";

        [MaxLength(3000)]
        public string? StaffReply { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        [ForeignKey(nameof(AssignedStaffId))]
        public User? AssignedStaff { get; set; }
    }
}
