using Service.Interfaces;
using System.Text;

namespace Service.Implementations
{
    public class ChunkingService : IChunkingService
    {
        /// <summary>
        /// Chia text thành chunks với overlap.
        /// Ưu tiên cắt tại ranh giới đoạn văn (\n\n), rồi câu (. ! ?), rồi khoảng trắng.
        /// </summary>
        public List<string> SplitIntoChunks(string plainContent, int chunkSize = 1500, int overlap = 150)
        {
            if (string.IsNullOrWhiteSpace(plainContent))
                return new List<string>();

            var chunks = new List<string>();
            int start = 0;
            int length = plainContent.Length;

            while (start < length)
            {
                int end = Math.Min(start + chunkSize, length);

                // Nếu chưa tới cuối, tìm điểm cắt tự nhiên
                if (end < length)
                {
                    // Ưu tiên 1: cắt tại đoạn văn (\n\n)
                    int paragraphBreak = plainContent.LastIndexOf("\n\n", end, Math.Min(overlap * 2, end - start));
                    if (paragraphBreak > start)
                    {
                        end = paragraphBreak + 2;
                    }
                    else
                    {
                        // Ưu tiên 2: cắt tại cuối câu
                        int sentenceBreak = -1;
                        for (int i = end; i > Math.Max(start, end - overlap); i--)
                        {
                            char c = plainContent[i - 1];
                            if (c == '.' || c == '!' || c == '?' || c == '。' || c == '！' || c == '？')
                            {
                                sentenceBreak = i;
                                break;
                            }
                        }

                        if (sentenceBreak > start)
                        {
                            end = sentenceBreak;
                        }
                        else
                        {
                            // Ưu tiên 3: cắt tại khoảng trắng
                            int spaceBreak = plainContent.LastIndexOf(' ', end - 1, Math.Min(overlap, end - start));
                            if (spaceBreak > start)
                                end = spaceBreak + 1;
                        }
                    }
                }

                string chunk = plainContent[start..end].Trim();
                if (!string.IsNullOrWhiteSpace(chunk))
                    chunks.Add(chunk);

                // Di chuyển start, trừ đi overlap
                start = Math.Max(start + 1, end - overlap);
            }

            return chunks;
        }

        /// <summary>
        /// Ước tính token count: 1 token ≈ 3 ký tự (phù hợp với văn bản tiếng Việt mixed tiếng Anh).
        /// </summary>
        public int EstimateTokenCount(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            // Tiktoken rule-of-thumb: ~3 chars per token cho tiếng Việt (UTF-8 multi-byte heavy)
            return (int)Math.Ceiling(text.Length / 3.0);
        }
    }
}
