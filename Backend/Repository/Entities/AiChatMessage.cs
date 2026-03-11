namespace Repository.Entities
{
    public class AiChatMessage
    {
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>FK to Users.Id</summary>
        public Guid UserId { get; set; }

        /// <summary>Câu hỏi của user (encrypted bằng user DEK)</summary>
        public string Question { get; set; } = string.Empty;

        /// <summary>Câu trả lời của AI (encrypted bằng user DEK)</summary>
        public string Answer { get; set; } = string.Empty;

        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
        public int TotalTokens { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public Project Project { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
