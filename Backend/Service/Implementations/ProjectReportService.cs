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
        private readonly List<GeminiChatClientSlot> _geminiChatClients = []; // Gemini pool
        private static int _nextGeminiChatKeyIndex;
        private const int TopK = 8;

        // ── Rubric definition (8 nhóm, 20 tiêu chí, 100 điểm) ──────────────────
        private static readonly List<(string Key, string Group, string Name, decimal Max)> Rubric = new()
        {
            // 1. Expectations — Kỳ vọng thể loại & tiền đề (10 điểm)
            ("1.1", "Kỳ vọng",                    "Thể loại",                        5),
            ("1.2", "Kỳ vọng",                    "Tiền đề",                         5),
            // 2. Characters — Nhân vật (20 điểm)
            ("2.1", "Nhân vật",                    "Phát triển nhân vật",              5),
            ("2.2", "Nhân vật",                    "Tính cách & Sự hấp dẫn",          5),
            ("2.3", "Nhân vật",                    "Mối quan hệ & Tương tác",         5),
            ("2.4", "Nhân vật",                    "Sự đa dạng nhân vật",             5),
            // 3. Plot & Structure — Cốt truyện & Cấu trúc (15 điểm)
            ("3.1", "Cốt truyện & Cấu trúc",      "Diễn biến cốt truyện",            5),
            ("3.2", "Cốt truyện & Cấu trúc",      "Cấu trúc & Tổ chức",              5),
            ("3.3", "Cốt truyện & Cấu trúc",      "Kết thúc",                        5),
            // 4. Writing & Language — Ngôn ngữ & Văn phong (15 điểm)
            ("4.1", "Ngôn ngữ & Văn phong",        "Phong cách & Giọng văn",          5),
            ("4.2", "Ngôn ngữ & Văn phong",        "Ngữ pháp & Sự trôi chảy",        5),
            ("4.3", "Ngôn ngữ & Văn phong",        "Tính dễ đọc",                     5),
            // 5. Enjoyment & Engagement — Sự hấp dẫn (10 điểm)
            ("5.1", "Sự hấp dẫn",                 "Mức độ thú vị",                    5),
            ("5.2", "Sự hấp dẫn",                 "Mức độ cuốn hút",                 5),
            // 6. Emotional Impact — Tác động cảm xúc (10 điểm)
            ("6.1", "Tác động cảm xúc",           "Sự đồng cảm",                     5),
            ("6.2", "Tác động cảm xúc",           "Chiều sâu cảm xúc",               5),
            // 7. Themes — Chủ đề (10 điểm)
            ("7.1", "Chủ đề",                     "Khám phá chủ đề",                 5),
            ("7.2", "Chủ đề",                     "Chiều sâu chủ đề",                5),
            // 8. World-Building & Setting — Xây dựng thế giới (10 điểm)
            ("8.1", "Xây dựng thế giới",           "Xây dựng thế giới",               5),
            ("8.2", "Xây dựng thế giới",           "Bối cảnh",                        5),
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

            // Gemini (primary pool for report analysis)
            var geminiModel = config["Gemini:ChatModel"] ?? "gemma-3-27b-it";
            var geminiIsGemma = geminiModel.StartsWith("gemma", StringComparison.OrdinalIgnoreCase);
            var geminiKeys = ReadApiKeys(
                config,
                "Gemini:AnalyzeApiKey",
                "Gemini:ChatApiKey",
                "Gemini:AnalyzeApiKeys",
                "Gemini:ChatApiKeys");

            if (geminiKeys.Count > 0)
            {
                var geminiOptions = new OpenAIClientOptions
                {
                    Endpoint = new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"),
                    NetworkTimeout = TimeSpan.FromMinutes(5),
                };

                for (var i = 0; i < geminiKeys.Count; i++)
                {
                    var client = new OpenAIClient(new ApiKeyCredential(geminiKeys[i]), geminiOptions).GetChatClient(geminiModel);
                    _geminiChatClients.Add(new GeminiChatClientSlot(client, geminiIsGemma, $"key {i + 1}/{geminiKeys.Count}"));
                }
            }
        }

        private async Task<OpenAI.Chat.ChatCompletion> CompleteChatWithFallbackAsync(
            IEnumerable<ChatMessage> messages, int maxTokens = 2500, float temperature = 0.7f)
        {
            var options = new ChatCompletionOptions
            {
                MaxOutputTokenCount = maxTokens,
                Temperature = temperature,
            };

            if (_geminiChatClients.Count > 0)
            {
                Exception? lastGeminiError = null;
                foreach (var slot in GetRotatedGeminiClients())
                {
                    try
                    {
                        var geminiMessages = slot.IsGemma
                            ? GeminiRetryHelper.FlattenSystemForGemma(messages)
                            : messages;
                        var geminiResult = await GeminiRetryHelper.ExecuteAsync(
                            () => slot.Client.CompleteChatAsync(geminiMessages, options),
                            _logger,
                            $"Gemini Report ({slot.KeyLabel})");
                        return geminiResult.Value;
                    }
                    catch (Exception ex)
                    {
                        lastGeminiError = ex;
                        _logger.LogWarning(ex, "Gemini chat thất bại với {KeyLabel}, thử key khác.", slot.KeyLabel);
                    }
                }

                _logger.LogWarning(lastGeminiError, "Gemini chat thất bại với toàn bộ key, fallback về LM Studio.");
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

            // 4. Fetch chapters stats + all embedded chunks
            var chapters = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .OrderBy(c => c.ChapterNumber)
                .ToListAsync();

            var chapterCount = chapters.Count;
            var totalWords = chapters.Sum(c => c.WordCount);

            // Chỉ lấy chunks thuộc active version của mỗi chương
            var activeVersionIds = await _context.Chapters
                .Where(c => c.ProjectId == projectId && c.CurrentVersionId.HasValue)
                .Select(c => c.CurrentVersionId!.Value)
                .ToListAsync();

            var chunks = await _context.ChapterChunks
                .Where(c => c.ProjectId == projectId && c.Embedding != null && activeVersionIds.Contains(c.VersionId))
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
                .ToListAsync();
            var worldEntries = await _context.WorldbuildingEntries
                .Where(w => w.ProjectId == projectId)
                .ToListAsync();
            var styleGuideEntries = await _context.StyleGuideEntries
                .Where(s => s.ProjectId == projectId)
                .ToListAsync();
            var themeEntries = await _context.ThemeEntries
                .Where(t => t.ProjectId == projectId)
                .ToListAsync();
            var plotNoteEntries = await _context.PlotNoteEntries
                .Where(p => p.ProjectId == projectId)
                .ToListAsync();

            var bibleBuilder = new System.Text.StringBuilder();
            if (genres.Count > 0)
                bibleBuilder.AppendLine($"Thể loại: {string.Join(", ", genres)}");
            if (!string.IsNullOrWhiteSpace(summary))
                bibleBuilder.AppendLine($"Tóm tắt: {summary[..Math.Min(300, summary.Length)]}");
            if (characterEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Nhân vật quan trọng:");
                foreach (var ch in characterEntries)
                {
                    var chName = EncryptionHelper.DecryptWithMasterKey(ch.Name, rawDek);
                    var chDesc = EncryptionHelper.DecryptWithMasterKey(ch.Description, rawDek);
                    var chBg = !string.IsNullOrWhiteSpace(ch.Background) ? EncryptionHelper.DecryptWithMasterKey(ch.Background, rawDek) : "";
                    var fullDesc = chDesc + (string.IsNullOrWhiteSpace(chBg) ? "" : $"\nTiểu sử: {chBg}");
                    bibleBuilder.AppendLine($"- {chName} ({ch.Role}): {fullDesc[..Math.Min(1500, fullDesc.Length)]}");
                }
            }
            if (worldEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Thế giới quan trọng:");
                foreach (var w in worldEntries)
                {
                    var wTitle = EncryptionHelper.DecryptWithMasterKey(w.Title, rawDek);
                    var wContent = EncryptionHelper.DecryptWithMasterKey(w.Content, rawDek);
                    bibleBuilder.AppendLine($"- [{w.Category}] {wTitle}: {wContent[..Math.Min(1500, wContent.Length)]}");
                }
            }
            if (styleGuideEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Phong cách viết & Ngôn ngữ:");
                foreach (var s in styleGuideEntries)
                {
                    var sContent = EncryptionHelper.DecryptWithMasterKey(s.Content, rawDek);
                    bibleBuilder.AppendLine($"- [{s.Aspect}]: {sContent[..Math.Min(1500, sContent.Length)]}");
                }
            }
            if (themeEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Chủ đề & Trọng tâm:");
                foreach (var t in themeEntries)
                {
                    var tTitle = EncryptionHelper.DecryptWithMasterKey(t.Title, rawDek);
                    var tDesc = EncryptionHelper.DecryptWithMasterKey(t.Description, rawDek);
                    var tNotes = !string.IsNullOrWhiteSpace(t.Notes) ? EncryptionHelper.DecryptWithMasterKey(t.Notes, rawDek) : "";
                    var fullDesc = tDesc + (string.IsNullOrWhiteSpace(tNotes) ? "" : $"\nGhi chú thêm: {tNotes}");
                    bibleBuilder.AppendLine($"- {tTitle}: {fullDesc[..Math.Min(1500, fullDesc.Length)]}");
                }
            }
            if (plotNoteEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Ghi chú cốt truyện & Sự kiện:");
                foreach (var p in plotNoteEntries)
                {
                    var pTitle = EncryptionHelper.DecryptWithMasterKey(p.Title, rawDek);
                    var pContent = EncryptionHelper.DecryptWithMasterKey(p.Content, rawDek);
                    bibleBuilder.AppendLine($"- [{p.Type}] {pTitle}: {pContent[..Math.Min(1500, pContent.Length)]}");
                }
            }
            var storyBibleText = bibleBuilder.ToString().Trim();

            // Include author's AI instructions if set
            var aiInstructions = !string.IsNullOrEmpty(project.AiInstructions)
                ? EncryptionHelper.DecryptWithMasterKey(project.AiInstructions, rawDek)
                : null;

            var (criteria, warnings, overallFeedback, analyzeTokens) = await EvaluateWithAiAsync(projectTitle, decryptedChunks, storyBibleText, chapterCount, totalWords, aiInstructions);
            var reportStatus = "Completed";
            var projectVersion = $"v1.{chapterCount}.{chunks.Count}";

            // 5. Calculate total
            var total = criteria.Sum(c => c.Score);

            // 6. Save to DB
            var report = new ProjectReport
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                UserId = userId,
                Status = reportStatus,
                ProjectVersion = projectVersion,
                TotalScore = total,
                CriteriaJson = JsonSerializer.Serialize(criteria),
                CreatedAt = DateTime.UtcNow,
            };
            _context.ProjectReports.Add(report);

            // 7. Deduct usage — trừ cả analysis count và token
            sub.UsedAnalysisCount += 1;
            sub.UsedTokens += analyzeTokens;
            await _context.SaveChangesAsync();

            return BuildResponse(report.Id, projectId, projectTitle, reportStatus, total, criteria, warnings, overallFeedback, projectVersion);
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

            var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            List<AiScoreItem> aiResults;
            List<StoryWarning> warnings;
            string overallFeedback = "";
            try
            {
                var parsed = JsonSerializer.Deserialize<AiFullResponse>(report.CriteriaJson, jsonOpts);
                aiResults = parsed?.Criteria ?? new();
                warnings = parsed?.Warnings ?? new();
                overallFeedback = parsed?.OverallFeedback ?? "";
            }
            catch
            {
                aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(report.CriteriaJson, jsonOpts) ?? new();
                warnings = new();
            }

            return BuildResponse(report.Id, projectId, projectTitle, report.Status, report.TotalScore, MergeWithRubric(aiResults), warnings, overallFeedback, report.ProjectVersion, report.CreatedAt);
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
                    ProjectVersion = r.ProjectVersion,
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

            var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            List<AiScoreItem> aiResults;
            List<StoryWarning> warnings;
            string overallFeedback = "";
            try
            {
                var parsed = JsonSerializer.Deserialize<AiFullResponse>(report.CriteriaJson, jsonOpts);
                aiResults = parsed?.Criteria ?? new();
                warnings = parsed?.Warnings ?? new();
                overallFeedback = parsed?.OverallFeedback ?? "";
            }
            catch
            {
                aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(report.CriteriaJson, jsonOpts) ?? new();
                warnings = new();
            }

            return BuildResponse(report.Id, projectId, projectTitle, report.Status, report.TotalScore, MergeWithRubric(aiResults), warnings, overallFeedback, report.ProjectVersion, report.CreatedAt);
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private async Task VerifyOwnershipAsync(Guid projectId, Guid userId)
        {
            var exists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId);
            if (!exists)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        private async Task<(List<CriterionResult> Criteria, List<StoryWarning> Warnings, string OverallFeedback, int TokensUsed)> EvaluateWithAiAsync(
            string projectTitle, List<string> decryptedChunks, string? storyBibleText = null,
            int chapterCount = 0, int totalWords = 0, string? aiInstructions = null)
        {
            // Use first TopK chunks as context (avoid token limit) — sanitize trước khi nhúng vào prompt
            var contextText = string.Join("\n\n---\n\n",
                decryptedChunks.Take(TopK)
                    .Select((c, i) => $"[Đoạn {i + 1}]\n{PromptSanitizer.SanitizeUserContent(c)}"));

            // JSON gồm 2 phần: mảng criteria (20 mục) + mảng warnings (phát hiện tự động)
            var jsonTemplate = @"{
  ""criteria"":[
    {""key"":""1.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""1.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""2.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""2.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""2.3"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""2.4"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""3.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""3.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""3.3"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""4.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""4.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""4.3"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""5.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""5.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""6.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""6.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""7.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""7.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""8.1"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]},
    {""key"":""8.2"",""score"":0,""maxScore"":5,""feedback"":"""",""errors"":[],""suggestions"":[]}
  ],
  ""warnings"":[
    {""code"":""INCOMPLETE"",""severity"":""INFO"",""title"":"""",""detail"":""""}
  ],
  ""overallFeedback"": """"
}";

            // Build completeness context for AI
            var completenessNote = BuildCompletenessNote(chapterCount, totalWords);

            // Story Bible được đưa vào chỉ để AI "hiểu ngữ cảnh" — không được ảnh hưởng điểm.
            // Điểm PHẢI hoàn toàn dựa trên nội dung văn bản thực tế (contextText).
            var biblePart = string.IsNullOrWhiteSpace(storyBibleText)
                ? ""
                : $"\n\n[THAM CHIẾU NỀN — CHỈ ĐỌC ĐỂ HIỂU NGỮ CẢNH, KHÔNG ẢNH HƯỞNG ĐIỂM]\n" +
                  $"Thông tin dưới đây là tài liệu cẩm nang của tác giả (thể loại, nhân vật, thế giới quan, chủ đề...).\n" +
                  $"QUAN TRỌNG: Đây KHÔNG phải nội dung truyện. Bạn được phép dùng để hiểu ý định tác giả, " +
                  $"nhưng TUYỆT ĐỐI không cộng điểm vì thông tin này. " +
                  $"Điểm số chỉ phản ánh chất lượng văn bản thực tế trong phần \"Nội dung tác phẩm\" bên dưới.\n\n" +
                  $"{storyBibleText}\n[KẾT THÚC THAM CHIẾU NỀN]";

            var instructionsPart = string.IsNullOrWhiteSpace(aiInstructions)
                ? ""
                : $"\n\nGHI CHÚ CỦA TÁC GIẢ (lưu ý khi đọc, không ảnh hưởng điểm):\n{aiInstructions}";

            var prompt = $$"""
                Bạn là giám khảo văn học chuyên nghiệp. Nhiệm vụ: đọc kỹ toàn bộ văn bản, đánh giá 20 tiêu chí và phát hiện các vấn đề đặc biệt (CHƯA KẾT THÚC, LẶP LẠI, ĐẠO NHÁI...).

                THÔNG TIN HOÀN THIỆN TÁC PHẨM:
                {{completenessNote}}

                QUY TẮC BẮT BUỘC — VI PHẠM SẼ BỊ HỦY:
                1. CHỐNG ẢO GIÁC 100% (ZERO HALLUCINATION): TUYỆT ĐỐI KHÔNG SỬ DỤNG KIẾN THỨC BÊN NGOÀI. Nếu truyện mượn tên nhân vật nổi tiếng (vd: Tiểu Long Nữ), bạn CẤM tự suy diễn bối cảnh gốc của tác phẩm đó. Chỉ được phép phân tích dựa trên nội dung tác giả cung cấp trong "Nội dung tác phẩm".
                2. TUỲ BIẾN THEO THỂ LOẠI: Tiêu chuẩn đánh giá phải dựa vào Thể loại của truyện (nếu có trong Tham chiếu nền). Ví dụ: Tiên hiệp ưu tiên tính logic của hệ thống tu luyện & thế giới quan; Ngôn tình ưu tiên chiều sâu cảm xúc & chemistry; Trinh thám ưu tiên tính logic của vụ án.
                3. feedback: 2-3 câu nhận xét CỤ THỂ, có trích dẫn câu văn thực tế từ văn bản.
                4. errors: TỐI THIỂU 3 lỗi/mục — nêu rõ vấn đề + ví dụ câu văn mắc lỗi.
                5. suggestions: TỐI THIỂU 3 gợi ý/mục — nêu cách sửa cụ thể, không chung chung.
                6. score: Chấm nghiêm khắc theo RUBRIC 5 ĐIỂM sau (không đánh giá ưu ái):
                   - 1 điểm: Kém / Lỗi nặng — Thô sơ, phá vỡ logic cơ bản, không đạt tiêu chuẩn.
                   - 2 điểm: Dưới trung bình — Có ý tưởng nhưng diễn đạt lúng túng, nhiều hạt sạn.
                   - 3 điểm: Cơ bản đạt — Đọc được, đúng quy tắc nhưng lặp lại, thiếu chiều sâu.
                   - 4 điểm: Khá tốt — Chuyên nghiệp, nhịp nhàng, có phong cách riêng.
                   - 5 điểm: Xuất sắc — Tinh tế, độc đáo, lôi cuốn ấn tượng, ngang tầm xuất bản.
                7. Tất cả 20 mục phải có đủ feedback, errors, suggestions — KHÔNG được để mảng rỗng.

                NHẬN XÉT TỔNG QUAN (overallFeedback):
                Viết một đoạn nhận xét chung tâm huyết (khoảng 4-6 câu) dành cho tác giả: đúc kết những điểm mạnh nổi bật nhất, những điểm yếu lớn nhất cần khắc phục, và một lời động viên/nhận định tổng kết về tiềm năng của tác phẩm.

                PHÁT HIỆN CẢNH BÁO ĐẶC BIỆT (điền vào mảng "warnings"):
                Ngoài 20 tiêu chí, hãy kiểm tra và báo cáo các vấn đề sau (nếu có). Mỗi vấn đề là 1 object trong "warnings":

                a) TRUYỆN CHƯA KẾT THÚC (code="INCOMPLETE"):
                   - Kiểm tra xem cốt truyện có được giải quyết không, hay bị dừng đột ngột giữa chừng
                   - Nếu phát hiện: severity="WARNING", title="Truyện chưa có kết thúc", detail: mô tả cụ thể điểm dừng và tại sao coi là chưa xong
                   - Nếu truyện có kết thúc hợp lý (dù là cliffhanger có chủ ý): KHÔNG thêm warning này

                b) LẶP LẠI NỘI DUNG (code="REPETITION"):
                   - Kiểm tra: cụm từ được dùng lặp nhiều lần không cần thiết, tình tiết/cảnh xuất hiện lặp lại, ý tưởng được diễn đạt nhiều lần với từ ngữ khác nhau
                   - Ngưỡng: lặp lại ≥ 3 lần đáng kể mới báo warning
                   - Nếu phát hiện: severity="WARNING", title, detail: trích dẫn cụm từ/tình tiết lặp và số lần xuất hiện

                c) NGHI VẤN ĐẠO NHÁI / TƯƠNG ĐỒNG CAO (code="PLAGIARISM_RISK"):
                   - Kiểm tra: nội dung có quá giống một tác phẩm nổi tiếng đã biết không (cùng nhân vật, plot, setting đặc trưng, cụm từ nguyên văn)
                   - Chỉ báo nếu TỰ TIN cao — không báo vô căn cứ
                   - Nếu phát hiện: severity="CRITICAL", title, detail: nêu tác phẩm gốc nghi bị đạo và điểm tương đồng cụ thể

                d) MÂU THUẪN LOGIC / NHẤT QUÁN (code="INCONSISTENCY"):
                   - Phát hiện: nhân vật mâu thuẫn tính cách, sự kiện timeline không logic, mô tả bối cảnh trái nhau giữa các đoạn
                   - Nếu phát hiện: severity theo mức độ (INFO/WARNING/CRITICAL), detail: trích dẫn 2 đoạn mâu thuẫn cụ thể

                → Nếu KHÔNG phát hiện vấn đề nào: "warnings":[] (mảng rỗng)
                → Nếu phát hiện nhiều: liệt kê đủ, mỗi vấn đề 1 object riêng

                KEY TIÊU CHÍ (8 nhóm, 20 tiêu chí, mỗi tiêu chí tối đa 5 điểm):

                ── NHÓM 1: KỲ VỌNG (10 điểm) ──
                1.1=Thể loại(5): Tác phẩm có đáp ứng kỳ vọng của thể loại (romance, suspense, fantasy...) không?
                1.2=Tiền đề(5): Tiền đề có hấp dẫn, rõ ràng và được khai thác tốt không?

                ── NHÓM 2: NHÂN VẬT (20 điểm) ──
                2.1=Phát triển nhân vật(5): backstory, động cơ và sự trưởng thành của nhân vật
                2.2=Tính cách & Sự hấp dẫn(5): nhân vật có sức hút, thực tế và dễ đồng cảm
                2.3=Mối quan hệ & Tương tác(5): chất lượng tương tác, chemistry trong đối thoại
                2.4=Sự đa dạng nhân vật(5): nhân vật phụ, đối lập — tránh nhân vật một chiều

                ── NHÓM 3: CỐT TRUYỆN & CẤU TRÚC (15 điểm) ──
                3.1=Diễn biến cốt truyện(5): nhịp độ, xung đột, plot twist và cách giải quyết
                3.2=Cấu trúc & Tổ chức(5): tính mạch lạc, logic của rising action, climax
                3.3=Kết thúc(5): kết thúc có thỏa mãn và phù hợp câu chuyện không?

                ── NHÓM 4: NGÔN NGỮ & VĂN PHONG (15 điểm) ──
                4.1=Phong cách & Giọng văn(5): tone, style và bầu không khí tác phẩm
                4.2=Ngữ pháp & Sự trôi chảy(5): ngữ pháp, chính tả và sự mượt mà
                4.3=Tính dễ đọc(5): câu văn rõ ràng, dễ theo dõi, tránh mơ hồ rối rắm

                ── NHÓM 5: SỰ HẤP DẪN (10 điểm) ──
                5.1=Mức độ thú vị(5): tác phẩm có thú vị, tạo kỳ vọng cho phần tiếp theo?
                5.2=Mức độ cuốn hút(5): người đọc có muốn đọc tiếp không?

                ── NHÓM 6: TÁC ĐỘNG CẢM XÚC (10 điểm) ──
                6.1=Sự đồng cảm(5): gợi lên kết nối cảm xúc với người đọc
                6.2=Chiều sâu cảm xúc(5): chạm đến cảm xúc sâu xa, không hời hợt

                ── NHÓM 7: CHỦ ĐỀ (10 điểm) ──
                7.1=Khám phá chủ đề(5): chủ đề được trình bày rõ ràng và khám phá sâu sắc
                7.2=Chiều sâu chủ đề(5): giá trị giáo dục, bình luận xã hội, triết lý sống

                ── NHÓM 8: XÂY DỰNG THẾ GIỚI (10 điểm) ──
                8.1=Xây dựng thế giới(5): tính chân thực và sự phong phú của thế giới
                8.2=Bối cảnh(5): độ chính xác về lịch sử, văn hóa và chi tiết kỹ thuật{{biblePart}}{{instructionsPart}}

                Nội dung tác phẩm "{{projectTitle}}":
                {{contextText}}

                Trả về JSON theo đúng cấu trúc sau (điền đầy đủ, không trường nào rỗng):
                {{jsonTemplate}}
                """;

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage("Bạn là giám khảo văn học nghiêm khắc và chuyên sâu. Tuân thủ ZERO HALLUCINATION (chỉ dùng context, không chế cháo). Phân tích cụ thể, trích dẫn ví dụ thực tế. Điền đủ 20 tiêu chí với TỐI THIỂU 3 errors/suggestions mỗi mục. Viết thêm overallFeedback (4-6 câu tâm huyết). Trả về JSON thuần túy theo cấu trúc {\"criteria\":[...],\"warnings\":[...],\"overallFeedback\":\"...\"}."),
                ChatMessage.CreateUserMessage(prompt),
            };

            var response = await CompleteChatWithFallbackAsync(messages, maxTokens: 8000, temperature: 0.1f);
            var raw = response.Content[0].Text.Trim();

            // Strip <think>...</think> reasoning blocks emitted by some models (e.g. Qwen3)
            raw = System.Text.RegularExpressions.Regex.Replace(
                raw, @"<think>[\s\S]*?</think>", string.Empty,
                System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();

            // Strip markdown code fences if present
            if (raw.StartsWith("```")) raw = raw.Split('\n', 2)[1];
            if (raw.EndsWith("```")) raw = raw[..^3];
            raw = raw.Trim();

            // Attempt to repair a truncated JSON array (AI hit token limit mid-response)
            raw = RepairTruncatedJsonArray(raw);

            // Parse JSON mới dạng {criteria:[...], warnings:[...]}
            var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            List<AiScoreItem> aiResults;
            List<StoryWarning> warnings;
            string overallFeedback = "";
            try
            {
                var parsed = JsonSerializer.Deserialize<AiFullResponse>(raw, jsonOpts)
                    ?? throw new InvalidOperationException("Không thể parse kết quả từ AI.");
                aiResults = parsed.Criteria ?? new();
                warnings = (parsed.Warnings ?? new())
                    .Where(w => !string.IsNullOrWhiteSpace(w.Code))
                    .ToList();
                overallFeedback = parsed.OverallFeedback ?? "";
            }
            catch
            {
                // Fallback: thử parse dạng mảng cũ (tương thích ngược)
                aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(raw, jsonOpts) ?? new();
                warnings = new();
            }

            var tokensUsed = response.Usage?.TotalTokenCount ?? 0;
            return (MergeWithRubric(aiResults), warnings, overallFeedback, tokensUsed);
        }

        private static string BuildCompletenessNote(int chapterCount, int totalWords)
        {
            var completionLevel = chapterCount switch
            {
                0 => "Chưa có chương nào — điểm hoàn thiện phải là 0",
                1 => "Mới có 1 chương — tác phẩm rất chưa hoàn thiện",
                <= 3 => $"Có {chapterCount} chương ({totalWords} từ) — tác phẩm sơ khai, chưa đủ để đánh giá đầy đủ",
                <= 7 => $"Có {chapterCount} chương ({totalWords} từ) — tác phẩm đang phát triển, thiếu chiều sâu",
                <= 15 => $"Có {chapterCount} chương ({totalWords} từ) — bản thảo trung bình",
                _ => $"Có {chapterCount} chương ({totalWords} từ) — tác phẩm dài, có thể đánh giá đầy đủ",
            };

            var wordNote = totalWords switch
            {
                < 1000 => "Nội dung rất ngắn (dưới 1,000 từ) — gần như không có gì để đánh giá",
                < 5000 => "Nội dung ngắn (dưới 5,000 từ) — chưa đủ để thể hiện kỹ năng viết",
                < 20000 => "Nội dung trung bình",
                _ => "Nội dung dài, đủ ngữ liệu để đánh giá chính xác",
            };

            return $"{completionLevel}. {wordNote}. Hãy phản ánh mức độ hoàn thiện này vào tất cả tiêu chí, đặc biệt tiêu chí 5.1.";
        }

        /// <summary>
        /// Attempts to repair a JSON string truncated by token limit.
        /// Supports both array [...] and object {...} top-level containers.
        /// </summary>
        private static string RepairTruncatedJsonArray(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return "{}";

            // If already valid, return as-is
            try
            {
                JsonSerializer.Deserialize<System.Text.Json.JsonElement>(json);
                return json;
            }
            catch { /* truncated — apply repair */ }

            // Detect top-level container type
            var trimmed = json.TrimStart();
            bool isObject = trimmed.StartsWith('{');
            char closeChar = isObject ? '}' : ']';
            string fallback = isObject ? "{}" : "[]";

            int lastClose = json.LastIndexOf('}');
            if (lastClose < 0) return fallback;

            // Strip trailing incomplete object then close the container
            var repaired = json[..(lastClose + 1)].TrimEnd().TrimEnd(',')
                + (isObject ? "}" : "]");

            try
            {
                JsonSerializer.Deserialize<System.Text.Json.JsonElement>(repaired);
                return repaired;
            }
            catch
            {
                return fallback;
            }
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
            List<StoryWarning>? warnings = null, string overallFeedback = "", string projectVersion = "v1.0", DateTime? createdAt = null)
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
                OverallFeedback = overallFeedback,
                ProjectVersion = projectVersion,
                Groups = groups,
                Warnings = warnings ?? new(),
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

        private List<GeminiChatClientSlot> GetRotatedGeminiClients()
        {
            if (_geminiChatClients.Count <= 1)
                return _geminiChatClients;

            var start = Math.Abs(Interlocked.Increment(ref _nextGeminiChatKeyIndex));
            return Enumerable.Range(0, _geminiChatClients.Count)
                .Select(i => _geminiChatClients[(start + i) % _geminiChatClients.Count])
                .ToList();
        }

        private static List<string> ReadApiKeys(IConfiguration config, params string[] configPaths)
        {
            var results = new List<string>();
            foreach (var path in configPaths)
            {
                var raw = config[path];
                if (string.IsNullOrWhiteSpace(raw))
                    continue;

                results.AddRange(
                    raw.Split([',', ';', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Where(k => !string.IsNullOrWhiteSpace(k)));
            }

            return results
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        private sealed record GeminiChatClientSlot(ChatClient Client, bool IsGemma, string KeyLabel);

        private class AiScoreItem
        {
            public string Key { get; set; } = string.Empty;
            public decimal Score { get; set; }
            public decimal MaxScore { get; set; }
            public string Feedback { get; set; } = string.Empty;
            public List<string> Errors { get; set; } = new();
            public List<string> Suggestions { get; set; } = new();
        }

        // Wrapper cho JSON response mới dạng {criteria:[...], warnings:[...], overallFeedback:"..."}
        private class AiFullResponse
        {
            public List<AiScoreItem>? Criteria { get; set; }
            public List<StoryWarning>? Warnings { get; set; }
            public string? OverallFeedback { get; set; }
        }
    }
}
