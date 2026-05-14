using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class NotificationCreateRequest
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(3000)]
        public string Message { get; set; } = string.Empty;

        [RegularExpression("^(success|error|info|warning)$")]
        public string Type { get; set; } = "info";

        [MaxLength(120)]
        public string? Tag { get; set; }

        public List<string>? TargetRoles { get; set; }
    }

    public class NotificationResponse
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid? CreatedByUserId { get; set; }
        public string? CreatedByName { get; set; }
        public string Type { get; set; } = "info";
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Tag { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }

    public class NotificationCreateResult
    {
        public int CreatedCount { get; set; }
    }
}
