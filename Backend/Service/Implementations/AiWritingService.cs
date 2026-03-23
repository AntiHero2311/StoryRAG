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

            var systemPrompt = "Bạn là một nhà văn xuất sắc. Dựa vào yêu cầu chi tiết (thể loại, bối cảnh, dàn ý), hãy viết một chương truyện thật hấp dẫn, mạch lạc, có chiều sâu cảm xúc. " +
                               "KHÔNG viết tiêu đề chương hay giới thiệu. Chỉ xuất trực tiếp nội dung văn bản. " +
                               "Hành văn tự nhiên, mượt mà, đúng chuẩn tiếng Việt.";
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

            var systemPrompt = "Bạn là một nhà văn giàu kinh nghiệm. Nhiệm vụ của bạn là tiếp nối đoạn truyện đang dang dở, đảm bảo giữ vững văn phong (tone and voice), tính cách nhân vật và mạch cảm xúc của đoạn trước đó. " +
                               "KHÔNG viết giới thiệu hoặc lời bình. Bắt đầu viết thẳng vào câu văn tiếp theo hoặc đoạn văn tiếp theo. Tiếng Việt chuẩn.";
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

            var systemPrompt = "Bạn là một biên tập viên văn học tinh tế (Editor). Hãy đọc đoạn văn dưới đây và trau chuốt (polish) nó để câu từ mượt mà hơn, hình ảnh sống động hơn, loại bỏ từ lặp, bắt lỗi ngữ pháp, nhưng MỘT CÁCH TUYỆT ĐỐI GÌỮ NGUYÊN 100% cốt truyện và ý nghĩa gốc. " +
                               "Chỉ xuất ra đoạn văn đã chỉnh sửa, KHÔNG bình luận, KHÔNG khen chê, KHÔNG viết lại quá đà làm sai lệc cá tính nhân vật. Tiếng Việt chuẩn.";
            
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
    }
}
