namespace Service.DTOs
{
    // ─── Criterion detail ────────────────────────────────────────────────────────
    public class CriterionResult
    {
        public string Key { get; set; } = string.Empty;           // e.g. "1.1"
        public string GroupName { get; set; } = string.Empty;     // e.g. "Cốt truyện & Cấu trúc"
        public string CriterionName { get; set; } = string.Empty; // e.g. "Diễn biến cốt truyện"
        public decimal Score { get; set; }
        public decimal MaxScore { get; set; }
        public string Feedback { get; set; } = string.Empty;
        /// <summary>Danh sách lỗi/vấn đề cụ thể được phát hiện trong văn bản</summary>
        public List<string> Errors { get; set; } = new();
        /// <summary>Danh sách gợi ý cải thiện có thể thực hiện ngay</summary>
        public List<string> Suggestions { get; set; } = new();
    }

    // ─── Group summary ───────────────────────────────────────────────────────────
    public class GroupResult
    {
        public string Name { get; set; } = string.Empty;
        public decimal Score { get; set; }
        public decimal MaxScore { get; set; }
        public List<CriterionResult> Criteria { get; set; } = new();
    }

    // ─── Special warning (ngoài rubric điểm) ────────────────────────────────────
    /// <summary>
    /// Cảnh báo chất lượng đặc biệt do AI phát hiện, không ảnh hưởng điểm rubric.
    /// Ví dụ: truyện chưa kết thúc, lặp lại nội dung, dấu hiệu đạo nhái.
    /// </summary>
    public class StoryWarning
    {
        /// <summary>
        /// Mã cảnh báo:
        /// "INCOMPLETE"       — truyện chưa có kết thúc / còn dở dang
        /// "REPETITION"       — lặp lại nội dung, cụm từ, tình tiết đáng kể
        /// "PLAGIARISM_RISK"  — nội dung giống tác phẩm đã biết, nghi đạo nhái
        /// "INCONSISTENCY"    — mâu thuẫn logic / nhân vật / bối cảnh
        /// "OTHER"            — vấn đề đặc biệt khác
        /// </summary>
        public string Code { get; set; } = string.Empty;
        /// <summary>Mức độ: "INFO" | "WARNING" | "CRITICAL"</summary>
        public string Severity { get; set; } = string.Empty;
        /// <summary>Tiêu đề ngắn gọn của cảnh báo</summary>
        public string Title { get; set; } = string.Empty;
        /// <summary>Mô tả chi tiết, có thể trích dẫn đoạn văn bản cụ thể</summary>
        public string Detail { get; set; } = string.Empty;
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
        
        /// <summary>Nhận xét tổng quan, đúc kết điểm mạnh/yếu của toàn bộ tác phẩm</summary>
        public string OverallFeedback { get; set; } = string.Empty;

        /// <summary>Phiên bản tác phẩm tại thời điểm được đánh giá</summary>
        public string ProjectVersion { get; set; } = "v1.0.0";

        public List<GroupResult> Groups { get; set; } = new();
        /// <summary>
        /// Cảnh báo đặc biệt ngoài rubric điểm (truyện chưa xong, lặp lại, đạo nhái...).
        /// Không ảnh hưởng TotalScore nhưng hiển thị riêng cho người dùng.
        /// </summary>
        public List<StoryWarning> Warnings { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    // ─── Summary item (for history list) ────────────────────────────────────────
    public class ProjectReportSummary
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal TotalScore { get; set; }
        public string Classification { get; set; } = string.Empty;
        public string ProjectVersion { get; set; } = "v1.0.0";
        public DateTime CreatedAt { get; set; }
    }

    // ─── Async analysis job ──────────────────────────────────────────────────────
    public class ProjectAnalysisJobResponse
    {
        public Guid JobId { get; set; }
        public Guid ProjectId { get; set; }
        public string Status { get; set; } = "Queued";
        public string Stage { get; set; } = "Queued";
        public int Progress { get; set; }
        public Guid? ReportId { get; set; }
        public string? ErrorMessage { get; set; }
        public bool IsExistingJob { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
}
