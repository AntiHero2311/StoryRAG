namespace Repository.Entities
{
    /// <summary>
    /// Normalised row for one rubric criterion inside a <see cref="ProjectReport"/>.
    /// EvidenceChunkIds stores the IDs of the ChapterChunks used as evidence for this item.
    /// </summary>
    public class ReportItem
    {
        public Guid Id { get; set; }

        /// <summary>FK to ProjectReports.Id</summary>
        public Guid ProjectReportId { get; set; }

        /// <summary>Criterion key, e.g. "1.1"</summary>
        public string Key { get; set; } = string.Empty;

        /// <summary>Group name, e.g. "Cốt truyện & Cấu trúc"</summary>
        public string GroupName { get; set; } = string.Empty;

        /// <summary>Criterion name, e.g. "Diễn biến cốt truyện"</summary>
        public string CriterionName { get; set; } = string.Empty;

        /// <summary>Điểm đạt được</summary>
        public decimal Score { get; set; }

        /// <summary>Điểm tối đa</summary>
        public decimal MaxScore { get; set; }

        /// <summary>Nhận xét của AI</summary>
        public string Feedback { get; set; } = string.Empty;

        /// <summary>Trích dẫn nguyên văn làm bằng chứng</summary>
        public string Evidence { get; set; } = string.Empty;

        /// <summary>So sánh với cẩm nang truyện (nếu có)</summary>
        public string? BibleComparison { get; set; }

        /// <summary>Danh sách lỗi/vấn đề cụ thể (jsonb)</summary>
        public string ErrorsJson { get; set; } = "[]";

        /// <summary>Danh sách gợi ý cải thiện (jsonb)</summary>
        public string SuggestionsJson { get; set; } = "[]";

        /// <summary>
        /// IDs of ChapterChunks used as evidence for this rubric item.
        /// Stored as a PostgreSQL integer array. Null for rows created before this column was added.
        /// </summary>
        public List<int>? EvidenceChunkIds { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ProjectReport ProjectReport { get; set; } = null!;
    }
}
