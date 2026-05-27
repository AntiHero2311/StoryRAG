namespace Repository.Entities
{
    public class ProjectReport
    {
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>FK to Users.Id</summary>
        public Guid UserId { get; set; }

        /// <summary>Pending | Completed | Failed | MockData</summary>
        public string Status { get; set; } = "Pending";

        /// <summary>Tổng điểm (0–100)</summary>
        public decimal TotalScore { get; set; }

        /// <summary>JSONB: array of criterion results do AI tạo ra (không thay đổi sau khi AI ghi)</summary>
        public string CriteriaJson { get; set; } = "[]";

        /// <summary>JSONB: Kết quả Story Bible (WorldSetting, Character, Timeline, Theme)</summary>
        public string? ContentAnalysisJson { get; set; }

        /// <summary>JSONB: Kết quả biểu đồ Cảm xúc và Nhịp độ</summary>
        public string? EmotionPacingJson { get; set; }


        /// <summary>
        /// JSONB: Staff có thể override nội dung criteria này.
        /// Khi null → frontend dùng CriteriaJson gốc của AI.
        /// Khi có giá trị → dùng JSON này thay thế (chỉ content text, điểm số không thay đổi).
        /// </summary>
        public string? StaffEditedCriteriaJson { get; set; }

        /// <summary>
        /// Trạng thái review của staff:
        /// null                   → dữ liệu cũ (backward-compatible), user vẫn thấy
        /// "PendingStaffReview"   → AI xong, đang chờ staff kiểm tra bước cuối
        /// "StaffReviewing"       → staff đang xem xét
        /// "Released"             → staff đã duyệt/chỉnh sửa và phát hành cho user
        /// </summary>
        public string? ReviewStatus { get; set; }

        /// <summary>Lưu lại phiên bản dự án lúc đánh giá (vd: v1.0.0)</summary>
        public string ProjectVersion { get; set; } = "v1.0.0";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
        public User User { get; set; } = null!;
        public ICollection<ReportItem> ReportItems { get; set; } = new List<ReportItem>();
        public ICollection<ProjectReportSnapshot> Snapshots { get; set; } = new List<ProjectReportSnapshot>();
    }
}
