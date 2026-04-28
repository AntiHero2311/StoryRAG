using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;
using System.ClientModel;
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
        private const string DefaultChatModels = "gemini-3-flash-preview,gemini-2.5-flash";
        private static readonly Uri GeminiOpenAiEndpoint = new("https://generativelanguage.googleapis.com/v1beta/openai/");
        private static readonly HttpClient TraceHttpClient = new();

        private readonly ILogger _logger;
        private readonly string _operationName;
        private readonly List<GeminiChatCandidate> _candidates = [];
        private readonly bool _traceOpenAiHttp;
        private readonly int _traceBodyLimit;

        public GeminiChatFailoverExecutor(
            IConfiguration config,
            ILogger logger,
            string operationName,
            GeminiPrimaryKeyRole primaryRole,
            TimeSpan networkTimeout)
        {
            _logger = logger;
            _operationName = operationName;
            _traceOpenAiHttp = ReadBool(config["Gemini:TraceOpenAiHttp"]);
            _traceBodyLimit = ReadInt(config["Gemini:TraceOpenAiHttpBodyLimit"], 16000, 500, 200000);

            var analyzeKey = NormalizeKey(config["Gemini:AnalyzeApiKey"]);
            var chatKey = NormalizeKey(config["Gemini:ChatApiKey"]);
            var chatModels = ReadValues(config["Gemini:ChatModels"]);
            if (chatModels.Count == 0)
                chatModels = ReadValues(DefaultChatModels);

            var orderedRoles = primaryRole == GeminiPrimaryKeyRole.Analyze
                ? new[] { GeminiPrimaryKeyRole.Analyze, GeminiPrimaryKeyRole.Chat }
                : new[] { GeminiPrimaryKeyRole.Chat, GeminiPrimaryKeyRole.Analyze };

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
                    var isGemma = model.StartsWith("gemma", StringComparison.OrdinalIgnoreCase);
                    _candidates.Add(new GeminiChatCandidate(client, isGemma, $"{roleLabel} | {model}", model, key));
                }
            }
        }

        public async Task<OpenAI.Chat.ChatCompletion> CompleteAsync(
            IEnumerable<ChatMessage> messages,
            ChatCompletionOptions? options = null)
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

            foreach (var candidate in _candidates)
            {
                try
                {
                    var geminiMessages = candidate.IsGemma
                        ? GeminiRetryHelper.FlattenSystemForGemma(sourceMessages)
                        : sourceMessages;

                    ClientResult<ChatCompletion> result;
                    if (options == null)
                    {
                        result = await GeminiRetryHelper.ExecuteAsync(
                            () => candidate.Client.CompleteChatAsync(geminiMessages),
                            _logger,
                            $"{_operationName} ({candidate.Label})");
                    }
                    else
                    {
                        result = await GeminiRetryHelper.ExecuteAsync(
                            () => candidate.Client.CompleteChatAsync(geminiMessages, options),
                            _logger,
                            $"{_operationName} ({candidate.Label})");
                    }

                    return result.Value;
                }
                catch (Exception ex)
                {
                    lastError = ex;
                    _logger.LogWarning(ex, "{Operation} thất bại với {Candidate}, thử fallback.", _operationName, candidate.Label);
                }
            }

            if (lastError is ClientResultException cre && cre.Status == (int)HttpStatusCode.TooManyRequests)
            {
                _logger.LogWarning("{Operation} vẫn 429 sau toàn bộ fallback model/key.", _operationName);
                throw new InvalidOperationException("AI đang quá tải, vui lòng thử lại sau khoảng 1 phút.");
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
            foreach (var candidate in _candidates)
            {
                var candidateMessages = candidate.IsGemma
                    ? GeminiRetryHelper.FlattenSystemForGemma(messages)
                    : messages;

                await TraceRawHttpAsync(candidate, candidateMessages);
            }
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
            bool IsGemma,
            string Label,
            string Model,
            string ApiKey);
    }
}
