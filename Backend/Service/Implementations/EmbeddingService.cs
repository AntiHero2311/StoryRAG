using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
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
        private readonly ILogger<EmbeddingService> _logger;

        // LM Studio (fallback)
        private readonly HttpClient _lmHttpClient;
        private readonly string _lmBaseUrl;
        private readonly string _lmModel;

        // Gemini (primary)
        private readonly HttpClient _geminiHttpClient;
        private readonly string _geminiApiKey;
        private readonly string _geminiModel;
        private readonly int _geminiEmbeddingDimensions;
        private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

        public EmbeddingService(AppDbContext context, IConfiguration config, ILogger<EmbeddingService> logger)
        {
            _context = context;
            _config = config;
            _logger = logger;

            // LM Studio config
            _lmBaseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var lmApiKey = config["AI:ApiKey"] ?? "lm-studio";
            _lmModel = config["AI:EmbeddingModel"] ?? "nomic-embed-text";
            _lmHttpClient = new HttpClient();
            _lmHttpClient.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", lmApiKey);

            // Gemini config
            _geminiApiKey = config["Gemini:EmbedApiKey"] ?? string.Empty;
            _geminiModel = config["Gemini:EmbeddingModel"] ?? "gemini-embedding-001";
            _geminiEmbeddingDimensions = int.TryParse(config["Gemini:EmbeddingDimensions"], out var dim) ? dim : 768;
            _geminiHttpClient = new HttpClient();
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

            var plainTexts = chunks
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
                .ToList();

            var embeddings = await GetEmbeddingsForTextsAsync(plainTexts, isDocument: true);

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
            var res = await GetEmbeddingsForTextsAsync(new List<string> { text }, isDocument: false);
            return res.First();
        }

        private async Task<List<float[]>> GetEmbeddingsForTextsAsync(List<string> texts, bool isDocument)
        {
            if (!string.IsNullOrEmpty(_geminiApiKey))
            {
                try
                {
                    return await GetGeminiEmbeddingsAsync(texts);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Gemini embedding thất bại. Không fallback vì vector space không tương thích với LM Studio.");
                    throw;
                }
            }

            // Không có Gemini key → dùng LM Studio với Nomic prefix
            var prefixedTexts = texts
                .Select(t => (isDocument ? "search_document: " : "search_query: ") + t)
                .ToList();
            return await GetLmStudioEmbeddingsAsync(prefixedTexts);
        }

        private async Task<List<float[]>> GetGeminiEmbeddingsAsync(List<string> texts)
        {
            // batchEmbedContents: toàn bộ chunks = 1 HTTP call duy nhất → tránh 429 free tier.
            // Gemini giới hạn 100 items/batch → nếu nhiều hơn thì chia thành nhiều batch nhỏ
            // với delay nhỏ giữa các batch để không vượt quota.
            const int MaxBatchSize = 100;
            const int DelayBetweenBatchesMs = 2000; // 2s — đủ an toàn cho free tier

            var allEmbeddings = new List<float[]>(texts.Count);

            for (int offset = 0; offset < texts.Count; offset += MaxBatchSize)
            {
                var batch = texts.Skip(offset).Take(MaxBatchSize).ToList();

                // Thêm delay giữa các batch (trừ batch đầu tiên)
                if (offset > 0)
                    await Task.Delay(DelayBetweenBatchesMs);

                var batchUrl = $"{GeminiBaseUrl}/{_geminiModel}:batchEmbedContents?key={_geminiApiKey}";
                var requests = batch.Select(text => new
                {
                    model = $"models/{_geminiModel}",
                    content = new { parts = new[] { new { text } } },
                    outputDimensionality = _geminiEmbeddingDimensions
                }).ToArray();

                var batchBody = new { requests };

                var response = await GeminiRetryHelper.ExecuteAsync(
                    () => _geminiHttpClient.PostAsJsonAsync(batchUrl, batchBody),
                    _logger, $"Gemini Embedding batch {offset / MaxBatchSize + 1}/{(int)Math.Ceiling((double)texts.Count / MaxBatchSize)}");

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini batchEmbedContents trả về {StatusCode}. URL: {Url}. Body: {Body}",
                        (int)response.StatusCode, batchUrl.Replace(_geminiApiKey, "***"), errorBody);
                    response.EnsureSuccessStatusCode();
                }

                var json = await response.Content.ReadFromJsonAsync<JsonElement>();
                var batchResult = json.GetProperty("embeddings")
                    .EnumerateArray()
                    .Select(e => e.GetProperty("values")
                        .EnumerateArray()
                        .Select(v => v.GetSingle())
                        .ToArray())
                    .ToList();

                allEmbeddings.AddRange(batchResult);
            }

            return allEmbeddings;
        }

        private async Task<List<float[]>> GetLmStudioEmbeddingsAsync(List<string> texts)
        {
            var requestBody = new { model = _lmModel, input = texts };
            var response = await _lmHttpClient.PostAsJsonAsync($"{_lmBaseUrl}/embeddings", requestBody);
            response.EnsureSuccessStatusCode();

            var jsonResult = await response.Content.ReadFromJsonAsync<JsonElement>();
            return jsonResult.GetProperty("data")
                .EnumerateArray()
                .Select(item => item.GetProperty("embedding").EnumerateArray().Select(x => x.GetSingle()).ToArray())
                .ToList();
        }
    }
}
