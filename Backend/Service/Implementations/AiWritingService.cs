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

        private Task<OpenAI.Chat.ChatCompletion> CompleteChatWithGeminiAsync(IEnumerable<ChatMessage> messages)
        {
            return _geminiChatExecutor.CompleteAsync(messages);
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
            var systemPrompt = "Bạn là biên tập viên văn học chuyên phân tích cấu trúc. " +
                               "Nhiệm vụ: đọc chương truyện và phân rã thành các phân cảnh (Scenes/Beats). " +
                               "QUAN TRỌNG: Chỉ dựa vào văn bản được cung cấp. " +
                               "Trả về JSON thuần túy, không thêm bất kỳ text nào: " +
                               "{\"chapterSummary\":\"...\",\"scenes\":[{\"title\":\"...\",\"description\":\"...\",\"exactQuote\":\"trích dẫn CHÍNH XÁC NGUYÊN VĂN 1-3 câu dài và quan trọng nhất từ văn bản gốc để đại diện cho cảnh này (sẽ dùng để highlight)\",\"type\":\"Action|Dialogue|Introspection|Transition|Revelation\"}]}";
            var userMsg = $"Phân rã thành các Cảnh:\n<chapter>\n{safeContent[..Math.Min(15000, safeContent.Length)]}\n</chapter>";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithGeminiAsync(messages);
            var rawText = completion.Content[0].Text.Trim();
            var tokens = completion.Usage?.TotalTokenCount ?? 0;
            await DeductTokenAsync(userId, tokens);

            // Parse JSON
            try
            {
                var jsonOpts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                // Strip markdown fences if any
                var json = rawText.Trim('`').TrimStart("json\n".ToCharArray()).Trim();
                var idx1 = json.IndexOf('{'); var idx2 = json.LastIndexOf('}');
                if (idx1 >= 0 && idx2 > idx1) json = json[idx1..(idx2 + 1)];
                var parsed = System.Text.Json.JsonSerializer.Deserialize<SceneAnalysisRaw>(json, jsonOpts);
                return new AiSceneAnalysisResult
                {
                    ChapterSummary = parsed?.ChapterSummary ?? "",
                    Scenes = parsed?.Scenes?.Select(s => new SceneItem
                    {
                        Title = s.Title ?? "",
                        Description = s.Description ?? "",
                        ExactQuote = s.ExactQuote ?? s.OpeningLine ?? "", // Fallback
                        Type = s.Type ?? "Action"
                    }).ToList() ?? new(),
                    TotalTokens = tokens
                };
            }
            catch
            {
                return new AiSceneAnalysisResult { ChapterSummary = rawText, Scenes = new(), TotalTokens = tokens };
            }
        }

        public async Task<AiCliffhangerResult> AnalyzeCliffhangerAsync(Guid projectId, string chapterContent, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var safeContent = PromptSanitizer.SanitizeAndWarn(chapterContent, _logger, "AnalyzeCliffhanger");
            var systemPrompt = "Bạn là biên tập viên văn học chuyên phân tích cấu trúc truyện. " +
                               "Phân tích cấu trúc 3 hồi (Setup/Conflict/Climax) và phát hiện điểm Hạ hồi phân giải (Cliffhanger). " +
                               "ZERO HALLUCINATION: Chỉ dựa vào văn bản được cung cấp, không suy diễn thêm. " +
                               "Trả về JSON thuần túy: " +
                               "{\"hasCliffhanger\":true/false,\"cliffhangerDescription\":\"...\",\"cliffhangerQuote\":\"câu văn gốc tạo cliffhanger\",\"actSetup\":\"mô tả hồi 1\",\"actConflict\":\"mô tả hồi 2\",\"actClimax\":\"mô tả hồi 3\",\"structureFeedback\":\"nhận xét tổng thể 2-3 câu\"}";
            var userMsg = $"Phân tích cấu trúc và Cliffhanger:\n<chapter>\n{safeContent[..Math.Min(15000, safeContent.Length)]}\n</chapter>";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithGeminiAsync(messages);
            var rawText = completion.Content[0].Text.Trim();
            var tokens = completion.Usage?.TotalTokenCount ?? 0;
            await DeductTokenAsync(userId, tokens);

            try
            {
                var jsonOpts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var json = rawText.Trim('`').TrimStart("json\n".ToCharArray()).Trim();
                var idx1 = json.IndexOf('{'); var idx2 = json.LastIndexOf('}');
                if (idx1 >= 0 && idx2 > idx1) json = json[idx1..(idx2 + 1)];
                var parsed = System.Text.Json.JsonSerializer.Deserialize<AiCliffhangerResult>(json, jsonOpts);
                if (parsed != null) { parsed.TotalTokens = tokens; return parsed; }
            }
            catch { /* fallback below */ }
            return new AiCliffhangerResult { StructureFeedback = rawText, TotalTokens = tokens };
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
