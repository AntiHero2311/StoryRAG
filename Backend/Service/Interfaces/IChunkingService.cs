namespace Service.Interfaces
{
    public interface IChunkingService
    {
        /// <summary>
        /// Chia plaintext content thành các chunks.
        /// Mỗi chunk khoảng chunkSize ký tự, với overlap để không mất context tại ranh giới.
        /// </summary>
        /// <param name="plainContent">Nội dung đã decrypt (plain text)</param>
        /// <param name="chunkSize">Số ký tự tối đa mỗi chunk (default 1500)</param>
        /// <param name="overlap">Số ký tự overlap giữa các chunk (default 150)</param>
        /// <returns>Danh sách các string chunk</returns>
        List<string> SplitIntoChunks(string plainContent, int chunkSize = 1500, int overlap = 150);

        /// <summary>
        /// Ước tính số token của một đoạn text (rule-of-thumb: 1 token ≈ 4 ký tự tiếng Anh, 2-3 ký tự tiếng Việt).
        /// </summary>
        int EstimateTokenCount(string text);
    }
}
