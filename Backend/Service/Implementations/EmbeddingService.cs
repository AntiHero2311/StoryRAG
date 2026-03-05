using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenAI;
using OpenAI.Embeddings;
using Pgvector;
using Repository.Data;
using Service.Helpers;
using Service.Interfaces;
using System.ClientModel;

namespace Service.Implementations
{
    public class EmbeddingService : IEmbeddingService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly EmbeddingClient _embeddingClient;

        public EmbeddingService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;

            var baseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var apiKey = config["AI:ApiKey"] ?? "lm-studio";
            var model = config["AI:EmbeddingModel"] ?? "nomic-embed-text";

            var options = new OpenAIClientOptions { Endpoint = new Uri(baseUrl) };
            _embeddingClient = new EmbeddingClient(model, new ApiKeyCredential(apiKey), options);
        }

        public async Task EmbedChapterAsync(Guid chapterId, Guid userId)
        {
            // Lấy chapter + xác minh ownership
            var chapter = await _context.Chapters
                .Include(c => c.Project)
                .FirstOrDefaultAsync(c => c.Id == chapterId && !c.IsDeleted)
                ?? throw new KeyNotFoundException("Chapter không tồn tại.");

            if (chapter.Project.AuthorId != userId)
                throw new UnauthorizedAccessException("Không có quyền truy cập chapter này.");

            if (!chapter.CurrentVersionId.HasValue)
                throw new InvalidOperationException("Chapter chưa có version nào.");

            var version = await _context.ChapterVersions
                .FirstOrDefaultAsync(v => v.Id == chapter.CurrentVersionId.Value)
                ?? throw new KeyNotFoundException("Version không tồn tại.");

            if (!version.IsChunked)
                throw new InvalidOperationException("Version chưa được chunk. Hãy chunk trước khi embed.");

            // Lấy tất cả chunks của version này
            var chunks = await _context.ChapterChunks
                .Where(c => c.VersionId == version.Id)
                .OrderBy(c => c.ChunkIndex)
                .ToListAsync();

            if (chunks.Count == 0)
                throw new InvalidOperationException("Không có chunk nào để embed.");

            // Decrypt DEK của user
            var user = await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("User không tồn tại.");
            var masterKey = _config["Security:MasterKey"]!;
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey ?? string.Empty, masterKey);

            // Decrypt content của từng chunk, gọi OpenAI để lấy embedding
            var plainTexts = chunks
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
                .ToList();

            var embeddings = await GetEmbeddingsForTextsAsync(plainTexts);

            // Lưu embedding vào từng chunk
            for (int i = 0; i < chunks.Count; i++)
            {
                chunks[i].Embedding = new Vector(embeddings[i]);
            }

            // Đánh dấu version đã embedded
            version.IsEmbedded = true;

            await _context.SaveChangesAsync();
        }

        public async Task<float[]> GetEmbeddingAsync(string text)
        {
            var result = await _embeddingClient.GenerateEmbeddingAsync(text);
            return result.Value.ToFloats().ToArray();
        }

        private async Task<List<float[]>> GetEmbeddingsForTextsAsync(List<string> texts)
        {
            // Gọi OpenAI batch embedding (tối đa 2048 inputs/request)
            var results = await _embeddingClient.GenerateEmbeddingsAsync(texts);
            return results.Value.OrderBy(e => e.Index).Select(e => e.ToFloats().ToArray()).ToList();
        }
    }
}
