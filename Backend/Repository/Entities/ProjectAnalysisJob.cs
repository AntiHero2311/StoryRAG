namespace Repository.Entities
{
    public class ProjectAnalysisJob
    {
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>FK to Users.Id</summary>
        public Guid UserId { get; set; }

        /// <summary>Queued | Processing | Completed | Failed | Cancelled</summary>
        public string Status { get; set; } = "Queued";

        /// <summary>Queued | Preparing | Analyzing | Saving | Completed | Failed | Cancelled</summary>
        public string Stage { get; set; } = "Queued";

        /// <summary>Tiến độ xử lý 0-100</summary>
        public int Progress { get; set; } = 0;

        /// <summary>Hash phiên bản project tại thời điểm enqueue để tránh tạo job trùng</summary>
        public string ProjectVersionHash { get; set; } = string.Empty;

        /// <summary>Report được tạo ra sau khi job hoàn thành</summary>
        public Guid? ReportId { get; set; }

        /// <summary>Lý do thất bại/cancel (nếu có)</summary>
        public string? ErrorMessage { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
        public User User { get; set; } = null!;
        public ProjectReport? Report { get; set; }
    }
}
