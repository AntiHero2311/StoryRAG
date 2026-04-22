using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pgvector;
using Repository.Data;
using Service.Helpers;
using Service.Interfaces;
using System.Text.Json;
using System.Net.Http.Json;
using System.Text;

namespace Service.Implementations
{
    public class EmbeddingService : IEmbeddingService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly ILogger<EmbeddingService> _logger;

        // Gemini embeddings (required)
        private readonly HttpClient _geminiHttpClient;
        private readonly string? _embeddingApiKey;
        private readonly string? _analyzeApiKey;
        private readonly string? _chatApiKey;
        private readonly string _geminiModel;
        private readonly int _geminiEmbeddingDimensions;
        private readonly int _targetEmbeddingTpm;
        private readonly int _targetEmbeddingRpm;
        private readonly int _maxBatchSize;
        private readonly int _maxBatchEstimatedTokens;
        private readonly int _interBatchDelayMs;
        private readonly int _maxEmbeddingTextChars;
        private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
        private static readonly SemaphoreSlim EmbeddingQuotaLock = new(1, 1);
        private static DateTime _quotaWindowStartUtc = DateTime.UtcNow;
        private static int _usedTokensInWindow;
        private static int _usedRequestsInWindow;

        // Chống xung đột: không cho phép 2 task cùng embed 1 chapter cùng lúc
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, byte> ProcessingChapters = new();

        public EmbeddingService(AppDbContext context, IConfiguration config, ILogger<EmbeddingService> logger)
        {
            _context = context;
            _config = config;
            _logger = logger;

            // Gemini config
            _embeddingApiKey = NormalizeKey(config["Gemini:EmbeddingApiKey"]);
            _analyzeApiKey = NormalizeKey(config["Gemini:AnalyzeApiKey"]);
            _chatApiKey = NormalizeKey(config["Gemini:ChatApiKey"]);
            _geminiModel = config["Gemini:EmbeddingModel"] ?? "gemini-embedding-001";
            _geminiEmbeddingDimensions = int.TryParse(config["Gemini:EmbeddingDimensions"], out var dim) ? dim : 768;
            var tpmLimit = ReadInt(config["Gemini:EmbeddingTpmLimit"], 30000, min: 1000);
            var rpmLimit = ReadInt(config["Gemini:EmbeddingRpmLimit"], 100, min: 1);
            var usageRatio = ReadDouble(config["Gemini:EmbeddingUsageRatio"], 0.7, min: 0.1, max: 1.0);
            _targetEmbeddingTpm = Math.Max(1, (int)Math.Floor(tpmLimit * usageRatio));
            _targetEmbeddingRpm = Math.Max(1, (int)Math.Floor(rpmLimit * usageRatio));
            _maxBatchSize = ReadInt(config["Gemini:EmbeddingMaxBatchSize"], 20, min: 1, max: 100);
            var configuredBatchTokens = ReadInt(config["Gemini:EmbeddingMaxBatchEstimatedTokens"], 6000, min: 500);
            _maxBatchEstimatedTokens = Math.Min(configuredBatchTokens, _targetEmbeddingTpm);
            _interBatchDelayMs = ReadInt(config["Gemini:EmbeddingInterBatchDelayMs"], 1200, min: 0);
            _maxEmbeddingTextChars = ReadInt(config["Gemini:EmbeddingMaxTextChars"], 5000, min: 500);
            _geminiHttpClient = new HttpClient();
        }

        public async Task EmbedChapterAsync(Guid chapterId, Guid userId)
        {
            if (!ProcessingChapters.TryAdd(chapterId, 0))
            {
                _logger.LogWarning("Chương {ChapterId} đang được nhúng dữ liệu bởi một tiến trình khác. Bỏ qua yêu cầu này.", chapterId);
                return;
            }

            try
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
                .Select(t => EnsureEmbeddingPrefix(t, isDocument: true))
                .ToList();

                var embeddings = await GetEmbeddingsForTextsAsync(plainTexts, EmbeddingUseCase.Corpus);

                // Reload lại version và chunks để tránh DbUpdateConcurrencyException sau thời gian gọi API lâu
                _context.Entry(version).State = EntityState.Detached;
                var latestVersion = await _context.ChapterVersions
                    .Include(v => v.Chunks)
                    .FirstOrDefaultAsync(v => v.Id == version.Id);

                if (latestVersion == null || latestVersion.UpdatedAt > version.UpdatedAt)
                {
                    _logger.LogWarning("Nội dung chương {ChapterId} đã thay đổi trong khi đang tạo embedding. Hủy lưu kết quả cũ.", chapterId);
                    return;
                }

                // Lưu embedding vào từng chunk
                var latestChunks = latestVersion.Chunks.OrderBy(c => c.ChunkIndex).ToList();
                if (latestChunks.Count != embeddings.Count)
                {
                    _logger.LogWarning("Số lượng chunk của chương {ChapterId} đã thay đổi. Không thể map embedding.", chapterId);
                    return;
                }

                for (int i = 0; i < latestChunks.Count; i++)
                {
                    latestChunks[i].Embedding = new Vector(embeddings[i]);
                }

                // Đánh dấu version đã embedded
                latestVersion.IsEmbedded = true;

                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    _logger.LogWarning("Xung đột dữ liệu khi lưu Embedding cho chương {ChapterId}. Có tiến trình khác đã cập nhật trước.", chapterId);
                }
            }
            finally
            {
                ProcessingChapters.TryRemove(chapterId, out _);
            }
        }

        public async Task<float[]> GetEmbeddingAsync(string text, EmbeddingUseCase useCase = EmbeddingUseCase.Corpus)
        {
            var prepared = EnsureEmbeddingPrefix(text, isDocument: false);
            var res = await GetEmbeddingsForTextsAsync(new List<string> { prepared }, useCase);
            return res.First();
        }

        private async Task<List<float[]>> GetEmbeddingsForTextsAsync(List<string> texts, EmbeddingUseCase useCase)
        {
            var orderedKeys = GetKeysForUseCase(useCase);
            if (orderedKeys.Count == 0)
            {
                throw new InvalidOperationException(
                    "Thiếu Gemini embed key. Hãy set Gemini__EmbeddingApiKey (khuyến nghị) hoặc Gemini__AnalyzeApiKey/Gemini__ChatApiKey.");
            }

            try
            {
                return await GetGeminiEmbeddingsAsync(texts, orderedKeys);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gemini embedding thất bại.");
                throw;
            }
        }

        private async Task<List<float[]>> GetGeminiEmbeddingsAsync(List<string> texts, IReadOnlyList<string> orderedKeys)
        {
            var batches = BuildBatches(texts);
            var allEmbeddings = new List<float[]>(texts.Count);

            for (int batchIndex = 0; batchIndex < batches.Count; batchIndex++)
            {
                var batch = batches[batchIndex];
                var operationName = $"Gemini Embedding batch {batchIndex + 1}/{batches.Count}";
                await ReserveEmbeddingQuotaAsync(batch.EstimatedTokens, operationName);
                var requests = batch.Texts.Select(text => new
                {
                    model = $"models/{_geminiModel}",
                    content = new { parts = new[] { new { text } } },
                    outputDimensionality = _geminiEmbeddingDimensions
                }).ToArray();

                var batchBody = new { requests };
                using var response = await SendBatchWithKeyFailoverAsync(batchBody, operationName, orderedKeys);
                var json = await response.Content.ReadFromJsonAsync<JsonElement>();
                var batchResult = json.GetProperty("embeddings")
                    .EnumerateArray()
                    .Select(e => e.GetProperty("values")
                        .EnumerateArray()
                        .Select(v => v.GetSingle())
                        .ToArray())
                    .ToList();

                if (batchResult.Count != batch.Texts.Count)
                    throw new InvalidOperationException($"Gemini embedding trả về {batchResult.Count} vectors, expected {batch.Texts.Count}.");

                allEmbeddings.AddRange(batchResult);

                if (batchIndex < batches.Count - 1 && _interBatchDelayMs > 0)
                    await Task.Delay(_interBatchDelayMs);
            }

            return allEmbeddings;
        }

        private async Task<HttpResponseMessage> SendBatchWithKeyFailoverAsync(
            object batchBody,
            string operationName,
            IReadOnlyList<string> keys)
        {
            Exception? lastError = null;

            for (var i = 0; i < keys.Count; i++)
            {
                var key = keys[i];
                var keyLabel = $"key {i + 1}/{keys.Count}";
                var batchUrl = $"{GeminiBaseUrl}/{_geminiModel}:batchEmbedContents?key={key}";

                try
                {
                    var response = await GeminiRetryHelper.ExecuteAsync(
                        () => _geminiHttpClient.PostAsJsonAsync(batchUrl, batchBody),
                        _logger,
                        $"{operationName} ({keyLabel})");

                    if (response.IsSuccessStatusCode)
                        return response;

                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning(
                        "{Operation} thất bại với {KeyLabel}: {StatusCode}. Body: {Body}",
                        operationName,
                        keyLabel,
                        (int)response.StatusCode,
                        errorBody);

                    response.Dispose();
                    lastError = new HttpRequestException(
                        $"Gemini embedding failed with status {(int)response.StatusCode}.",
                        null,
                        response.StatusCode);
                }
                catch (Exception ex)
                {
                    lastError = ex;
                    _logger.LogWarning(ex, "{Operation} lỗi với {KeyLabel}, thử key khác.", operationName, keyLabel);
                }
            }

            throw lastError ?? new InvalidOperationException("Gemini embedding failed for all configured keys.");
        }

        private List<EmbeddingBatch> BuildBatches(List<string> texts)
        {
            var batches = new List<EmbeddingBatch>();
            var currentTexts = new List<string>();
            var currentEstimatedTokens = 0;

            foreach (var rawText in texts)
            {
                var normalized = NormalizeEmbeddingText(rawText);
                var estimatedTokens = EstimateTokens(normalized);
                var isCurrentBatchFullByCount = currentTexts.Count >= _maxBatchSize;
                var isCurrentBatchFullByTokens = currentEstimatedTokens + estimatedTokens > _maxBatchEstimatedTokens;

                if (currentTexts.Count > 0 && (isCurrentBatchFullByCount || isCurrentBatchFullByTokens))
                {
                    batches.Add(new EmbeddingBatch(currentTexts, currentEstimatedTokens));
                    currentTexts = new List<string>();
                    currentEstimatedTokens = 0;
                }

                currentTexts.Add(normalized);
                currentEstimatedTokens += estimatedTokens;
            }

            if (currentTexts.Count > 0)
                batches.Add(new EmbeddingBatch(currentTexts, currentEstimatedTokens));

            return batches;
        }

        private async Task ReserveEmbeddingQuotaAsync(int estimatedTokens, string operationName)
        {
            var tokensToReserve = Math.Max(1, estimatedTokens);

            while (true)
            {
                TimeSpan waitDuration;
                var reserved = false;

                await EmbeddingQuotaLock.WaitAsync();
                try
                {
                    var now = DateTime.UtcNow;
                    var elapsed = now - _quotaWindowStartUtc;
                    if (elapsed >= TimeSpan.FromMinutes(1))
                    {
                        _quotaWindowStartUtc = now;
                        _usedTokensInWindow = 0;
                        _usedRequestsInWindow = 0;
                        elapsed = TimeSpan.Zero;
                    }

                    var canReserveTokens = _usedTokensInWindow + tokensToReserve <= _targetEmbeddingTpm;
                    var canReserveRequest = _usedRequestsInWindow + 1 <= _targetEmbeddingRpm;
                    if (canReserveTokens && canReserveRequest)
                    {
                        _usedTokensInWindow += tokensToReserve;
                        _usedRequestsInWindow += 1;
                        reserved = true;
                        waitDuration = TimeSpan.Zero;
                    }
                    else
                    {
                        waitDuration = TimeSpan.FromMinutes(1) - elapsed + TimeSpan.FromMilliseconds(200);
                    }
                }
                finally
                {
                    EmbeddingQuotaLock.Release();
                }

                if (reserved)
                    return;

                _logger.LogInformation(
                    "{Operation} tạm dừng {DelayMs}ms để giữ dưới quota embed (target TPM {TargetTpm}, target RPM {TargetRpm}).",
                    operationName,
                    (int)waitDuration.TotalMilliseconds,
                    _targetEmbeddingTpm,
                    _targetEmbeddingRpm);
                await Task.Delay(waitDuration);
            }
        }

        private string NormalizeEmbeddingText(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return string.Empty;

            var normalized = text.Trim();
            if (normalized.Length <= _maxEmbeddingTextChars)
                return normalized;

            _logger.LogWarning(
                "Embedding input dài {CurrentLength} chars, cắt còn {MaxChars} chars để giảm TPM.",
                normalized.Length,
                _maxEmbeddingTextChars);
            return normalized[.._maxEmbeddingTextChars];
        }

        private static string EnsureEmbeddingPrefix(string text, bool isDocument)
        {
            var trimmed = text.TrimStart();
            if (trimmed.StartsWith("search_document:", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("search_query:", StringComparison.OrdinalIgnoreCase))
            {
                return text;
            }

            var prefix = isDocument ? "search_document: " : "search_query: ";
            return $"{prefix}{text}";
        }

        private static int EstimateTokens(string text)
        {
            if (string.IsNullOrEmpty(text))
                return 1;

            var bytes = Encoding.UTF8.GetByteCount(text);
            return Math.Max(1, (int)Math.Ceiling(bytes / 3.0));
        }

        private static int ReadInt(string? raw, int fallback, int min, int? max = null)
        {
            if (!int.TryParse(raw, out var parsed))
                parsed = fallback;

            parsed = Math.Max(min, parsed);
            if (max.HasValue)
                parsed = Math.Min(max.Value, parsed);
            return parsed;
        }

        private static double ReadDouble(string? raw, double fallback, double min, double max)
        {
            if (!double.TryParse(raw, out var parsed))
                parsed = fallback;

            if (parsed < min) return min;
            if (parsed > max) return max;
            return parsed;
        }

        private List<string> GetKeysForUseCase(EmbeddingUseCase useCase)
        {
            if (!string.IsNullOrWhiteSpace(_embeddingApiKey))
            {
                // Khi có key chuyên biệt cho embedding, chỉ dùng key này cho mọi tác vụ embed.
                return new List<string> { _embeddingApiKey! };
            }

            var ordered = useCase == EmbeddingUseCase.ChatQuery
                ? new[] { _chatApiKey, _analyzeApiKey }
                : new[] { _analyzeApiKey, _chatApiKey };

            return ordered
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select(k => k!)
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        private static string? NormalizeKey(string? raw)
            => string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();

        private sealed record EmbeddingBatch(List<string> Texts, int EstimatedTokens);
    }
}
