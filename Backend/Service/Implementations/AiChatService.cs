using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenAI;
using OpenAI.Chat;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using Repository.Data;
using Service.Helpers;
using Service.Interfaces;
using System.ClientModel;

namespace Service.Implementations
{
    public class AiChatService : IAiChatService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmbeddingService _embeddingService;
        private readonly ChatClient _chatClient;

        // Số chunk context tối đa lấy cho mỗi câu hỏi
        private const int TopK = 5;

        public AiChatService(AppDbContext context, IConfiguration config, IEmbeddingService embeddingService)
        {
            _context = context;
            _config = config;
            _embeddingService = embeddingService;

            var baseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var apiKey = config["AI:ApiKey"] ?? "lm-studio";
            var model = config["AI:ChatModel"] ?? "llama-3.2-3b-instruct";

            var options = new OpenAIClientOptions { Endpoint = new Uri(baseUrl) };
            _chatClient = new ChatClient(model, new ApiKeyCredential(apiKey), options);
        }

        public async Task<AiChatResult> ChatAsync(Guid projectId, string question, Guid userId)
        {
            // 1. Xác minh ownership
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId)
                ?? throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");

            // 2. Kiểm tra subscription
            var sub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync();

            if (sub == null)
                throw new InvalidOperationException("Bạn chưa có gói đăng ký hợp lệ. Vui lòng đăng ký gói để dùng AI Chat.");

            if (sub.UsedAnalysisCount >= sub.Plan.MaxAnalysisCount)
                throw new InvalidOperationException($"Bạn đã dùng hết {sub.Plan.MaxAnalysisCount} lần phân tích trong kỳ này.");

            // 3. Embed câu hỏi
            var questionEmbedding = await _embeddingService.GetEmbeddingAsync(question);
            var queryVector = new Vector(questionEmbedding);

            // 4. Vector search — lấy TopK chunks gần nhất theo cosine distance
            var topChunks = await _context.ChapterChunks
                .Where(c => c.ProjectId == projectId && c.Embedding != null)
                .OrderBy(c => c.Embedding!.CosineDistance(queryVector))
                .Take(TopK)
                .ToListAsync();

            if (topChunks.Count == 0)
                throw new InvalidOperationException("Chưa có nội dung được embed trong dự án này. Hãy chunk và embed các chương trước.");

            // 5. Decrypt chunk content để làm context
            var user = await _context.Users.FindAsync(userId)!;
            var masterKey = _config["Security:MasterKey"]!;
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user!.DataEncryptionKey!, masterKey);

            var contextTexts = topChunks
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
                .ToList();

            // 6. Gọi OpenAI Chat với RAG context
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(project.Title, rawDek);
            var systemPrompt = BuildSystemPrompt(projectTitle, contextTexts);

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage(systemPrompt),
                ChatMessage.CreateUserMessage(question),
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            var completion = response.Value;

            var answer = completion.Content[0].Text;
            var inputTokens = completion.Usage.InputTokenCount;
            var outputTokens = completion.Usage.OutputTokenCount;
            var totalTokens = completion.Usage.TotalTokenCount;

            // 7. Kiểm tra token limit
            if (sub.UsedTokens + totalTokens > sub.Plan.MaxTokenLimit)
                throw new InvalidOperationException($"Không đủ token. Còn lại: {sub.Plan.MaxTokenLimit - sub.UsedTokens} token.");

            // 8. Deduct usage
            sub.UsedAnalysisCount += 1;
            sub.UsedTokens += totalTokens;
            await _context.SaveChangesAsync();

            return new AiChatResult
            {
                Answer = answer,
                InputTokens = inputTokens,
                OutputTokens = outputTokens,
                TotalTokens = totalTokens,
                ContextChunks = contextTexts,
            };
        }

        private static string BuildSystemPrompt(string projectTitle, List<string> contextChunks)
        {
            var context = string.Join("\n\n---\n\n", contextChunks.Select((c, i) => $"[Đoạn {i + 1}]\n{c}"));
            return $"""
                Bạn là trợ lý AI giúp tác giả phân tích và trả lời câu hỏi về nội dung truyện "{projectTitle}".
                
                Dưới đây là các đoạn nội dung liên quan từ truyện:
                
                {context}
                
                Hướng dẫn:
                - Chỉ trả lời dựa trên nội dung truyện được cung cấp ở trên.
                - Nếu không tìm thấy thông tin trong context, hãy nói rõ "Tôi không tìm thấy thông tin này trong nội dung truyện."
                - Trả lời bằng tiếng Việt, súc tích và chính xác.
                - Không bịa đặt thông tin không có trong context.
                """;
        }
    }
}
