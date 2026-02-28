namespace Service.Interfaces
{
    public interface IEmbeddingService
    {
        /// <summary>
        /// Embed tất cả chunks của current version của chương, lưu vào DB, đặt IsEmbedded = true.
        /// </summary>
        Task EmbedChapterAsync(Guid chapterId, Guid userId);

        /// <summary>
        /// Lấy embedding vector cho một đoạn text (dùng để embed câu hỏi khi chat).
        /// </summary>
        Task<float[]> GetEmbeddingAsync(string text);
    }
}
