namespace Service.Interfaces
{
    public enum EmbeddingUseCase
    {
        Corpus,
        ChatQuery
    }

    public interface IEmbeddingService
    {
        /// <summary>
        /// Embed tất cả chunks của current version của chương, lưu vào DB, đặt IsEmbedded = true.
        /// </summary>
        Task EmbedChapterAsync(Guid chapterId, Guid userId);

        /// <summary>
        /// Lấy embedding vector cho một đoạn text theo use-case.
        /// </summary>
        Task<float[]> GetEmbeddingAsync(string text, EmbeddingUseCase useCase = EmbeddingUseCase.Corpus);
    }
}
