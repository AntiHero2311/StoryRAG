using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class CreateSupportTicketRequest
    {
        [Required]
        [RegularExpression("^(Payment|Subscription|Usage|DataDeletion|Other)$")]
        public string Category { get; set; } = "Other";

        [Required]
        [MinLength(3)]
        [MaxLength(200)]
        public string Subject { get; set; } = string.Empty;

        [Required]
        [MinLength(10)]
        [MaxLength(5000)]
        public string Description { get; set; } = string.Empty;
    }

    public class UpdateSupportTicketRequest
    {
        [RegularExpression("^(Open|InProgress|Resolved|Closed)$")]
        public string? Status { get; set; }

        [MaxLength(3000)]
        public string? StaffReply { get; set; }
    }

    public class SupportTicketResponse
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public Guid? AssignedStaffId { get; set; }
        public string? AssignedStaffName { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? StaffReply { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }

    public class CreateAuthorAppealRequest
    {
        [Required]
        public Guid ProjectId { get; set; }

        [Required]
        [RegularExpression("^(ProjectFlag|StaffFeedback|ReportReview)$")]
        public string AppealType { get; set; } = "ProjectFlag";

        public Guid? ReferenceId { get; set; }

        [Required]
        [MinLength(10)]
        [MaxLength(3000)]
        public string Reason { get; set; } = string.Empty;
    }

    public class ReviewAuthorAppealRequest
    {
        [Required]
        [RegularExpression("^(Approved|Rejected)$")]
        public string Status { get; set; } = "Approved";

        [MaxLength(3000)]
        public string? StaffNote { get; set; }
    }

    public class AuthorAppealResponse
    {
        public Guid Id { get; set; }
        public Guid AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public Guid ProjectId { get; set; }
        public string AppealType { get; set; } = string.Empty;
        public Guid? ReferenceId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Guid? ReviewedByStaffId { get; set; }
        public string? ReviewedByStaffName { get; set; }
        public string? StaffNote { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class StaffPerformanceResponse
    {
        public Guid StaffId { get; set; }
        public string StaffName { get; set; } = string.Empty;
        public int ReviewsThisMonth { get; set; }
        public int FeedbacksResolvedThisMonth { get; set; }
        public int AppealsReviewedThisMonth { get; set; }
        public int TicketsResolvedThisMonth { get; set; }
        public double? AvgFeedbackResponseHours { get; set; }
        public int OpenFeedbacksAssigned { get; set; }
        public int PendingAppeals { get; set; }
        public int OpenSupportTickets { get; set; }
    }

    public class ModerationWarnRequest
    {
        [Required]
        public Guid UserId { get; set; }

        public Guid? ProjectId { get; set; }

        [Required]
        [MinLength(10)]
        [MaxLength(2000)]
        public string Message { get; set; } = string.Empty;
    }

    public class ModerationSuspendProjectRequest
    {
        [Required]
        public Guid ProjectId { get; set; }

        [MaxLength(1000)]
        public string? Reason { get; set; }
    }

    public class ModerationRecommendBanRequest
    {
        [Required]
        public Guid UserId { get; set; }

        [Required]
        [MinLength(10)]
        [MaxLength(2000)]
        public string Reason { get; set; } = string.Empty;
    }
}
