using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;
using Repository.Data;
using Repository.Entities;
using Service.Helpers;
using Service.Interfaces;
using System.ClientModel;

namespace Service.Implementations
{
    public class AiWritingService : IAiWritingService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly ILogger<AiWritingService> _logger;
        private readonly ChatClient _chatClient;
        private readonly ChatClient? _geminiChatClient;
        private readonly bool _geminiIsGemma;

        public AiWritingService(AppDbContext context, IConfiguration config, ILogger<AiWritingService> logger)
        {
            _context = context;
            _config = config;
            _logger = logger;

            var baseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var apiKey = config["AI:ApiKey"] ?? "lm-studio";
            var model = config["AI:ChatModel"] ?? "qwen/qwen3.5-9b";
            var lmOptions = new OpenAIClientOptions { Endpoint = new Uri(baseUrl) };
            _chatClient = new OpenAIClient(new ApiKeyCredential(apiKey), lmOptions).GetChatClient(model);

            var geminiKey = config["Gemini:ChatApiKey"] ?? string.Empty;
            if (!string.IsNullOrEmpty(geminiKey))
            {
                var geminiModel = config["Gemini:ChatModel"] ?? "gemma-3-27b-it";
                _geminiIsGemma = geminiModel.StartsWith("gemma", StringComparison.OrdinalIgnoreCase);
                var geminiOptions = new OpenAIClientOptions
                {
                    Endpoint = new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"),
                    NetworkTimeout = TimeSpan.FromMinutes(4),
                };
                _geminiChatClient = new OpenAIClient(new ApiKeyCredential(geminiKey), geminiOptions).GetChatClient(geminiModel);
            }
        }

        private async Task<OpenAI.Chat.ChatCompletion> CompleteChatWithFallbackAsync(IEnumerable<ChatMessage> messages)
        {
            if (_geminiChatClient != null)
            {
                try
                {
                    var geminiMessages = _geminiIsGemma ? GeminiRetryHelper.FlattenSystemForGemma(messages) : messages;
                    var geminiResult = await GeminiRetryHelper.ExecuteAsync(
                         () => _geminiChatClient.CompleteChatAsync(geminiMessages),
                         _logger, "Gemini AiWriting");
                    return geminiResult.Value;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Gemini AiWriting thất bại, fallback về LM Studio.");
                }
            }
            var lmMessages = messages.ToList();
            var lastUser = lmMessages.LastOrDefault(m => m is UserChatMessage);
            if (lastUser != null)
            {
                var originalText = lastUser.Content[0].Text;
                if (!originalText.Contains("/no_think"))
                {
                    var idx = lmMessages.LastIndexOf(lastUser);
                    lmMessages[idx] = ChatMessage.CreateUserMessage(originalText + " /no_think");
                }
            }
            var result = await _chatClient.CompleteChatAsync(lmMessages);
            return result.Value;
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

        public async Task<AiWritingResult> WriteNewAsync(Guid projectId, string instruction, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var systemPrompt = "Bạn là một tiểu thuyết gia xuất sắc. Dựa vào yêu cầu chi tiết (thể loại, bối cảnh, dàn ý), hãy viết phần truyện thật hấp dẫn. BẮT BUỘC TUÂN THỦ CÁC KỸ THUẬT VIẾT VĂN SAU: " +
                               "1. 'Show, don't tell' (Tả thay vì Kể): Ưu tiên dùng hành động, 5 giác quan, phản ứng cơ thể để bộc lộ cảm xúc, thay vì gọi thẳng tên cảm xúc. " +
                               "2. Nhịp độ (Pacing): Kiểm soát nhịp độ phù hợp (nhanh ở cảnh hành động, chậm & sâu lắng ở nội tâm/tả cảnh). " +
                               "KHÔNG viết tiêu đề chương hay lời chào giới thiệu. Chỉ xuất trực tiếp nội dung văn bản. Hành văn tự nhiên, mượt mà, đúng chuẩn ngữ pháp tiếng Việt.";
            var userMsg = $"Yêu cầu từ tác giả:\n<instruction>\n{PromptSanitizer.SanitizeAndWarn(instruction, _logger, "WriteNew")}\n</instruction>";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithFallbackAsync(messages);

            var text = LlmOutputValidator.ValidateRewriteResponse(completion.Content[0].Text.Trim(), _logger);
            var tokens = completion.Usage?.TotalTokenCount ?? 0;
            
            await DeductTokenAsync(userId, tokens);
            return new AiWritingResult { GeneratedText = text, TotalTokens = tokens };
        }

        public async Task<AiWritingResult> ContinueWritingAsync(Guid projectId, string previousText, string instruction, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var systemPrompt = "Bạn là một nhà văn giàu kinh nghiệm. Nhiệm vụ của bạn là tiếp nối mạch truyện dang dở, giữ vững văn phong (tone and voice), tính cách nhân vật. TUÂN THỦ KỸ THUẬT VIẾT: " +
                               "1. 'Show, don't tell' (Tả thay vì Kể): Sử dụng 5 giác quan và ngôn ngữ cơ thể. " +
                               "2. Tránh lặp từ, dùng từ nối tự nhiên. " +
                               "KHÔNG viết lời mào đầu hay chào hỏi. Bắt đầu viết thẳng vào câu tiếp theo. Tiếng Việt chuẩn xác.";
            var userMsg = $"Nội dung phần trước:\n<previous_text>\n{PromptSanitizer.SanitizeAndWarn(previousText, _logger, "Continue_Prev")}\n</previous_text>\n\n" +
                          $"Hướng dẫn cho đoạn tiếp theo: {PromptSanitizer.SanitizeAndWarn(instruction, _logger, "Continue_Inst")}";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithFallbackAsync(messages);

            var text = LlmOutputValidator.ValidateRewriteResponse(completion.Content[0].Text.Trim(), _logger);
            var tokens = completion.Usage?.TotalTokenCount ?? 0;

            await DeductTokenAsync(userId, tokens);
            return new AiWritingResult { GeneratedText = text, TotalTokens = tokens };
        }

        public async Task<AiWritingResult> PolishAsync(Guid projectId, string originalText, string instruction, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var systemPrompt = "Bạn là một Biên tập viên văn học tinh tế (Editor). Hãy đọc đoạn văn dưới đây và TRAU CHUỐT (Polish) lại. MỤC TIÊU: " +
                               "1. Viết lại cho câu từ mượt mà, hình ảnh sống động hơn, loại bỏ từ lặp, bắt lỗi ngữ pháp. " +
                               "2. Tích cực áp dụng 'Show, don't tell' (biến các câu kể lể khô khan thành câu miêu tả sắc nét) nhưng GÌỮ NGUYÊN 100% cốt truyện và ý nghĩa gốc. " +
                               "Chỉ xuất ra nội dung đã chỉnh sửa, KHÔNG bình luận, KHÔNG khen chê. Tiếng Việt chuẩn xác và giàu cảm xúc.";
            
            var userMsg = $"Hướng dẫn thêm của tác giả (nếu có): {PromptSanitizer.SanitizeAndWarn(instruction, _logger, "Polish_Inst")}\n\n" +
                          $"Nội dung gốc:\n<original_text>\n{PromptSanitizer.SanitizeAndWarn(originalText, _logger, "Polish_Text")}\n</original_text>";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithFallbackAsync(messages);

            var text = LlmOutputValidator.ValidateRewriteResponse(completion.Content[0].Text.Trim(), _logger);
            var tokens = completion.Usage?.TotalTokenCount ?? 0;

            await DeductTokenAsync(userId, tokens);
            return new AiWritingResult { GeneratedText = text, TotalTokens = tokens };
        }

        public async Task<AiSuggestionResult> SuggestAsync(Guid projectId, string context, string targetType, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var systemPrompt = "Bạn là người cố vấn sáng tác (Brainstorming Partner). Tác giả cung cấp cho bạn một số ý tưởng hoặc bối cảnh. Hãy đưa ra các gợi ý sáng tạo. Dùng định dạng trả lời ngắn gọn. Trả lời bằng tiếng Việt.";
            var userMsg = $"Loại gợi ý (targetType): {targetType}\n" +
                          $"Ngữ cảnh/Ý tưởng hiện có:\n<context>\n{PromptSanitizer.SanitizeAndWarn(context, _logger, "Suggest_Context")}\n</context>\n" +
                          "Hãy đưa ra 3-5 gợi ý hấp dẫn dạng gạch đầu dòng và 1 đoạn nhận xét ngắn.";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithFallbackAsync(messages);

            var rawText = completion.Content[0].Text.Trim();
            var tokens = completion.Usage?.TotalTokenCount ?? 0;

            await DeductTokenAsync(userId, tokens);
            
            // Xử lý đơn giản: coi rawText là Analysis, không rã riêng List<string> (frontend tự map).
            return new AiSuggestionResult { Analysis = rawText, Suggestions = new List<string>(), TotalTokens = tokens };
        }

        public async Task<AiSceneAnalysisResult> AnalyzeScenesAsync(Guid projectId, string chapterContent, Guid userId)
        {
            await CheckAndDeductTokenAsync(projectId, userId);

            var safeContent = PromptSanitizer.SanitizeAndWarn(chapterContent, _logger, "AnalyzeScenes");
            var systemPrompt = "Bạn là biên tập viên văn học chuyên phân tích cấu trúc. " +
                               "Nhiệm vụ: đọc chương truyện và phân rã thành các phân cảnh (Scenes/Beats). " +
                               "QUAN TRỌNG: Chỉ dựa vào văn bản được cung cấp. " +
                               "Trả về JSON thuần túy, không thêm bất kỳ text nào: " +
                               "{\"chapterSummary\":\"...\",\"scenes\":[{\"title\":\"...\",\"description\":\"...\",\"openingLine\":\"câu đầu của cảnh\",\"type\":\"Action|Dialogue|Introspection|Transition|Revelation\"}]}";
            var userMsg = $"Phân rã thành các Cảnh:\n<chapter>\n{safeContent[..Math.Min(15000, safeContent.Length)]}\n</chapter>";

            var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt), ChatMessage.CreateUserMessage(userMsg) };
            var completion = await CompleteChatWithFallbackAsync(messages);
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
                        OpeningLine = s.OpeningLine ?? "",
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
            var completion = await CompleteChatWithFallbackAsync(messages);
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
            public string? OpeningLine { get; set; }
            public string? Type { get; set; }
        }
    }
}
