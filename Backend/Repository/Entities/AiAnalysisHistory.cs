namespace Repository.Entities
{
    /// <summary>
    /// Lưu lịch sử các lần phân tích truyện bằng AI (Phân rã cảnh, Hạ hồi phân giải).
    /// OriginalText, ResultJson được encrypt bằng user DEK.
    /// </summary>
    public class AiAnalysisHistory
    {
        public Guid Id { get; set; }

        public Guid ProjectId { get; set; }

        public Guid? ChapterId { get; set; }

        public Guid UserId { get; set; }

        /// <summary>Loại phân tích: "Scenes" hoặc "Cliffhanger"</summary>
        public string AnalysisType { get; set; } = string.Empty;

        /// <summary>Đoạn văn gốc (encrypted)</summary>
        public string EncryptedContext { get; set; } = string.Empty;

        /// <summary>Kết quả phân tích JSON (encrypted)</summary>
        public string EncryptedResult { get; set; } = string.Empty;

        public int TotalTokens { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public Project Project { get; set; } = null!;
        public Chapter? Chapter { get; set; }
        public User User { get; set; } = null!;
    }
}
