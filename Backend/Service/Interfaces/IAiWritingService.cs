namespace Service.Interfaces
{
    public interface IAiWritingService
    {
        /// <summary>
        /// Viết mới một chương dựa trên mô tả/hướng dẫn.
        /// </summary>
        Task<AiWritingResult> WriteNewAsync(Guid projectId, string instruction, Guid userId);

        /// <summary>
        /// Viết tiếp từ đoạn nội dung có sẵn.
        /// </summary>
        Task<AiWritingResult> ContinueWritingAsync(Guid projectId, string previousText, string instruction, Guid userId);

        /// <summary>
        /// Rà soát, trau chuốt lại văn bản như một editor.
        /// </summary>
        Task<AiWritingResult> PolishAsync(Guid projectId, string originalText, string instruction, Guid userId);

        /// <summary>
        /// Gợi ý tự động từ AI (tên truyện, nhân vật, bối cảnh...).
        /// </summary>
        Task<AiSuggestionResult> SuggestAsync(Guid projectId, string context, string targetType, Guid userId);
    }

    public class AiWritingResult
    {
        public string GeneratedText { get; set; } = string.Empty;
        public int TotalTokens { get; set; }
    }

    public class AiSuggestionResult
    {
        public List<string> Suggestions { get; set; } = new();
        public string Analysis { get; set; } = string.Empty;
        public int TotalTokens { get; set; }
    }
}
