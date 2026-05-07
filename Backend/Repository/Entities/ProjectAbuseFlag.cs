namespace Repository.Entities;

/// <summary>
/// Bản ghi cờ tự động (ví dụ giới hạn tần suất AI) gắn với project/tác giả — staff xem qua API flagged-projects.
/// </summary>
public class ProjectAbuseFlag
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    /// <summary>User (tác giả) bị cờ tại thời điểm ghi nhận.</summary>
    public Guid UserId { get; set; }

    public string FlagReason { get; set; } = string.Empty;

    /// <summary>Warning | Critical</summary>
    public string Severity { get; set; } = "Warning";

    public DateTime FlaggedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public User User { get; set; } = null!;
}
