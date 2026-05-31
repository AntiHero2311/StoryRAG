using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;
using System.ClientModel;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Service.Helpers
{
    public enum GeminiPrimaryKeyRole
    {
        Analyze,
        Chat
    }

    public sealed class GeminiChatFailoverExecutor
    {
        /// <summary>
        /// Fallback cuối cùng khi ChatModels config trống.
        /// Chỉ dùng các model flash có quota thực tế; KHÔNG dùng gemini-2.0-flash hoặc gemini-2.5-flash
        /// vì quota = 0 trên nhiều project key.
        /// </summary>
        private const string DefaultChatModels = "gemini-1.5-flash,gemini-1.5-pro,gemini-2.0-flash";
        private static readonly Uri GeminiOpenAiEndpoint = new("https://generativelanguage.googleapis.com/v1beta/openai/");
        private static readonly HttpClient TraceHttpClient = new();
        private static readonly ConcurrentDictionary<string, DateTime> ApiKeyCooldownUntilUtc = new();

        private readonly ILogger _logger;
        private readonly string _operationName;
        private readonly List<GeminiChatCandidate> _candidates = [];
        private readonly bool _traceOpenAiHttp;
        private readonly int _traceBodyLimit;
        private readonly int _globalOverloadRetryCycles;
        private readonly int[] _globalOverloadRetryDelaysSeconds;
        private readonly bool _preferAnalyzeOnly;

        /// <param name="modelsConfigKey">
        /// Config key để đọc danh sách model (ví dụ "Gemini:ImportModels").
        /// Nếu null hoặc key trống thì dùng "Gemini:ChatModels" → fallback DefaultChatModels.
        /// </param>
        public GeminiChatFailoverExecutor(
            IConfiguration config,
            ILogger logger,
            string operationName,
            GeminiPrimaryKeyRole primaryRole,
            TimeSpan networkTimeout,
            string? modelsConfigKey = null)
        {
            _logger = logger;
            _operationName = operationName;
            _traceOpenAiHttp = ReadBool(config["Gemini:TraceOpenAiHttp"]);
            _traceBodyLimit = ReadInt(config["Gemini:TraceOpenAiHttpBodyLimit"], 16000, 500, 200000);
            _globalOverloadRetryCycles = ReadInt(config["Gemini:GlobalOverloadRetryCycles"], 2, 0, 5);
            _globalOverloadRetryDelaysSeconds = ReadIntList(
                config["Gemini:GlobalOverloadRetryDelaysSeconds"],
                [20, 45, 90],
                min: 5,
                max: 300);

            var analyzeKey = NormalizeKey(config["Gemini:AnalyzeApiKey"]);
            var chatKey = NormalizeKey(config["Gemini:ChatApiKey"]);

            // Ưu tiên modelsConfigKey → "Gemini:ChatModels" → DefaultChatModels
            var chatModels = !string.IsNullOrWhiteSpace(modelsConfigKey)
                ? ReadValues(config[modelsConfigKey])
                : new List<string>();
            if (chatModels.Count == 0)
                chatModels = ReadValues(config["Gemini:ChatModels"]);
            if (chatModels.Count == 0)
                chatModels = ReadValues(DefaultChatModels);

            // Nếu đang ở chế độ Analyze và AnalyzeModels được chỉ định, chỉ dùng Analyze key (không fallback sang Chat key)
            _preferAnalyzeOnly = primaryRole == GeminiPrimaryKeyRole.Analyze && !string.IsNullOrWhiteSpace(config["Gemini:AnalyzeModels"]);
            // Nếu preferAnalyzeOnly, ưu tiên CHỈ dùng model Analyze đầu tiên để tránh thử nhiều model khi Analyze toàn bộ dự án.
            if (_preferAnalyzeOnly && chatModels.Count > 1)
            {
                chatModels = new List<string> { chatModels[0] };
            }
            var orderedRoles = primaryRole == GeminiPrimaryKeyRole.Analyze
                ? (_preferAnalyzeOnly ? new[] { GeminiPrimaryKeyRole.Analyze } : new[] { GeminiPrimaryKeyRole.Analyze, GeminiPrimaryKeyRole.Chat })
                : new[] { GeminiPrimaryKeyRole.Chat, GeminiPrimaryKeyRole.Analyze };
            // Khi đang ưu tiên Analyze only, giảm số vòng retry về 0 để tránh gọi nhiều lần khi phân tích toàn bộ dự án
            if (_preferAnalyzeOnly)
            {
                _globalOverloadRetryCycles = 0;
            }

            var options = new OpenAIClientOptions
            {
                Endpoint = GeminiOpenAiEndpoint,
                NetworkTimeout = networkTimeout,
            };
            var seenCandidates = new HashSet<string>(StringComparer.Ordinal);

            foreach (var role in orderedRoles)
            {
                var key = role == GeminiPrimaryKeyRole.Analyze ? analyzeKey : chatKey;
                if (string.IsNullOrWhiteSpace(key))
                    continue;

                var roleLabel = role == GeminiPrimaryKeyRole.Analyze ? "Analyze key" : "Chat key";
                foreach (var model in chatModels)
                {
                    var candidateKey = $"{key}|{model}";
                    if (!seenCandidates.Add(candidateKey))
                        continue;

                    var client = new OpenAIClient(new ApiKeyCredential(key), options).GetChatClient(model);
                    _candidates.Add(new GeminiChatCandidate(client, $"{roleLabel} | {model}", model, key));
                }
            }
        }

        public async Task<OpenAI.Chat.ChatCompletion> CompleteAsync(
            IEnumerable<ChatMessage> messages,
            ChatCompletionOptions? options = null,
            CancellationToken cancellationToken = default)
        {
            if (_candidates.Count == 0)
            {
                throw new InvalidOperationException(
                    "Thiếu Gemini API key. Hãy set Gemini__AnalyzeApiKey và Gemini__ChatApiKey.");
            }

            var sourceMessages = messages.ToList();
            if (_traceOpenAiHttp)
            {
                await TraceCandidateMatrixAsync(sourceMessages);
            }

            Exception? lastError = null;
            for (var cycle = 0; cycle <= _globalOverloadRetryCycles; cycle++)
            {
                var attemptedCandidates = 0;
                foreach (var candidate in _candidates)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    if (TryGetKeyCooldownSeconds(candidate.ApiKey, out var cooldownSeconds))
                    {
                        _logger.LogInformation(
                            "{Operation} bỏ qua {Candidate} do key đang cooldown thêm {CooldownSeconds:F1}s.",
                            _operationName,
                            candidate.Label,
                            cooldownSeconds);
                        continue;
                    }

                    attemptedCandidates++;
                    try
                    {
                        var geminiMessages = GeminiRetryHelper.FlattenSystemForGemma(sourceMessages);

                        ClientResult<ChatCompletion> result;
                        if (options == null)
                        {
                            result = await GeminiRetryHelper.ExecuteAsync(
                                () => candidate.Client.CompleteChatAsync(geminiMessages, cancellationToken: cancellationToken),
                                _logger,
                                $"{_operationName} ({candidate.Label})",
                                cancellationToken: cancellationToken);
                        }
                        else
                        {
                            result = await GeminiRetryHelper.ExecuteAsync(
                                () => candidate.Client.CompleteChatAsync(geminiMessages, options, cancellationToken),
                                _logger,
                                $"{_operationName} ({candidate.Label})",
                                cancellationToken: cancellationToken);
                        }

                        ClearKeyCooldown(candidate.ApiKey);
                        return result.Value;
                    }
                    catch (Exception ex)
                    {
                        lastError = ex;
                        if (IsQuotaOverload(ex))
                            SetKeyCooldown(candidate.ApiKey, TimeSpan.FromSeconds(_preferAnalyzeOnly ? 300 : 75));
                        else if (IsServiceBusy(ex))
                            SetKeyCooldown(candidate.ApiKey, TimeSpan.FromSeconds(_preferAnalyzeOnly ? 120 : 25));

                        if (ex is ClientResultException clientEx)
                        {
                            _logger.LogWarning(
                                "{Operation} thất bại với {Candidate}: HTTP {Status} — {Detail}",
                                _operationName,
                                candidate.Label,
                                clientEx.Status,
                                clientEx.Message);
                        }
                        else if (ex is ArgumentOutOfRangeException aoex && aoex.Message.Contains("ChatFinishReason", StringComparison.OrdinalIgnoreCase))
                        {
                            _logger.LogWarning(
                                "{Operation} thất bại với {Candidate}: Nội dung bị chặn bởi content filter (finish_reason=content_filter). Thử fallback.",
                                _operationName,
                                candidate.Label);
                        }
                        else
                        {
                            _logger.LogWarning(ex, "{Operation} thất bại với {Candidate}, thử fallback.", _operationName, candidate.Label);
                        }
                    }
                }

                var canRetryWholeCycle = cycle < _globalOverloadRetryCycles && IsRetryableAcrossCycles(lastError);
                if (!canRetryWholeCycle)
                    break;

                var delaySeconds = _globalOverloadRetryDelaysSeconds[Math.Min(cycle, _globalOverloadRetryDelaysSeconds.Length - 1)];
                if (attemptedCandidates == 0)
                    delaySeconds = Math.Max(delaySeconds, 10);

                _logger.LogWarning(
                    "{Operation} vẫn quá tải sau vòng fallback {Cycle}/{MaxCycle}. Chờ {DelaySeconds}s rồi thử lại toàn bộ key/model.",
                    _operationName,
                    cycle + 1,
                    _globalOverloadRetryCycles + 1,
                    delaySeconds);
                await Task.Delay(TimeSpan.FromSeconds(delaySeconds), cancellationToken);
            }

            if (lastError is ClientResultException cre)
            {
                if (cre.Status == (int)HttpStatusCode.TooManyRequests)
                {
                    _logger.LogWarning("{Operation} vẫn 429 sau toàn bộ fallback model/key.", _operationName);
                    throw new InvalidOperationException("AI đang quá tải (429). Vui lòng thử lại sau khoảng 1–2 phút.");
                }

                if (cre.Status == (int)HttpStatusCode.ServiceUnavailable)
                {
                    _logger.LogWarning("{Operation} vẫn 503 sau toàn bộ fallback model/key.", _operationName);
                    throw new InvalidOperationException("Dịch vụ AI tạm thời không khả dụng (503). Vui lòng thử lại sau ít phút.");
                }
            }

            if (lastError is ArgumentOutOfRangeException argExc && argExc.Message.Contains("ChatFinishReason", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("{Operation} nội dung bị chặn bởi content filter trên tất cả model.", _operationName);
                throw new InvalidOperationException("Nội dung phân tích bị chặn bởi bộ lọc an toàn (content filter). Vui lòng kiểm tra lại manuscript hoặc thử lại với prompt khác.");
            }

            _logger.LogError(lastError, "{Operation} thất bại với toàn bộ fallback model/key.", _operationName);
            throw new InvalidOperationException("AI tạm thời không khả dụng, vui lòng thử lại.");
        }

        private static string? NormalizeKey(string? raw)
            => string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();

        private async Task TraceRawHttpAsync(GeminiChatCandidate candidate, IEnumerable<ChatMessage> messages)
        {
            try
            {
                var payload = new
                {
                    model = candidate.Model,
                    messages = BuildTraceMessages(messages),
                };

                var payloadJson = JsonSerializer.Serialize(payload, new JsonSerializerOptions
                {
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                });

                using var request = new HttpRequestMessage(HttpMethod.Post, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", candidate.ApiKey);
                request.Headers.TryAddWithoutValidation("x-goog-api-key", candidate.ApiKey);
                request.Content = new StringContent(payloadJson, System.Text.Encoding.UTF8, "application/json");

                var response = await TraceHttpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();
                var requestHeaders = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["Authorization"] = $"Bearer {MaskApiKey(candidate.ApiKey)}",
                    ["x-goog-api-key"] = MaskApiKey(candidate.ApiKey)
                };
                var responseHeaders = ReadHeaders(response.Headers, response.Content.Headers);

                var logLevel = response.IsSuccessStatusCode ? LogLevel.Information : LogLevel.Warning;
                _logger.Log(logLevel,
                    "Gemini HTTP trace [{Operation}] [{Candidate}] Status={StatusCode}; RequestHeaders={RequestHeaders}; ResponseHeaders={ResponseHeaders}; ResponseBody={ResponseBody}",
                    _operationName,
                    candidate.Label,
                    (int)response.StatusCode,
                    JsonSerializer.Serialize(requestHeaders),
                    JsonSerializer.Serialize(responseHeaders),
                    TrimForLog(responseBody, _traceBodyLimit));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini HTTP trace probe lỗi với {Candidate}.", candidate.Label);
            }
        }

        private async Task TraceCandidateMatrixAsync(IEnumerable<ChatMessage> messages)
        {
            var flat = GeminiRetryHelper.FlattenSystemForGemma(messages);
            foreach (var candidate in _candidates)
                await TraceRawHttpAsync(candidate, flat);
        }

        private static List<object> BuildTraceMessages(IEnumerable<ChatMessage> messages)
        {
            var result = new List<object>();

            foreach (var message in messages)
            {
                var role = message switch
                {
                    SystemChatMessage => "system",
                    AssistantChatMessage => "assistant",
                    UserChatMessage => "user",
                    _ => "user"
                };

                var content = string.Join(
                    "\n",
                    message.Content
                        .Select(part => part.Text)
                        .Where(text => !string.IsNullOrWhiteSpace(text)));

                if (!string.IsNullOrWhiteSpace(content))
                {
                    result.Add(new { role, content });
                }
            }

            return result;
        }

        private static Dictionary<string, string> ReadHeaders(params HttpHeaders[] headers)
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var headerSet in headers)
            {
                foreach (var header in headerSet)
                {
                    map[header.Key] = string.Join(", ", header.Value);
                }
            }
            return map;
        }

        private static string TrimForLog(string value, int maxLen)
        {
            if (value.Length <= maxLen)
                return value;
            return $"{value[..maxLen]}...[truncated]";
        }

        private static string MaskApiKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
                return "****";

            var normalized = key.Trim();
            if (normalized.Length <= 8)
                return "****";

            return $"{normalized[..4]}...{normalized[^4..]}";
        }

        private static bool ReadBool(string? raw)
            => bool.TryParse(raw, out var value) && value;

        private static int ReadInt(string? raw, int fallback, int min, int max)
        {
            if (!int.TryParse(raw, out var value))
                return fallback;

            return Math.Clamp(value, min, max);
        }

        private static int[] ReadIntList(string? raw, int[] fallback, int min, int max)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return fallback;

            var parsed = raw
                .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(v => int.TryParse(v, out var num) ? Math.Clamp(num, min, max) : -1)
                .Where(v => v >= 0)
                .ToArray();

            return parsed.Length == 0 ? fallback : parsed;
        }

        private static bool IsRetryableAcrossCycles(Exception? ex)
        {
            if (ex == null) return false;
            return IsQuotaOverload(ex) || IsServiceBusy(ex);
        }

        private static bool IsQuotaOverload(Exception ex)
        {
            if (ex is ClientResultException cre && cre.Status == (int)HttpStatusCode.TooManyRequests)
                return true;
            if (ex is HttpRequestException hre && hre.StatusCode == HttpStatusCode.TooManyRequests)
                return true;

            var msg = ex.Message;
            return msg.Contains("RESOURCE_EXHAUSTED", StringComparison.OrdinalIgnoreCase)
                || msg.Contains("quota", StringComparison.OrdinalIgnoreCase)
                || msg.Contains("rate limit", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsServiceBusy(Exception ex)
        {
            if (ex is ClientResultException cre)
                return cre.Status == (int)HttpStatusCode.ServiceUnavailable || cre.Status == (int)HttpStatusCode.GatewayTimeout;
            if (ex is HttpRequestException hre)
                return hre.StatusCode == HttpStatusCode.ServiceUnavailable || hre.StatusCode == HttpStatusCode.GatewayTimeout;
            return false;
        }

        private static void SetKeyCooldown(string apiKey, TimeSpan duration)
        {
            ApiKeyCooldownUntilUtc[apiKey] = DateTime.UtcNow.Add(duration);
        }

        private static bool TryGetKeyCooldownSeconds(string apiKey, out double remainingSeconds)
        {
            remainingSeconds = 0;
            if (!ApiKeyCooldownUntilUtc.TryGetValue(apiKey, out var until))
                return false;

            var remaining = until - DateTime.UtcNow;
            if (remaining <= TimeSpan.Zero)
            {
                ApiKeyCooldownUntilUtc.TryRemove(apiKey, out _);
                return false;
            }

            remainingSeconds = remaining.TotalSeconds;
            return true;
        }

        private static void ClearKeyCooldown(string apiKey)
        {
            ApiKeyCooldownUntilUtc.TryRemove(apiKey, out _);
        }

        private static List<string> ReadValues(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return [];

            return raw
                .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private sealed record GeminiChatCandidate(
            ChatClient Client,
            string Label,
            string Model,
            string ApiKey);
    }
}
