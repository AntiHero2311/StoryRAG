namespace Service.Interfaces
{
    public interface IAiChatService
    {
        /// <summary>
        /// Nhận câu hỏi của user, tìm context liên quan bằng vector search, gọi LLM, trả lời.
        /// </summary>
        Task<AiChatResult> ChatAsync(Guid projectId, string question, Guid userId);

        /// <summary>
        /// Lấy lịch sử chat của user trong một dự án, có phân trang.
        /// </summary>
        Task<ChatHistoryResult> GetChatHistoryAsync(Guid projectId, Guid userId, int page, int pageSize);
    }

    public class AiChatResult
    {
        public string Answer { get; set; } = string.Empty;
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
        public int TotalTokens { get; set; }
        public List<string> ContextChunks { get; set; } = new();
    }

    public class ChatHistoryItem
    {
        public Guid Id { get; set; }
        public string Question { get; set; } = string.Empty;
        public string Answer { get; set; } = string.Empty;
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
        public int TotalTokens { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ChatHistoryResult
    {
        public List<ChatHistoryItem> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
