using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
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
        private readonly ILogger<ProjectReportService> _logger;
        private readonly ChatClient _chatClient;        // LM Studio (fallback)
        private readonly ChatClient? _geminiChatClient; // Gemini (primary)
        private const int TopK = 8;

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

        public ProjectReportService(AppDbContext context, IConfiguration config, IEmbeddingService embeddingService, ILogger<ProjectReportService> logger)
        {
            _context = context;
            _config = config;
            _embeddingService = embeddingService;
            _logger = logger;

            // LM Studio (fallback)
            var baseUrl = config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var apiKey = config["AI:ApiKey"] ?? "lm-studio";
            var model = config["AI:ChatModel"] ?? "qwen/qwen3.5-9b";
            var lmOptions = new OpenAIClientOptions
            {
                Endpoint = new Uri(baseUrl),
                NetworkTimeout = TimeSpan.FromMinutes(10),
            };
            _chatClient = new OpenAIClient(new ApiKeyCredential(apiKey), lmOptions).GetChatClient(model);

            // Gemini (primary)
            var geminiKey = config["Gemini:ChatApiKey"] ?? string.Empty;
            if (!string.IsNullOrEmpty(geminiKey))
            {
                var geminiModel = config["Gemini:ChatModel"] ?? "gemini-2.0-flash";
                var geminiOptions = new OpenAIClientOptions
                {
                    Endpoint = new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"),
                    NetworkTimeout = TimeSpan.FromMinutes(5),
                };
                _geminiChatClient = new OpenAIClient(new ApiKeyCredential(geminiKey), geminiOptions).GetChatClient(geminiModel);
            }
        }

        private async Task<OpenAI.Chat.ChatCompletion> CompleteChatWithFallbackAsync(
            IEnumerable<ChatMessage> messages, int maxTokens = 2500)
        {
            var options = new ChatCompletionOptions { MaxOutputTokenCount = maxTokens };

            if (_geminiChatClient != null)
            {
                try
                {
                    var geminiResult = await GeminiRetryHelper.ExecuteAsync(
                        () => _geminiChatClient.CompleteChatAsync(messages, options),
                        _logger, "Gemini Report");
                    return geminiResult.Value;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Gemini chat thất bại, fallback về LM Studio.");
                }
            }

            var result = await _chatClient.CompleteChatAsync(messages, options);
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

            if (chunks.Count == 0)
                throw new InvalidOperationException("Dự án chưa có nội dung được nhúng (embed). Vui lòng chunk và embed các chương trong Workspace trước khi phân tích.");

            var decryptedChunks = chunks
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
                .ToList();

            // 5. Fetch Story Bible context (genres, summary, characters, worldbuilding)
            var projectFull = await _context.Projects
                .Include(p => p.ProjectGenres).ThenInclude(pg => pg.Genre)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            var genres = projectFull?.ProjectGenres.Select(pg => pg.Genre.Name).ToList() ?? new();
            var summary = !string.IsNullOrEmpty(project.Summary)
                ? EncryptionHelper.DecryptWithMasterKey(project.Summary, rawDek)
                : null;

            var characterEntries = await _context.CharacterEntries
                .Where(c => c.ProjectId == projectId)
                .Take(5).ToListAsync();
            var worldEntries = await _context.WorldbuildingEntries
                .Where(w => w.ProjectId == projectId)
                .Take(3).ToListAsync();

            var bibleBuilder = new System.Text.StringBuilder();
            if (genres.Count > 0)
                bibleBuilder.AppendLine($"Thể loại: {string.Join(", ", genres)}");
            if (!string.IsNullOrWhiteSpace(summary))
                bibleBuilder.AppendLine($"Tóm tắt: {summary[..Math.Min(300, summary.Length)]}");
            if (characterEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Nhân vật:");
                foreach (var ch in characterEntries)
                {
                    var chName = EncryptionHelper.DecryptWithMasterKey(ch.Name, rawDek);
                    var chDesc = EncryptionHelper.DecryptWithMasterKey(ch.Description, rawDek);
                    bibleBuilder.AppendLine($"- {chName} ({ch.Role}): {chDesc[..Math.Min(120, chDesc.Length)]}");
                }
            }
            if (worldEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Thế giới:");
                foreach (var w in worldEntries)
                {
                    var wTitle = EncryptionHelper.DecryptWithMasterKey(w.Title, rawDek);
                    var wContent = EncryptionHelper.DecryptWithMasterKey(w.Content, rawDek);
                    bibleBuilder.AppendLine($"- [{w.Category}] {wTitle}: {wContent[..Math.Min(120, wContent.Length)]}");
                }
            }
            var storyBibleText = bibleBuilder.ToString().Trim();

            var criteria = await EvaluateWithAiAsync(projectTitle, decryptedChunks, storyBibleText);
            var reportStatus = "Completed";

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

        private async Task<List<CriterionResult>> EvaluateWithAiAsync(
            string projectTitle, List<string> decryptedChunks, string? storyBibleText = null)
        {
            // Use first TopK chunks as context (avoid token limit)
            var contextText = string.Join("\n\n---\n\n",
                decryptedChunks.Take(TopK).Select((c, i) => $"[Đoạn {i + 1}]\n{c}"));

            var jsonTemplate = @"[
  {""key"":""1.1"",""score"":0,""maxScore"":10,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""1.2"",""score"":0,""maxScore"":10,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""1.3"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""2.1"",""score"":0,""maxScore"":10,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""2.2"",""score"":0,""maxScore"":10,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""2.3"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""3.1"",""score"":0,""maxScore"":10,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""3.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""3.3"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""4.1"",""score"":0,""maxScore"":10,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""4.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""4.3"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""5.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
  {""key"":""5.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]}
]";

            var biblePart = string.IsNullOrWhiteSpace(storyBibleText)
                ? ""
                : $"\n\nTHÔNG TIN TÁC PHẨM:\n{storyBibleText}";

            var prompt = $$"""
                Bạn là giám khảo văn học. Đọc kỹ văn bản và điền đầy đủ tất cả 14 tiêu chí vào JSON bên dưới.

                QUY TẮC BẮT BUỘC:
                - Điền feedback, errors, suggestions cho TẤT CẢ 14 mục, không được để trống
                - feedback: 1-2 câu nhận xét thực tế từ văn bản
                - errors: 1-2 lỗi cụ thể (có thể trích dẫn câu văn)
                - suggestions: 1-2 gợi ý sửa lỗi cụ thể
                - score: nghiêm khắc, thông thường 40-60% điểm tối đa

                KEY: 1.1=Nhất quán bối cảnh(10) 1.2=Nhân quả sự kiện(10) 1.3=Nút thắt(5) 2.1=Động cơ nhân vật(10) 2.2=Tâm lý nhân vật(10) 2.3=Đối thoại(5) 3.1=Ngữ pháp(10) 3.2=Đa dạng câu(5) 3.3=Tránh sáo ngữ(5) 4.1=Sáng tạo(10) 4.2=Thể loại(5) 4.3=Nhịp độ(5) 5.1=Hoàn thiện(5) 5.2=Định dạng(5){{biblePart}}

                Nội dung "{{projectTitle}}":
                {{contextText}}

                JSON (14 mục, điền đầy đủ):
                {{jsonTemplate}}
                """;

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage("Bạn là giám khảo văn học. Nhiệm vụ: điền đầy đủ 14 tiêu chí JSON với feedback/errors/suggestions thực tế. KHÔNG bỏ trống bất kỳ mục nào. Chỉ trả về JSON thuần túy."),
                ChatMessage.CreateUserMessage(prompt),
            };

            var response = await CompleteChatWithFallbackAsync(messages, maxTokens: 2500);
            var raw = response.Content[0].Text.Trim();

            // Strip markdown code fences if present
            if (raw.StartsWith("```")) raw = raw.Split('\n', 2)[1];
            if (raw.EndsWith("```")) raw = raw[..^3];

            var aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(raw.Trim(),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? throw new InvalidOperationException("Không thể parse kết quả từ AI.");

            return MergeWithRubric(aiResults);
        }

        private static List<CriterionResult> MergeWithRubric(List<AiScoreItem> aiResults)
        {
            var lookup = aiResults
                .GroupBy(x => x.Key)
                .ToDictionary(g => g.Key, g => g.First());
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
                    Errors = ai?.Errors ?? new List<string>(),
                    Suggestions = ai?.Suggestions ?? new List<string>(),
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
            public List<string> Errors { get; set; } = new();
            public List<string> Suggestions { get; set; } = new();
        }
    }
}
