using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenAI;
using OpenAI.Chat;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.ClientModel;
using System.Text.Json;

namespace Service.Implementations
{
    public class ProjectReportService : IProjectReportService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmbeddingService _embeddingService;
        private readonly ChatClient _chatClient;
        private const int TopK = 20;

        // ── Rubric definition─────────────────────────────────────────────────────
        private static readonly List<(string Key, string Group, string Name, decimal Max)> Rubric = new()
        {
            ("1.1", "Cốt truyện & Mạch lạc",      "Tính nhất quán nội bộ",          10),
            ("1.2", "Cốt truyện & Mạch lạc",      "Liên kết nhân quả & Sự kiện",    10),
            ("1.3", "Cốt truyện & Mạch lạc",      "Nút thắt & Giải quyết",           5),
            ("2.1", "Xây dựng Nhân vật",           "Động cơ & Hành động",            10),
            ("2.2", "Xây dựng Nhân vật",           "Chiều sâu nhân vật",             10),
            ("2.3", "Xây dựng Nhân vật",           "Tương tác & Đối thoại",           5),
            ("3.1", "Ngôn từ & Văn phong",         "Ngữ pháp & Sự rõ ràng",          10),
            ("3.2", "Ngôn từ & Văn phong",         "Đa dạng cấu trúc câu",            5),
            ("3.3", "Ngôn từ & Văn phong",         "Tránh sáo ngữ",                   5),
            ("4.1", "Sáng tạo & Thể loại",         "Độ sáng tạo & Tránh lối mòn",   10),
            ("4.2", "Sáng tạo & Thể loại",         "Đặc trưng thể loại",              5),
            ("4.3", "Sáng tạo & Thể loại",         "Sức cuốn hút",                    5),
            ("5.1", "Tuân thủ & Hoàn thiện",       "Mức độ hoàn thiện bản thảo",      5),
            ("5.2", "Tuân thủ & Hoàn thiện",       "Tuân thủ định dạng",               5),
        };

        public ProjectReportService(AppDbContext context, IConfiguration config, IEmbeddingService embeddingService)
        {
            _context = context;
            _config = config;
            _embeddingService = embeddingService;

            var baseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var apiKey = config["AI:ApiKey"] ?? "lm-studio";
            var model = config["AI:ChatModel"] ?? "qwen/qwen3.5-9b";
            var options = new OpenAIClientOptions { Endpoint = new Uri(baseUrl) };
            var openAiClient = new OpenAIClient(new ApiKeyCredential(apiKey), options);
            _chatClient = openAiClient.GetChatClient(model);
        }

        private async Task<OpenAI.Chat.ChatCompletion> CompleteChatWithFallbackAsync(IEnumerable<ChatMessage> messages)
        {
            var result = await _chatClient.CompleteChatAsync(messages);
            return result.Value;
        }

        public async Task<ProjectReportResponse> AnalyzeAsync(Guid projectId, Guid userId)
        {
            // 1. Verify ownership
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId)
                ?? throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");

            // 2. Check subscription
            var sub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync()
                ?? throw new InvalidOperationException("Bạn chưa có gói đăng ký hợp lệ. Vui lòng đăng ký gói để dùng tính năng này.");

            if (sub.UsedAnalysisCount >= sub.Plan.MaxAnalysisCount)
                throw new InvalidOperationException($"Bạn đã dùng hết {sub.Plan.MaxAnalysisCount} lần phân tích trong kỳ này.");

            // 3. Decrypt user DEK
            var user = await _context.Users.FindAsync(userId)!;
            var masterKey = _config["Security:MasterKey"]!;
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user!.DataEncryptionKey!, masterKey);
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(project.Title, rawDek);

            // 4. Fetch all embedded chunks for this project
            var chunks = await _context.ChapterChunks
                .Where(c => c.ProjectId == projectId && c.Embedding != null)
                .ToListAsync();

            List<CriterionResult> criteria;
            string reportStatus;

            if (chunks.Count == 0)
            {
                // No embedded content → return mock
                criteria = GenerateMockCriteria();
                reportStatus = "MockData";
            }
            else
            {
                var decryptedChunks = chunks
                    .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
                    .ToList();

                try
                {
                    criteria = await EvaluateWithAiAsync(projectTitle, decryptedChunks);
                    reportStatus = "Completed";
                }
                catch
                {
                    criteria = GenerateMockCriteria();
                    reportStatus = "MockData";
                }
            }

            // 5. Calculate total
            var total = criteria.Sum(c => c.Score);

            // 6. Save to DB
            var report = new ProjectReport
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                UserId = userId,
                Status = reportStatus,
                TotalScore = total,
                CriteriaJson = JsonSerializer.Serialize(criteria),
                CreatedAt = DateTime.UtcNow,
            };
            _context.ProjectReports.Add(report);

            // 7. Deduct usage
            sub.UsedAnalysisCount += 1;
            await _context.SaveChangesAsync();

            return BuildResponse(report.Id, projectId, projectTitle, reportStatus, total, criteria);
        }

        public async Task<ProjectReportResponse?> GetLatestAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var report = await _context.ProjectReports
                .Include(r => r.Project)
                .Where(r => r.ProjectId == projectId && r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            if (report == null) return null;

            var user = await _context.Users.FindAsync(userId)!;
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user!.DataEncryptionKey!, _config["Security:MasterKey"]!);
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, rawDek);

            var criteria = JsonSerializer.Deserialize<List<CriterionResult>>(report.CriteriaJson) ?? new();
            return BuildResponse(report.Id, projectId, projectTitle, report.Status, report.TotalScore, criteria, report.CreatedAt);
        }

        public async Task<List<ProjectReportSummary>> GetAllAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            return await _context.ProjectReports
                .Where(r => r.ProjectId == projectId && r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new ProjectReportSummary
                {
                    Id = r.Id,
                    Status = r.Status,
                    TotalScore = r.TotalScore,
                    Classification = Classify(r.TotalScore),
                    CreatedAt = r.CreatedAt,
                })
                .ToListAsync();
        }

        public async Task<ProjectReportResponse?> GetByIdAsync(Guid reportId, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var report = await _context.ProjectReports
                .Include(r => r.Project)
                .FirstOrDefaultAsync(r => r.Id == reportId && r.ProjectId == projectId && r.UserId == userId);

            if (report == null) return null;

            var user = await _context.Users.FindAsync(userId)!;
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user!.DataEncryptionKey!, _config["Security:MasterKey"]!);
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, rawDek);

            var criteria = JsonSerializer.Deserialize<List<CriterionResult>>(report.CriteriaJson) ?? new();
            return BuildResponse(report.Id, projectId, projectTitle, report.Status, report.TotalScore, criteria, report.CreatedAt);
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private async Task VerifyOwnershipAsync(Guid projectId, Guid userId)
        {
            var exists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId);
            if (!exists)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        private async Task<List<CriterionResult>> EvaluateWithAiAsync(string projectTitle, List<string> decryptedChunks)
        {
            // Use first TopK chunks as context (avoid token limit)
            var contextText = string.Join("\n\n---\n\n",
                decryptedChunks.Take(TopK).Select((c, i) => $"[Đoạn {i + 1}]\n{c}"));

            var jsonTemplate = @"[
  {""key"":""1.1"",""score"":<số>,""maxScore"":10,""feedback"":""<nhận xét tiếng Việt>""},
  {""key"":""1.2"",""score"":<số>,""maxScore"":10,""feedback"":""<nhận xét>""},
  {""key"":""1.3"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""},
  {""key"":""2.1"",""score"":<số>,""maxScore"":10,""feedback"":""<nhận xét>""},
  {""key"":""2.2"",""score"":<số>,""maxScore"":10,""feedback"":""<nhận xét>""},
  {""key"":""2.3"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""},
  {""key"":""3.1"",""score"":<số>,""maxScore"":10,""feedback"":""<nhận xét>""},
  {""key"":""3.2"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""},
  {""key"":""3.3"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""},
  {""key"":""4.1"",""score"":<số>,""maxScore"":10,""feedback"":""<nhận xét>""},
  {""key"":""4.2"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""},
  {""key"":""4.3"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""},
  {""key"":""5.1"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""},
  {""key"":""5.2"",""score"":<số>,""maxScore"":5,""feedback"":""<nhận xét>""}
]";

            var prompt = $"""
                Bạn là chuyên gia đánh giá bản thảo văn học Việt Nam. Hãy đánh giá tác phẩm "{projectTitle}" theo rubric sau.

                Nội dung tác phẩm:
                {contextText}

                Hãy chấm điểm theo 14 tiêu chí sau và trả về JSON array (không có text nào ngoài JSON):
                {jsonTemplate}
                Chỉ trả về JSON array, không có markdown, không có giải thích thêm.
                """;

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage("Bạn là chuyên gia đánh giá bản thảo văn học. Chỉ trả về JSON thuần túy."),
                ChatMessage.CreateUserMessage(prompt),
            };

            var response = await CompleteChatWithFallbackAsync(messages);
            var raw = response.Content[0].Text.Trim();

            // Strip markdown code fences if present
            if (raw.StartsWith("```")) raw = raw.Split('\n', 2)[1];
            if (raw.EndsWith("```")) raw = raw[..^3];

            var aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(raw.Trim())
                ?? throw new InvalidOperationException("Không thể parse kết quả từ AI.");

            return MergeWithRubric(aiResults);
        }

        private static List<CriterionResult> MergeWithRubric(List<AiScoreItem> aiResults)
        {
            var lookup = aiResults.ToDictionary(x => x.Key);
            return Rubric.Select(r =>
            {
                lookup.TryGetValue(r.Key, out var ai);
                var score = ai != null ? Math.Clamp(ai.Score, 0, r.Max) : r.Max * 0.6m;
                return new CriterionResult
                {
                    Key = r.Key,
                    GroupName = r.Group,
                    CriterionName = r.Name,
                    Score = score,
                    MaxScore = r.Max,
                    Feedback = ai?.Feedback ?? "Chưa có nhận xét.",
                };
            }).ToList();
        }

        private static List<CriterionResult> GenerateMockCriteria()
        {
            var rng = new Random();
            var mockFeedbacks = new Dictionary<string, string>
            {
                ["1.1"] = "Cần xem xét thêm về tính nhất quán trong bối cảnh và thời gian của câu chuyện.",
                ["1.2"] = "Các sự kiện có liên kết tương đối logic, nhưng một số chuyển cảnh cần mượt mà hơn.",
                ["1.3"] = "Nút thắt câu chuyện khá rõ ràng, cách giải quyết cần thêm chiều sâu.",
                ["2.1"] = "Động cơ nhân vật chính cần được thể hiện rõ hơn qua hành động cụ thể.",
                ["2.2"] = "Nhân vật có tiềm năng phát triển đa chiều, cần khai thác thêm nội tâm.",
                ["2.3"] = "Đối thoại tự nhiên, phản ánh được tính cách nhân vật khá tốt.",
                ["3.1"] = "Ngữ pháp và chính tả nhìn chung tốt, cần chú ý một số lỗi dấu câu.",
                ["3.2"] = "Cấu trúc câu còn khá đơn điệu, nên đa dạng hóa nhịp điệu văn xuôi.",
                ["3.3"] = "Còn xuất hiện một số cụm từ sáo rỗng, cần thay thế bằng cách diễn đạt sáng tạo hơn.",
                ["4.1"] = "Ý tưởng có điểm mới lạ nhất định, nhưng cốt truyện vẫn theo một số mô-típ quen thuộc.",
                ["4.2"] = "Tác phẩm bám sát đặc trưng thể loại khá tốt.",
                ["4.3"] = "Nhịp độ truyện ổn định, có thể tạo thêm điểm căng thẳng để duy trì hứng thú.",
                ["5.1"] = "Bản thảo cần được định dạng và phân chương rõ ràng hơn trước khi gửi biên tập.",
                ["5.2"] = "Đánh giá dựa trên dữ liệu mẫu — cần embed nội dung để phân tích chính xác.",
            };

            return Rubric.Select(r =>
            {
                var ratio = 0.5m + (decimal)rng.NextDouble() * 0.35m;
                return new CriterionResult
                {
                    Key = r.Key,
                    GroupName = r.Group,
                    CriterionName = r.Name,
                    Score = Math.Round(r.Max * ratio, 1),
                    MaxScore = r.Max,
                    Feedback = mockFeedbacks.TryGetValue(r.Key, out var f) ? f : "Chưa có nhận xét chi tiết.",
                };
            }).ToList();
        }

        private static ProjectReportResponse BuildResponse(
            Guid reportId, Guid projectId, string projectTitle,
            string status, decimal totalScore, List<CriterionResult> criteria,
            DateTime? createdAt = null)
        {
            var groups = criteria
                .GroupBy(c => c.GroupName)
                .Select(g => new GroupResult
                {
                    Name = g.Key,
                    Score = g.Sum(c => c.Score),
                    MaxScore = g.Sum(c => c.MaxScore),
                    Criteria = g.ToList(),
                })
                .ToList();

            return new ProjectReportResponse
            {
                Id = reportId,
                ProjectId = projectId,
                ProjectTitle = projectTitle,
                Status = status,
                TotalScore = Math.Round(totalScore, 1),
                Classification = Classify(totalScore),
                Groups = groups,
                CreatedAt = createdAt ?? DateTime.UtcNow,
            };
        }

        private static string Classify(decimal score) => score switch
        {
            > 85 => "Xuất sắc",
            > 70 => "Khá",
            > 50 => "Trung bình",
            _ => "Cần sửa lớn",
        };

        private class AiScoreItem
        {
            public string Key { get; set; } = string.Empty;
            public decimal Score { get; set; }
            public decimal MaxScore { get; set; }
            public string Feedback { get; set; } = string.Empty;
        }
    }
}
