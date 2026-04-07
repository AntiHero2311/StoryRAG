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

        /// <summary>
        /// Phân rã nội dung chương thành danh sách các Cảnh (Scenes/Beats).
        /// AI đọc nội dung và chia tách thành các phân cảnh rõ ràng.
        /// </summary>
        Task<AiSceneAnalysisResult> AnalyzeScenesAsync(Guid projectId, string chapterContent, Guid userId);

        /// <summary>
        /// Phân tích cấu trúc 3 hồi và phát hiện điểm Hạ hồi phân giải (Cliffhanger) của chương.
        /// </summary>
        Task<AiCliffhangerResult> AnalyzeCliffhangerAsync(Guid projectId, string chapterContent, Guid userId);
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

    /// <summary>Kết quả phân rã nội dung chương thành các Cảnh</summary>
    public class AiSceneAnalysisResult
    {
        /// <summary>Tóm tắt chung về cấu trúc chương</summary>
        public string ChapterSummary { get; set; } = string.Empty;
        /// <summary>Danh sách các phân cảnh được phát hiện</summary>
        public List<SceneItem> Scenes { get; set; } = new();
        public int TotalTokens { get; set; }
    }

    public class SceneItem
    {
        /// <summary>Tên cảnh ngắn gọn (vd: "Buổi gặp gỡ đầu tiên")</summary>
        public string Title { get; set; } = string.Empty;
        /// <summary>Mô tả nội dung & tác dụng của cảnh này trong cốt truyện</summary>
        public string Description { get; set; } = string.Empty;
        /// <summary>Trích dẫn CÂU VĂN GỐC DÀI VÀ QUAN TRỌNG lấy chính xác từ bài viết để highlight cảnh</summary>
        public string ExactQuote { get; set; } = string.Empty;
        /// <summary>Loại cảnh: Action / Dialogue / Introspection / Transition / Revelation</summary>
        public string Type { get; set; } = "Action";
    }

    /// <summary>Kết quả phân tích cấu trúc hồi và Cliffhanger</summary>
    public class AiCliffhangerResult
    {
        /// <summary>Có kết thúc cliffhanger rõ ràng không?</summary>
        public bool HasCliffhanger { get; set; }
        /// <summary>Điểm rơi/đỉnh căng thẳng (cliffhanger) là gì?</summary>
        public string CliffhangerDescription { get; set; } = string.Empty;
        /// <summary>Câu văn/đoạn văn chính tạo ra cliffhanger</summary>
        public string CliffhangerQuote { get; set; } = string.Empty;
        /// <summary>Phần setup (hồi 1) - thiết lập bối cảnh</summary>
        public string ActSetup { get; set; } = string.Empty;
        /// <summary>Phần rising action / conflict (hồi 2) - xây dựng mâu thuẫn</summary>
        public string ActConflict { get; set; } = string.Empty;
        /// <summary>Phần climax / resolution (hồi 3) - cao trào hoặc kết thúc</summary>
        public string ActClimax { get; set; } = string.Empty;
        /// <summary>Nhận xét tổng thể về cấu trúc chương</summary>
        public string StructureFeedback { get; set; } = string.Empty;
        public int TotalTokens { get; set; }
    }
}
