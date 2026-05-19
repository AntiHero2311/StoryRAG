using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class StaffPerformanceResponse
    {
        public Guid StaffId { get; set; }
        public string StaffName { get; set; } = string.Empty;
        public int ReviewsThisMonth { get; set; }
        public int FeedbacksResolvedThisMonth { get; set; }
        public double? AvgFeedbackResponseHours { get; set; }
        public int OpenFeedbacksAssigned { get; set; }
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
