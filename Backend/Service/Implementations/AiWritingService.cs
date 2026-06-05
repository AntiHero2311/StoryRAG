using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.Helpers;
using Service.Interfaces;

namespace Service.Implementations
{
    public class AiWritingService : ServiceBase, IAiWritingService
    {
        private readonly ILogger<AiWritingService> _logger;
        private readonly IEmbeddingService _embeddingService;
        private readonly GeminiChatFailoverExecutor _geminiChatExecutor;

        public AiWritingService(AppDbContext context, IConfiguration config, ILogger<AiWritingService> logger, IEmbeddingService embeddingService)
            : base(context, config)
        {
            _logger = logger;
            _embeddingService = embeddingService;
            _geminiChatExecutor = new GeminiChatFailoverExecutor(
                config,
                logger,
                "Gemini AiWriting",
                GeminiPrimaryKeyRole.Chat,
                TimeSpan.FromMinutes(4));
        }

        private Task<OpenAI.Chat.ChatCompletion> CompleteChatWithGeminiAsync(
            IEnumerable<ChatMessage> messages,
            int maxTokens = 2500,
            float temperature = 0.7f,
            bool jsonMode = false,
            CancellationToken cancellationToken = default)
        {
            var options = new ChatCompletionOptions
            {
                MaxOutputTokenCount = maxTokens,
                Temperature = temperature,
            };

            if (jsonMode)
            {
                options.ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat();
            }

            return _geminiChatExecutor.CompleteAsync(messages, options, cancellationToken);
        }

        private async Task CheckAndDeductTokenAsync(Guid projectId, Guid userId)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId)
                ?? throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");

            var sub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync()
                ?? throw new InvalidOperationException("Bạn chưa có gói đăng ký hợp lệ. Vui lòng đăng ký gói để dùng tính năng AI.");

            if (sub.UsedTokens >= sub.Plan.MaxTokenLimit)
                throw new InvalidOperationException($"Bạn đã dùng hết token tháng này ({sub.Plan.MaxTokenLimit:N0} token). Vui lòng nâng cấp gói.");
        }

        private async Task DeductTokenAsync(Guid userId, int tokens)
        {
            var sub = await _context.UserSubscriptions
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync();
            if (sub != null)
            {
                sub.UsedTokens += tokens;
                await _context.SaveChangesAsync();
            }
        }



        public async Task<AiSceneAnalysisResult> AnalyzeScenesAsync(Guid projectId, string chapterContent, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var safeContent = PromptSanitizer.SanitizeAndWarn(chapterContent, _logger, "AnalyzeScenes");
            var systemPrompt = "OUTPUT RULE (ABSOLUTE): Respond with ONE valid JSON object only. Start with '{', end with '}'. NO markdown, NO comments, NO text outside JSON.\n" +
                               "Bạn là biên tập viên văn học chuyên phân tích cấu trúc. " +
                               "Nhiệm vụ: đọc chương truyện và phân rã thành các phân cảnh (Scenes/Beats). " +
                               "QUAN TRỌNG: Chỉ dựa vào văn bản được cung cấp.\n" +
                               "JSON SCHEMA:\n" +
                               "{\"chapterSummary\":\"...\",\"scenes\":[{\"title\":\"...\",\"description\":\"...\",\"exactQuote\":\"trích dẫn CHÍNH XÁC NGUYÊN VĂN 1-3 câu dài và quan trọng nhất từ văn bản gốc để đại diện cho cảnh này (sẽ dùng để highlight)\",\"type\":\"Action|Dialogue|Introspection|Transition|Revelation\"}]}";
            var userMsg = $"Phân rã thành các Cảnh:\n<chapter>\n{safeContent[..Math.Min(15000, safeContent.Length)]}\n</chapter>";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithGeminiAsync(messages, jsonMode: true);
            var rawText = completion.Content[0].Text.Trim();
            var tokens = completion.Usage?.TotalTokenCount ?? 0;

            string jsonText = ExtractJsonPayload(rawText);
            SceneAnalysisRaw? parsed = null;
            var jsonOpts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            try
            {
                parsed = System.Text.Json.JsonSerializer.Deserialize<SceneAnalysisRaw>(jsonText, jsonOpts);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AnalyzeScenes: AI không trả về JSON hợp lệ, tiến hành retry...");

                var retryMessages = new List<ChatMessage>(messages)
                {
                    ChatMessage.CreateAssistantMessage(rawText),
                    ChatMessage.CreateUserMessage(
                        "Phản hồi trước không phải JSON object hợp lệ. " +
                        "Hãy trả về DUY NHẤT một JSON object bắt đầu bằng '{' và kết thúc bằng '}', " +
                        "không có bất kỳ văn bản nào trước hoặc sau, không có markdown.")
                };

                var retryCompletion = await CompleteChatWithGeminiAsync(retryMessages, jsonMode: true);
                tokens += retryCompletion.Usage?.TotalTokenCount ?? 0;
                rawText = retryCompletion.Content[0].Text.Trim();
                jsonText = ExtractJsonPayload(rawText);

                try
                {
                    parsed = System.Text.Json.JsonSerializer.Deserialize<SceneAnalysisRaw>(jsonText, jsonOpts);
                }
                catch (Exception rEx)
                {
                    _logger.LogError(rEx, "AnalyzeScenes: Retry parse JSON vẫn thất bại.");
                }
            }

            await DeductTokenAsync(userId, tokens);

            if (parsed != null)
            {
                return new AiSceneAnalysisResult
                {
                    ChapterSummary = parsed.ChapterSummary ?? "",
                    Scenes = parsed.Scenes?.Select(s => new SceneItem
                    {
                        Title = s.Title ?? "",
                        Description = s.Description ?? "",
                        ExactQuote = s.ExactQuote ?? s.OpeningLine ?? "",
                        Type = s.Type ?? "Action"
                    }).ToList() ?? new(),
                    TotalTokens = tokens
                };
            }

            return new AiSceneAnalysisResult { ChapterSummary = rawText, Scenes = new(), TotalTokens = tokens };
        }

        public async Task<AiCliffhangerResult> AnalyzeCliffhangerAsync(Guid projectId, string chapterContent, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var safeContent = PromptSanitizer.SanitizeAndWarn(chapterContent, _logger, "AnalyzeCliffhanger");
            var systemPrompt = "OUTPUT RULE (ABSOLUTE): Respond with ONE valid JSON object only. Start with '{', end with '}'. NO markdown, NO comments, NO text outside JSON.\n" +
                               "Bạn là biên tập viên văn học chuyên phân tích cấu trúc truyện. " +
                               "Phân tích cấu trúc 3 hồi (Setup/Conflict/Climax) và phát hiện điểm Hạ hồi phân giải (Cliffhanger). " +
                               "ZERO HALLUCINATION: Chỉ dựa vào văn bản được cung cấp, không suy diễn thêm.\n" +
                               "JSON SCHEMA:\n" +
                               "{\"hasCliffhanger\":true/false,\"cliffhangerDescription\":\"...\",\"cliffhangerQuote\":\"câu văn gốc tạo cliffhanger\",\"actSetup\":\"mô tả hồi 1\",\"actConflict\":\"mô tả hồi 2\",\"actClimax\":\"mô tả hồi 3\",\"structureFeedback\":\"nhận xét tổng thể 2-3 câu\"}";
            var userMsg = $"Phân tích cấu trúc và Cliffhanger:\n<chapter>\n{safeContent[..Math.Min(15000, safeContent.Length)]}\n</chapter>";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithGeminiAsync(messages, jsonMode: true);
            var rawText = completion.Content[0].Text.Trim();
            var tokens = completion.Usage?.TotalTokenCount ?? 0;

            string jsonText = ExtractJsonPayload(rawText);
            AiCliffhangerResult? parsed = null;
            var jsonOpts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            try
            {
                parsed = System.Text.Json.JsonSerializer.Deserialize<AiCliffhangerResult>(jsonText, jsonOpts);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AnalyzeCliffhanger: AI không trả về JSON hợp lệ, tiến hành retry...");

                var retryMessages = new List<ChatMessage>(messages)
                {
                    ChatMessage.CreateAssistantMessage(rawText),
                    ChatMessage.CreateUserMessage(
                        "Phản hồi trước không phải JSON object hợp lệ. " +
                        "Hãy trả về DUY NHẤT một JSON object bắt đầu bằng '{' và kết thúc bằng '}', " +
                        "không có bất kỳ văn bản nào trước hoặc sau, không có markdown.")
                };

                var retryCompletion = await CompleteChatWithGeminiAsync(retryMessages, jsonMode: true);
                tokens += retryCompletion.Usage?.TotalTokenCount ?? 0;
                rawText = retryCompletion.Content[0].Text.Trim();
                jsonText = ExtractJsonPayload(rawText);

                try
                {
                    parsed = System.Text.Json.JsonSerializer.Deserialize<AiCliffhangerResult>(jsonText, jsonOpts);
                }
                catch (Exception rEx)
                {
                    _logger.LogError(rEx, "AnalyzeCliffhanger: Retry parse JSON vẫn thất bại.");
                }
            }

            await DeductTokenAsync(userId, tokens);

            if (parsed != null)
            {
                parsed.TotalTokens = tokens;
                return parsed;
            }

            return new AiCliffhangerResult { StructureFeedback = rawText, TotalTokens = tokens };
        }

        private static string ExtractJsonPayload(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return text;

            var objStart = text.IndexOf('{');
            var objEnd = text.LastIndexOf('}');
            if (objStart >= 0 && objEnd > objStart)
            {
                return text[objStart..(objEnd + 1)];
            }
            return text;
        }

        // ── Inner raw parse types ─────────────────────────────────────────────────
        private class SceneAnalysisRaw
        {
            public string? ChapterSummary { get; set; }
            public List<SceneRaw>? Scenes { get; set; }
        }
        private class SceneRaw
        {
            public string? Title { get; set; }
            public string? Description { get; set; }
            public string? ExactQuote { get; set; }
            public string? OpeningLine { get; set; } // Fallback
            public string? Type { get; set; }
        }
    }
}
