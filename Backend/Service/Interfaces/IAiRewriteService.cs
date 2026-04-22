namespace Service.Interfaces
{
    public interface IAiRewriteService
    {
        /// <summary>
        /// Viết lại một đoạn văn bằng AI theo hướng dẫn tùy chọn. Lưu lịch sử.
        /// </summary>
        Task<RewriteResult> RewriteAsync(Guid projectId, Guid? chapterId, string originalText, string instruction, Guid userId);

        /// <summary>
        /// Lấy lịch sử viết lại của user trong một dự án.
        /// </summary>
        Task<RewriteHistoryResult> GetHistoryAsync(Guid projectId, Guid userId, string? actionType, Guid? chapterId, int page, int pageSize);
    }

    public class RewriteResult
    {
        public Guid HistoryId { get; set; }
        public string OriginalText { get; set; } = string.Empty;
        public string RewrittenText { get; set; } = string.Empty;
        public string Instruction { get; set; } = string.Empty;
        public int TotalTokens { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class RewriteHistoryItem
    {
        public Guid Id { get; set; }
        public Guid? ChapterId { get; set; }
        public string OriginalText { get; set; } = string.Empty;
        public string RewrittenText { get; set; } = string.Empty;
        public string Instruction { get; set; } = string.Empty;
        public string ActionType { get; set; } = string.Empty;
        public int TotalTokens { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class RewriteHistoryResult
    {
        public List<RewriteHistoryItem> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
