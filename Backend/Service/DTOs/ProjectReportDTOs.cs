namespace Service.DTOs
{
    // ─── Criterion detail ────────────────────────────────────────────────────────
    public class CriterionResult
    {
        public string Key { get; set; } = string.Empty;        // e.g. "1.1"
        public string GroupName { get; set; } = string.Empty;  // e.g. "Cốt truyện & Mạch lạc"
        public string CriterionName { get; set; } = string.Empty; // e.g. "Tính nhất quán nội bộ"
        public decimal Score { get; set; }
        public decimal MaxScore { get; set; }
        public string Feedback { get; set; } = string.Empty;
    }

    // ─── Group summary ───────────────────────────────────────────────────────────
    public class GroupResult
    {
        public string Name { get; set; } = string.Empty;
        public decimal Score { get; set; }
        public decimal MaxScore { get; set; }
        public List<CriterionResult> Criteria { get; set; } = new();
    }

    // ─── Full report response ────────────────────────────────────────────────────
    public class ProjectReportResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal TotalScore { get; set; }
        /// <summary>Cần sửa lớn | Trung bình | Khá | Xuất sắc</summary>
        public string Classification { get; set; } = string.Empty;
        public List<GroupResult> Groups { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    // ─── Summary item (for history list) ────────────────────────────────────────
    public class ProjectReportSummary
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal TotalScore { get; set; }
        public string Classification { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
