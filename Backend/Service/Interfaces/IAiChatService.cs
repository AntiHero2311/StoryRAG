namespace Service.Interfaces
{
    public interface IAiChatService
    {
        /// <summary>
        /// Nhận câu hỏi của user, tìm context liên quan bằng vector search, gọi LLM, trả lời.
        /// </summary>
        Task<AiChatResult> ChatAsync(Guid projectId, string question, Guid userId);
    }

    public class AiChatResult
    {
        public string Answer { get; set; } = string.Empty;
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
        public int TotalTokens { get; set; }
        public List<string> ContextChunks { get; set; } = new();
    }
}
