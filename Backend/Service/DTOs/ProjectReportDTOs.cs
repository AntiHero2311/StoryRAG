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
        /// <summary>Trích dẫn nguyên văn từ nội dung truyện làm bằng chứng cho nhận xét</summary>
        public string Evidence { get; set; } = string.Empty;
        /// <summary>So sánh nội dung đã viết với thông tin trong cẩm nang truyện (Story Bible)</summary>
        public string? BibleComparison { get; set; }
        /// <summary>Danh sách lỗi/vấn đề cụ thể được phát hiện trong văn bản</summary>
        public List<string> Errors { get; set; } = new();
        /// <summary>Danh sách gợi ý cải thiện có thể thực hiện ngay</summary>
        public List<string> Suggestions { get; set; } = new();

        /// <summary>Chỉ số chunk phẳng (thứ tự phân tích RAG) để gọi API lấy nội dung chunk gốc.</summary>
        public List<int>? EvidenceChunkOrdinals { get; set; }
    }

    /// <summary>Chunk đã giải mã trả về cho UI evidence (M2.1.4).</summary>
    public class EvidenceChunkItemDto
    {
        public Guid ChunkId { get; set; }
        public int Ordinal { get; set; }
        public int ChapterNumber { get; set; }
        public string ChapterTitle { get; set; } = string.Empty;
        public int ChunkIndex { get; set; }
        /// <summary>Ký tự bắt đầu của chunk trong nội dung chương (theo các chunk cùng version, đã giải mã).</summary>
        public int OffsetInChapterChars { get; set; }
        public string Content { get; set; } = string.Empty;
        public int TokenCount { get; set; }
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
        /// "SEXUAL_CONTENT"   — nội dung tình dục không phù hợp (explicit hoặc liên quan trẻ em)
        /// "ANTI_STATE"       — nội dung chính trị nhạy cảm, xuyên tạc, chống phá
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

    // ─── Content Analysis (Story Bible Extracted) ────────────────────────────────
    public class WorldSettingItem {
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Importance { get; set; } = string.Empty;
        public List<int> SourceChapters { get; set; } = new();
    }
    public class CharacterRelationshipItem {
        public string TargetName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }
    public class CharacterItem {
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Background { get; set; } = string.Empty;
        public List<string> Traits { get; set; } = new();
        public List<CharacterRelationshipItem> Relationships { get; set; } = new();
        public int FirstAppearance { get; set; }
    }
    public class TimelineEventItem {
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string TimeLabel { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Importance { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }
    public class ThemeItem {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Evidence { get; set; } = string.Empty;
    }
    public class ContentAnalysisResult {
        public List<WorldSettingItem> WorldSettings { get; set; } = new();
        public List<CharacterItem> Characters { get; set; } = new();
        public List<TimelineEventItem> TimelineEvents { get; set; } = new();
        public List<ThemeItem> Themes { get; set; } = new();
        public string AnalysisNote { get; set; } = string.Empty;
    }

    // ─── Emotion & Pacing ────────────────────────────────────────────────────────
    public class EmotionPacingResult {
        public List<PacingPoint> PacingPoints { get; set; } = new();
        public List<EmotionPoint> EmotionPoints { get; set; } = new();
        public List<CharacterFrequency> CharacterFrequencies { get; set; } = new();
        public List<CharacterPresenceSeries> CharacterPresence { get; set; } = new();
        public List<CharacterRelationshipEdge> CharacterRelationships { get; set; } = new();
        public List<string> Insights { get; set; } = new();
        public string OverallPacingProfile { get; set; } = string.Empty;
        public string DominantEmotionProfile { get; set; } = string.Empty;
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

        /// <summary>Hash snapshot của toàn bộ truyện tại thời điểm đánh giá</summary>
        public string ProjectVersionHash { get; set; } = string.Empty;

        public List<GroupResult> Groups { get; set; } = new();
        /// <summary>
        /// Cảnh báo đặc biệt ngoài rubric điểm (truyện chưa xong, lặp lại, đạo nhái...).
        /// Không ảnh hưởng TotalScore nhưng hiển thị riêng cho người dùng.
        /// </summary>
        public List<StoryWarning> Warnings { get; set; } = new();

        /// <summary>Nội dung phân tích Story Bible do AI trích xuất</summary>
        public ContentAnalysisResult? ContentAnalysis { get; set; }

        /// <summary>Biểu đồ phân tích Cảm xúc và Nhịp độ</summary>
        public EmotionPacingResult? EmotionPacing { get; set; }

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
        public string ProjectVersionHash { get; set; } = string.Empty;
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
        public string ProjectVersionHash { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }

    // ─── Snapshot Item ───────────────────────────────────────────────────────────
    public class ProjectReportSnapshotItem
    {
        public Guid Id { get; set; }
        public Guid ProjectReportId { get; set; }
        public int ChapterNumber { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty; // Đã giải mã
        public int WordCount { get; set; }
    }
}
