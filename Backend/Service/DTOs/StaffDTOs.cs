using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Service.DTOs
{
    /// <summary>Abuse / rate-limit flags cho staff (JSON keys theo spec issue).</summary>
    public class FlaggedProjectItem
    {
        [JsonPropertyName("project_id")]
        public Guid ProjectId { get; set; }

        [JsonPropertyName("author_email")]
        public string AuthorEmail { get; set; } = string.Empty;

        [JsonPropertyName("flag_reason")]
        public string FlagReason { get; set; } = string.Empty;

        [JsonPropertyName("flagged_at")]
        public DateTime FlaggedAt { get; set; }

        [JsonPropertyName("severity")]
        public string Severity { get; set; } = string.Empty;
    }

    public class FlaggedManuscriptItem
    {
        public Guid ProjectId { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public Guid AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string? LatestReportStatus { get; set; }
        public decimal? LatestScore { get; set; }
        public Guid? LatestReportId { get; set; }
        public string FlagReason { get; set; } = string.Empty;
        public DateTime LastUpdatedAt { get; set; }
    }

    /// <summary>POST /api/staff/feedback — body theo spec issue (project_id + message).</summary>
    public class StaffFeedbackCreateRequest : IValidatableObject
    {
        [JsonPropertyName("project_id")]
        public Guid? ProjectIdSnake { get; set; }

        /// <summary>JSON camelCase: projectId</summary>
        public Guid ProjectId { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }

        /// <summary>Tương thích body cũ dùng content.</summary>
        public string? Content { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            var pid = ProjectIdSnake is Guid g && g != Guid.Empty ? g : ProjectId;
            if (pid == Guid.Empty)
                yield return new ValidationResult("project_id là bắt buộc và phải là UUID hợp lệ.", new[] { nameof(ProjectId) });

            var text = !string.IsNullOrWhiteSpace(Message) ? Message.Trim() : (Content?.Trim() ?? string.Empty);
            if (text.Length == 0)
                yield return new ValidationResult("message không được để trống.", new[] { nameof(Message) });
            else if (text.Length > 3000)
                yield return new ValidationResult("message tối đa 3000 ký tự.", new[] { nameof(Message) });
        }
    }

    public class StaffFeedbackRequest
    {
        [Required]
        public Guid ProjectId { get; set; }

        public Guid? ChapterId { get; set; }

        [Required]
        [MinLength(5)]
        [MaxLength(3000)]
        public string Content { get; set; } = string.Empty;

        [MaxLength(3000)]
        public string? StaffNote { get; set; }

        [RegularExpression("^(Open|Resolved)$")]
        public string Status { get; set; } = "Open";
    }

    public class StaffFeedbackResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public Guid? ChapterId { get; set; }
        public Guid AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public Guid StaffId { get; set; }
        public string StaffName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? StaffNote { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }

    public class StaffContentRequest
    {
        [Required]
        [RegularExpression("^(FAQ|WritingTip)$")]
        public string Type { get; set; } = "FAQ";

        [Required]
        [MinLength(3)]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MinLength(10)]
        [MaxLength(5000)]
        public string Content { get; set; } = string.Empty;

        [MaxLength(300)]
        public string? Tags { get; set; }

        public bool IsPublished { get; set; } = true;
        public int SortOrder { get; set; } = 0;
    }

    public class StaffContentResponse
    {
        public Guid Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? Tags { get; set; }
        public bool IsPublished { get; set; }
        public int SortOrder { get; set; }
        public Guid CreatedBy { get; set; }
        public Guid? UpdatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class ReviewAnalysisRequest
    {
        [Required]
        [RegularExpression("^(Verified|Adjusted|RerunRequested)$")]
        public string Action { get; set; } = "Verified";

        [MaxLength(2000)]
        public string? Note { get; set; }
    }

    public class StaffAnalysisReviewResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectReportId { get; set; }
        public Guid ProjectId { get; set; }
        public Guid AuthorId { get; set; }
        public Guid ReviewedBy { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? Note { get; set; }
        public Guid? RerunReportId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class StaffPagedResponse<T>
    {
        public IReadOnlyList<T> Items { get; set; } = [];
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class StaffAnalysisJobItem
    {
        public Guid Id { get; set; }

        [JsonPropertyName("project_id")]
        public Guid ProjectId { get; set; }

        [JsonPropertyName("requested_by")]
        public Guid RequestedBy { get; set; }

        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("error_message")]
        public string? ErrorMessage { get; set; }

        [JsonPropertyName("started_at")]
        public DateTime? StartedAt { get; set; }

        [JsonPropertyName("last_heartbeat")]
        public DateTime? LastHeartbeat { get; set; }
    }

    // ─── Staff Report Edit DTOs ──────────────────────────────────────────────────

    /// <summary>
    /// Một tiêu chí mà staff muốn chỉnh sửa nội dung (feedback, errors, suggestions).
    /// Điểm số (Score) giữ nguyên theo AI, staff chỉ được sửa văn bản nhận xét.
    /// </summary>
    public class StaffCriterionEditItem
    {
        [Required]
        public string Key { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Feedback { get; set; }

        [MaxLength(2000)]
        public string? Evidence { get; set; }

        public List<string>? Errors { get; set; }
        public List<string>? Suggestions { get; set; }
    }

    /// <summary>
    /// Request body để staff chỉnh sửa report.
    /// Chỉ gửi các tiêu chí cần thay đổi — những tiêu chí không có trong list sẽ giữ nguyên AI output.
    /// </summary>
    public class StaffEditReportRequest
    {
        /// <summary>Các tiêu chí mà staff muốn override nội dung.</summary>
        [Required]
        public List<StaffCriterionEditItem> EditedCriteria { get; set; } = [];

        /// <summary>Sau khi edit xong có phát hành cho user không. Mặc định true.</summary>
        public bool ReleaseToUser { get; set; } = true;
    }

    /// <summary>
    /// Response khi staff lấy chi tiết một report để xem/chỉnh sửa.
    /// Bao gồm cả CriteriaJson gốc AI và StaffEditedCriteriaJson nếu đã có.
    /// </summary>
    public class StaffReportDetailResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? ReviewStatus { get; set; }
        public decimal TotalScore { get; set; }
        public string Classification { get; set; } = string.Empty;
        public string OverallFeedback { get; set; } = string.Empty;
        public string ProjectVersion { get; set; } = "v1.0.0";

        /// <summary>Criteria do AI tạo (không thay đổi)</summary>
        public string CriteriaJson { get; set; } = "[]";

        /// <summary>Criteria đã được staff chỉnh sửa. Null = chưa có staff edit.</summary>
        public string? StaffEditedCriteriaJson { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

