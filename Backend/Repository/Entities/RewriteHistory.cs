namespace Repository.Entities
{
    /// <summary>
    /// Lưu lịch sử các lần viết lại đoạn văn bằng AI.
    /// OriginalText, RewrittenText và Instruction được encrypt bằng user DEK.
    /// </summary>
    public class RewriteHistory
    {
        public Guid Id { get; set; }

        /// <summary>FK → Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>FK → Chapters.Id (optional — có thể null nếu rewrite ngoài chapter)</summary>
        public Guid? ChapterId { get; set; }

        /// <summary>FK → Users.Id</summary>
        public Guid UserId { get; set; }

        /// <summary>Đoạn văn gốc (encrypted)</summary>
        public string OriginalText { get; set; } = string.Empty;

        /// <summary>Đoạn văn đã viết lại bởi AI (encrypted)</summary>
        public string RewrittenText { get; set; } = string.Empty;

        /// <summary>Hướng dẫn AI (prompt instruction, encrypted). Có thể rỗng.</summary>
        public string Instruction { get; set; } = string.Empty;

        /// <summary>Số token đã dùng (tổng input + output)</summary>
        public int TotalTokens { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public Project Project { get; set; } = null!;
        public Chapter? Chapter { get; set; }
        public User User { get; set; } = null!;
    }
}
