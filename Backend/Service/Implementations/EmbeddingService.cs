using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Pgvector;
using Repository.Data;
using Service.Helpers;
using Service.Interfaces;
using System.Text.Json;
using System.Net.Http.Json;

namespace Service.Implementations
{
    public class EmbeddingService : IEmbeddingService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private readonly string _apiKey;
        private readonly string _model;

        public EmbeddingService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;

            _baseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            _apiKey = config["AI:ApiKey"] ?? "lm-studio";
            _model = config["AI:EmbeddingModel"] ?? "nomic-embed-text";

            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);
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

            // Decrypt content của từng chunk, thêm search_document: prefix cho nomic-embed-text-v1.5
            var plainTexts = chunks
                .Select(c => "search_document: " + EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
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
            // Thêm search_query: prefix cho nomic-embed-text-v1.5 (asymmetric retrieval)
            var res = await GetEmbeddingsForTextsAsync(new List<string> { "search_query: " + text });
            return res.First();
        }

        private async Task<List<float[]>> GetEmbeddingsForTextsAsync(List<string> texts)
        {
            var requestBody = new { model = _model, input = texts };
            var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/embeddings", requestBody);
            response.EnsureSuccessStatusCode();

            var jsonResult = await response.Content.ReadFromJsonAsync<JsonElement>();
            var dataArray = jsonResult.GetProperty("data").EnumerateArray().ToList();
            var embeddings = new List<float[]>();

            foreach (var item in dataArray)
            {
                var vectorArray = item.GetProperty("embedding").EnumerateArray().Select(x => x.GetSingle()).ToArray();
                embeddings.Add(vectorArray);
            }

            return embeddings;
        }
    }
}
