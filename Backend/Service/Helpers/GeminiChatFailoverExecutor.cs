using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;
using System.ClientModel;
using System.Net;

namespace Service.Helpers
{
    public enum GeminiPrimaryKeyRole
    {
        Analyze,
        Chat
    }

    public sealed class GeminiChatFailoverExecutor
    {
        private const string DefaultChatModels = "gemma-4-31b,gemma-4-26b";
        private static readonly Uri GeminiOpenAiEndpoint = new("https://generativelanguage.googleapis.com/v1beta/openai/");

        private readonly ILogger _logger;
        private readonly string _operationName;
        private readonly List<GeminiChatCandidate> _candidates = [];

        public GeminiChatFailoverExecutor(
            IConfiguration config,
            ILogger logger,
            string operationName,
            GeminiPrimaryKeyRole primaryRole,
            TimeSpan networkTimeout)
        {
            _logger = logger;
            _operationName = operationName;

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
                    _candidates.Add(new GeminiChatCandidate(client, isGemma, $"{roleLabel} | {model}"));
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

            Exception? lastError = null;

            foreach (var candidate in _candidates)
            {
                try
                {
                    var geminiMessages = candidate.IsGemma
                        ? GeminiRetryHelper.FlattenSystemForGemma(messages)
                        : messages;

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

        private sealed record GeminiChatCandidate(ChatClient Client, bool IsGemma, string Label);
    }
}
