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
    public class AiRewriteService : IAiRewriteService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly ILogger<AiRewriteService> _logger;
        private readonly ChatClient _chatClient;        // LM Studio (fallback)
        private readonly ChatClient? _geminiChatClient; // Gemini (primary)
        private readonly bool _geminiIsGemma;           // Gemma không hỗ trợ system role

        public AiRewriteService(AppDbContext context, IConfiguration config, ILogger<AiRewriteService> logger)
        {
            _context = context;
            _config = config;
            _logger = logger;

            // LM Studio (fallback)
            var baseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var apiKey = config["AI:ApiKey"] ?? "lm-studio";
            var model = config["AI:ChatModel"] ?? "qwen/qwen3.5-9b";
            var lmOptions = new OpenAIClientOptions { Endpoint = new Uri(baseUrl) };
            _chatClient = new OpenAIClient(new ApiKeyCredential(apiKey), lmOptions).GetChatClient(model);

            // Gemini (primary)
            var geminiKey = config["Gemini:ChatApiKey"] ?? string.Empty;
            if (!string.IsNullOrEmpty(geminiKey))
            {
                var geminiModel = config["Gemini:ChatModel"] ?? "gemma-3-27b-it";
                _geminiIsGemma = geminiModel.StartsWith("gemma", StringComparison.OrdinalIgnoreCase);
                var geminiOptions = new OpenAIClientOptions
                {
                    Endpoint = new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"),
                    NetworkTimeout = TimeSpan.FromMinutes(3),
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
                    var geminiMessages = _geminiIsGemma
                        ? GeminiRetryHelper.FlattenSystemForGemma(messages)
                        : messages;
                    var geminiResult = await GeminiRetryHelper.ExecuteAsync(
                        () => _geminiChatClient.CompleteChatAsync(geminiMessages),
                        _logger, "Gemini Rewrite");
                    return geminiResult.Value;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Gemini rewrite thất bại, fallback về LM Studio.");
                }
            }

            // LM Studio fallback (Qwen3: append /no_think)
            var lmMessages = messages.ToList();
            var lastUser = lmMessages.LastOrDefault(m => m is UserChatMessage);
            if (lastUser != null)
            {
                var idx = lmMessages.LastIndexOf(lastUser);
                var originalText = lastUser.Content[0].Text;
                if (!originalText.Contains("/no_think"))
                    lmMessages[idx] = ChatMessage.CreateUserMessage(originalText + " /no_think");
            }

            var result = await _chatClient.CompleteChatAsync(lmMessages);
            return result.Value;
        }

        public async Task<RewriteResult> RewriteAsync(Guid projectId, Guid? chapterId, string originalText, string instruction, Guid userId)
        {
            // 1. Kiểm tra ownership
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId)
                ?? throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");

            // 2. Lấy user + DEK
            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Master key not configured.");
            var user = await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("Người dùng không tồn tại.");
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);

            // 3. Build prompt
            var systemPrompt =
                "Bạn là một trợ lý viết văn chuyên nghiệp, hỗ trợ tác giả người Việt.\n" +
                "Nhiệm vụ: Viết lại đoạn văn được cung cấp theo hướng dẫn của tác giả.\n" +
                "Yêu cầu:\n" +
                "- Giữ nguyên ý nghĩa và nội dung cốt lõi.\n" +
                "- Bảo toàn văn phong, giọng điệu nhân vật nếu có.\n" +
                "- Chỉ trả về đoạn văn đã viết lại, KHÔNG thêm giải thích hay tiêu đề.\n" +
                "- Viết bằng tiếng Việt.";

            var userMessage = string.IsNullOrWhiteSpace(instruction)
                ? $"Hãy viết lại đoạn văn sau:\n\n---\n{originalText}\n---"
                : $"Hãy viết lại đoạn văn sau theo hướng dẫn: {instruction}\n\n---\n{originalText}\n---";

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage(systemPrompt),
                ChatMessage.CreateUserMessage(userMessage),
            };

            // 4. Gọi AI
            var completion = await CompleteChatWithFallbackAsync(messages);
            var rewrittenText = completion.Content[0].Text.Trim();
            var totalTokens = completion.Usage?.TotalTokenCount ?? 0;

            // 5. Lưu lịch sử (encrypt)
            var record = new RewriteHistory
            {
                ProjectId = projectId,
                ChapterId = chapterId,
                UserId = userId,
                OriginalText = EncryptionHelper.EncryptWithMasterKey(originalText, rawDek),
                RewrittenText = EncryptionHelper.EncryptWithMasterKey(rewrittenText, rawDek),
                Instruction = EncryptionHelper.EncryptWithMasterKey(instruction ?? string.Empty, rawDek),
                TotalTokens = totalTokens,
            };
            _context.RewriteHistories.Add(record);
            await _context.SaveChangesAsync();

            return new RewriteResult
            {
                HistoryId = record.Id,
                OriginalText = originalText,
                RewrittenText = rewrittenText,
                Instruction = instruction ?? string.Empty,
                TotalTokens = totalTokens,
                CreatedAt = record.CreatedAt,
            };
        }

        public async Task<RewriteHistoryResult> GetHistoryAsync(Guid projectId, Guid userId, Guid? chapterId, int page, int pageSize)
        {
            // Kiểm tra ownership
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId)
                ?? throw new KeyNotFoundException("Dự án không tồn tại.");

            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Master key not configured.");
            var user = await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("Người dùng không tồn tại.");
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);

            var query = _context.RewriteHistories
                .Where(r => r.ProjectId == projectId && r.UserId == userId);

            if (chapterId.HasValue)
                query = query.Where(r => r.ChapterId == chapterId);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new RewriteHistoryResult
            {
                Items = items.Select(r => new RewriteHistoryItem
                {
                    Id = r.Id,
                    ChapterId = r.ChapterId,
                    OriginalText = EncryptionHelper.DecryptWithMasterKey(r.OriginalText, rawDek),
                    RewrittenText = EncryptionHelper.DecryptWithMasterKey(r.RewrittenText, rawDek),
                    Instruction = EncryptionHelper.DecryptWithMasterKey(r.Instruction, rawDek),
                    TotalTokens = r.TotalTokens,
                    CreatedAt = r.CreatedAt,
                }).ToList(),
                TotalCount = total,
                Page = page,
                PageSize = pageSize,
            };
        }
    }
}
