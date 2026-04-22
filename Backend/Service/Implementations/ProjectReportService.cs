using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Text.Json;

namespace Service.Implementations
{
    public class ProjectReportService : IProjectReportService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmbeddingService _embeddingService;
        private readonly ILogger<ProjectReportService> _logger;
        private readonly GeminiChatFailoverExecutor _geminiChatExecutor;
        private const int DefaultAnalyzeBatchSize = 12;
        private const int DefaultAnalyzeRpmLimit = 15;
        private static readonly SemaphoreSlim AnalyzeRpmLock = new(1, 1);
        private static readonly Queue<DateTime> AnalyzeCallTimestamps = [];

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
            _geminiChatExecutor = new GeminiChatFailoverExecutor(
                config,
                logger,
                "Gemini Report",
                GeminiPrimaryKeyRole.Analyze,
                TimeSpan.FromMinutes(10)); // Tăng lên 10 phút cho các bộ truyện lớn
        }

        private async Task<OpenAI.Chat.ChatCompletion> CompleteChatWithGeminiAsync(
            IEnumerable<ChatMessage> messages,
            int maxTokens = 2500,
            float temperature = 0.7f,
            CancellationToken cancellationToken = default)
        {
            await WaitForAnalyzeRateSlotAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();

            var options = new ChatCompletionOptions
            {
                MaxOutputTokenCount = maxTokens,
                Temperature = temperature,
            };

            return await _geminiChatExecutor.CompleteAsync(messages, options);
        }

        public async Task<ProjectReportResponse> AnalyzeAsync(
            Guid projectId,
            Guid userId,
            Func<int, string?, CancellationToken, Task>? progressCallback = null,
            CancellationToken cancellationToken = default)
        {
            // 1. Verify ownership
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId, cancellationToken)
                ?? throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");

            // 2. Check subscription
            var sub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new InvalidOperationException("Bạn chưa có gói đăng ký hợp lệ. Vui lòng đăng ký gói để dùng tính năng này.");

            if (sub.UsedAnalysisCount >= sub.Plan.MaxAnalysisCount)
                throw new InvalidOperationException($"Bạn đã dùng hết {sub.Plan.MaxAnalysisCount} lần phân tích trong kỳ này.");

            // 3. Decrypt user DEK
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");
            var masterKey = _config["Security:MasterKey"]!;
            var rawDek = EncryptionHelper.DecryptWithMasterKey(user!.DataEncryptionKey!, masterKey);
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(project.Title, rawDek);

            // 4. Fetch chapters stats + all embedded chunks
            var chapters = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .OrderBy(c => c.ChapterNumber)
                .ToListAsync(cancellationToken);

            var chapterCount = chapters.Count;
            var totalWords = chapters.Sum(c => c.WordCount);

            // Chỉ lấy chunks thuộc active version của mỗi chương
            var activeVersionIds = chapters
                .Where(c => c.CurrentVersionId.HasValue)
                .Select(c => c.CurrentVersionId!.Value)
                .ToList();

            var chunks = await _context.ChapterChunks
                .Where(c => c.ProjectId == projectId && c.Embedding != null && activeVersionIds.Contains(c.VersionId))
                .ToListAsync(cancellationToken);

            if (chunks.Count == 0)
                throw new InvalidOperationException("Dự án chưa có nội dung được nhúng (embed). Vui lòng chunk và embed các chương trong Workspace trước khi phân tích.");

            var decryptedChunks = chunks
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
                .ToList();

            // 5. Fetch Story Bible context (genres, summary, characters, worldbuilding)
            var projectFull = await _context.Projects
                .Include(p => p.ProjectGenres).ThenInclude(pg => pg.Genre)
                .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

            var genres = projectFull?.ProjectGenres.Select(pg => pg.Genre.Name).ToList() ?? new();
            var summary = !string.IsNullOrEmpty(project.Summary)
                ? EncryptionHelper.DecryptWithMasterKey(project.Summary, rawDek)
                : null;

            var characterEntries = await _context.CharacterEntries
                .Where(c => c.ProjectId == projectId)
                .ToListAsync(cancellationToken);
            var worldEntries = await _context.WorldbuildingEntries
                .Where(w => w.ProjectId == projectId)
                .ToListAsync(cancellationToken);
            var styleGuideEntries = await _context.StyleGuideEntries
                .Where(s => s.ProjectId == projectId)
                .ToListAsync(cancellationToken);
            var themeEntries = await _context.ThemeEntries
                .Where(t => t.ProjectId == projectId)
                .ToListAsync(cancellationToken);
            var plotNoteEntries = await _context.PlotNoteEntries
                .Where(p => p.ProjectId == projectId)
                .ToListAsync(cancellationToken);

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

            var (criteria, warnings, overallFeedback, analyzeTokens) = await EvaluateWithAiAsync(
                projectTitle,
                decryptedChunks,
                storyBibleText,
                chapterCount,
                totalWords,
                aiInstructions,
                progressCallback,
                cancellationToken);
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
                CriteriaJson = BuildStoredCriteriaJson(criteria, warnings, overallFeedback),
                CreatedAt = DateTime.UtcNow,
            };
            _context.ProjectReports.Add(report);

            // 7. Deduct usage — trừ cả analysis count và token
            sub.UsedAnalysisCount += 1;
            sub.UsedTokens += analyzeTokens;
            await _context.SaveChangesAsync(cancellationToken);

            return BuildResponse(report.Id, projectId, projectTitle, reportStatus, total, criteria, warnings, overallFeedback, projectVersion);
        }

        public async Task<ProjectReportResponse?> GetLatestAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var report = await _context.ProjectReports
                .Include(r => r.Project)
                .Where(r => r.ProjectId == projectId)
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

            var reports = await _context.ProjectReports
                .Where(r => r.ProjectId == projectId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    r.Status,
                    r.TotalScore,
                    r.ProjectVersion,
                    r.CreatedAt
                })
                .ToListAsync();

            return reports.Select(r => new ProjectReportSummary
            {
                Id = r.Id,
                Status = r.Status,
                TotalScore = r.TotalScore,
                Classification = Classify(r.TotalScore),
                ProjectVersion = r.ProjectVersion,
                CreatedAt = r.CreatedAt,
            }).ToList();
        }

        public async Task<ProjectReportResponse?> GetByIdAsync(Guid reportId, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var report = await _context.ProjectReports
                .Include(r => r.Project)
                .FirstOrDefaultAsync(r => r.Id == reportId && r.ProjectId == projectId);

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
            int chapterCount = 0, int totalWords = 0, string? aiInstructions = null,
            Func<int, string?, CancellationToken, Task>? progressCallback = null,
            CancellationToken cancellationToken = default)
        {
            var (contextText, batchTokens) = await BuildAnalysisContextAsync(
                projectTitle,
                decryptedChunks,
                progressCallback,
                cancellationToken);

            // JSON gồm 2 phần: mảng criteria (20 mục) + mảng warnings (phát hiện tự động)
            var jsonTemplate = @"{
  ""criteria"":[
    {""key"":""1.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""1.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""2.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""2.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""2.3"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""2.4"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""3.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""3.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""3.3"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""4.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""4.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""4.3"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""5.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""5.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""6.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""6.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""7.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""7.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""8.1"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]},
    {""key"":""8.2"",""score"":0,""maxScore"":5,""feedback"":"""",""evidence"":"""",""bibleComparison"":null,""errors"":[],""suggestions"":[]}
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
                : $"\n\n[THAM CHIẾU NỀN — CẨM NANG TRUYỆN CỦA TÁC GIẢ]\n" +
                  $"Thông tin dưới đây là tài liệu cẩm nang/ý tưởng sơ thảo của tác giả (nhân vật, thế giới, cốt truyện...). " +
                  $"Tài liệu này có thể không đầy đủ hoặc tác giả đã thay đổi ý định khi viết thực tế.\n" +
                  $"QUAN TRỌNG: Đây KHÔNG phải nội dung truyện. Bạn dùng nó để hiểu ngữ cảnh, nhưng TUYỆT ĐỐI không trừ điểm nếu truyện viết khác với cẩm nang. " +
                  $"Việc tác giả viết khác đi so với kế hoạch ban đầu là hoàn toàn bình thường và không được coi là lỗi logic hay điểm yếu.\n" +
                  $"NHIỆM VỤ SO SÁNH: Với các tiêu chí liên quan, hãy chỉ ra sự khác biệt giữa nội dung đã viết với thông tin trong cẩm nang này. " +
                  $"PHẢI GHI RÕ trong trường \"bibleComparison\": \"Theo cẩm nang dự định là [X], nhưng thực tế tác giả đã triển khai là [Y]\". " +
                  $"Chỉ mang tính chất liệt kê sự thay đổi, không phán xét đúng sai.\n\n" +
                  $"{storyBibleText}\n[KẾT THÚC THAM CHIẾU NỀN]";

            var instructionsPart = string.IsNullOrWhiteSpace(aiInstructions)
                ? ""
                : $"\n\nGHI CHÚ CỦA TÁC GIẢ (lưu ý khi đọc, không ảnh hưởng điểm):\n{aiInstructions}";

            var prompt = $$"""
                Bạn là giám khảo văn học chuyên nghiệp. Nhiệm vụ: đọc kỹ toàn bộ văn bản, đánh giá 20 tiêu chí và phát hiện các vấn đề đặc biệt (CHƯA KẾT THÚC, LẶP LẠI, ĐẠO NHÁI...).

                THÔNG TIN HOÀN THIỆN TÁC PHẨM:
                {{completenessNote}}

                QUY TẮC BẮT BUỘC — VI PHẠM SẼ BỊ HỦY:
                1. CHẾ ĐỘ GIÁM KHẢO KHÓ TÍNH: Bạn đóng vai một Cố vấn văn học CỰC KỲ KHẮT KHE. Hãy tìm ra mọi hạt sạn, lỗi lặp từ, văn phong sáo rỗng (cliches), hoặc sự thiếu nhất quán. TUYỆT ĐỐI không cho điểm khuyến khích. Thà cho điểm thấp để tác giả tiến bộ còn hơn cho điểm cao ảo.
                2. CHỐNG ẢO GIÁC 100% (ZERO HALLUCINATION): TUYỆT ĐỐI KHÔNG SỬ DỤNG KIẾN THỨC BÊN NGOÀI. Nếu truyện mượn tên nhân vật nổi tiếng (vd: Tiểu Long Nữ), bạn CẤM tự suy diễn bối cảnh gốc của tác phẩm đó. Chỉ được phép phân tích dựa trên nội dung tác giả cung cấp trong "Nội dung tác phẩm".
                2. TUỲ BIẾN THEO THỂ LOẠI: Tiêu chuẩn đánh giá phải dựa vào Thể loại của truyện (nếu có trong Tham chiếu nền). Ví dụ: Tiên hiệp ưu tiên tính logic của hệ thống tu luyện & thế giới quan; Ngôn tình ưu tiên chiều sâu cảm xúc & chemistry; Trinh thám ưu tiên tính logic của vụ án.
                3. feedback: 3-4 câu nhận xét CỤ THỂ, phân tích sâu về kỹ thuật viết.
                4. evidence: TRÍCH DẪN NGUYÊN VĂN 1-3 câu quan trọng nhất từ nội dung truyện làm bằng chứng cho nhận xét. PHẢI CÓ TRÍCH DẪN THỰC TẾ, không được tự bịa.
                5. bibleComparison: SO SÁNH trung lập với cẩm nang (nếu có). Nêu rõ điểm nào khớp, điểm nào khác biệt/thay đổi. KHÔNG trừ điểm nếu có sự khác biệt so với kế hoạch ban đầu. Nếu không có cẩm nang: để null.
                6. errors: BẮT BUỘC liệt kê 3-5 lỗi/vấn đề cụ thể cho mỗi mục — nêu rõ vấn đề + ví dụ câu văn mắc lỗi.
                7. suggestions: BẮT BUỘC liệt kê 3-5 gợi ý/cách sửa cụ thể cho mỗi mục — nêu hướng xử lý chi tiết cho từng lỗi đã nêu.
                9. score: Chấm điểm CỰC KỲ NGHIÊM KHẮC theo RUBRIC 5 ĐIỂM sau (Tiêu chuẩn xuất bản):
                   - 1 điểm: Kém — Văn phong thô sơ, sai chính tả/ngữ pháp nặng, phá vỡ logic cơ bản.
                   - 2 điểm: Yếu — Có cốt truyện nhưng diễn đạt lúng túng, nhân vật mờ nhạt, nhiều sáo rỗng.
                   - 3 điểm: Đạt yêu cầu — Viết đúng quy tắc nhưng chưa có chất riêng, còn lặp ý, nhịp độ chưa tốt. (Đây là mức điểm cho các tác phẩm 'tạm ổn' nhưng chưa hay).
                   - 4 điểm: Tốt — Chuyên nghiệp, ngôn ngữ sắc sảo, cảm xúc chân thực, có bản sắc riêng.
                   - 5 điểm: Xuất sắc — Tinh tế, độc đáo, lôi cuốn ấn tượng, không có hạt sạn về logic. (Chỉ dành cho tác phẩm thực sự xuất sắc).
                10. Tất cả 20 mục phải có đủ feedback, evidence, errors (≥3), suggestions (≥3) — KHÔNG được để trống. Nếu tác phẩm quá ngắn hoặc quá tệ, hãy mạnh dạn cho điểm 1-2.

                NHẬN XÉT TỔNG QUAN (overallFeedback):
                Viết một đoạn nhận xét chung tâm huyết (khoảng 4-6 câu) dành cho tác giả: đúc kết những điểm mạnh nổi bật nhất, những điểm yếu lớn nhất cần khắc phục, và một lời động viên/nhận định tổng kết về tiềm năng của tác phẩm.

                PHÁT HIỆN CẢNH BÁO ĐẶC BIỆT (điền vào mảng "warnings"):
                Ngoài 20 tiêu chí, hãy kiểm tra và báo cáo các vấn đề sau (nếu có). Mỗi vấn đề là 1 object trong "warnings":

                a) TRUYỆN CHƯA KẾT THÚC (code="INCOMPLETE"):
                   - Kiểm tra xem cốt truyện có được giải quyết không, hay bị dừng đột ngột giữa chừng
                   - Nếu phát hiện: severity="WARNING", title="Truyện chưa có kết thúc", detail: mô tả cụ thể điểm dừng và tại sao coi là chưa xong
                   - Nếu truyện có kết thúc hợp lý (dù là cliffhanger có chủ ý): KHÔNG thêm warning này

                b) LẶP LẠI NỘI DUNG (code="REPETITION"):
                   - LƯU Ý QUAN TRỌNG: Dữ liệu được đưa vào theo dạng Batch tóm tắt. Việc một nhân vật hoặc tình tiết quan trọng xuất hiện ở NHIỀU Batch khác nhau là dấu hiệu của sự NHẤT QUÁN, TUYỆT ĐỐI KHÔNG báo lỗi REPETITION cho trường hợp này.
                   - Chỉ báo lỗi nếu: Phát hiện các đoạn văn văn phong y hệt nhau, các cảnh quay bị lặp lại thừa thãi mà không có sự tiến triển, hoặc tác giả viết đi viết lại một ý bằng đúng những từ ngữ đó trong cùng một đoạn.
                   - Nếu phát hiện: severity="WARNING", title, detail: trích dẫn cụ thể và giải thích tại sao nó là lỗi lặp dư thừa.

                c) NGHI VẤN ĐẠO NHÁI / TƯƠNG ĐỒNG CAO (code="PLAGIARISM_RISK"):
                   - Kiểm tra: nội dung có quá giống một tác phẩm nổi tiếng đã biết không (cùng nhân vật, plot, setting đặc trưng, cụm từ nguyên văn)
                   - Chỉ báo nếu TỰ TIN cao — không báo vô căn cứ
                   - Nếu phát hiện: severity="CRITICAL", title, detail: nêu tác phẩm gốc nghi bị đạo và điểm tương đồng cụ thể

                d) MÂU THUẪN LOGIC / NHẤT QUÁN (code="INCONSISTENCY"):
                   - LƯU Ý: Do dữ liệu dạng tóm tắt Batch, đôi khi các chi tiết nhỏ có thể bị lược bỏ giữa các Batch. Chỉ báo lỗi mâu thuẫn khi có bằng chứng RÕ RÀNG (vd: Chương 1 nói nhân vật A đã chết, Chương 5 nhân vật A lại xuất hiện bình thường mà không có giải thích).
                   - Phát hiện: nhân vật mâu thuẫn tính cách cực đoan không lý do, sự kiện timeline đảo lộn vô lý, bối cảnh trái ngược hoàn toàn.
                   - Nếu phát hiện: severity theo mức độ (INFO/WARNING/CRITICAL), detail: trích dẫn mâu thuẫn cụ thể.

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
                ChatMessage.CreateSystemMessage("Bạn là giám khảo văn học nghiêm khắc và chuyên sâu. Tuân thủ ZERO HALLUCINATION (chỉ dùng context, không chế cháo). Phân tích cụ thể, trích dẫn ví dụ thực tế. Điền đủ 20 tiêu chí với: evidence (trích dẫn nguyên văn), bibleComparison (so sánh cẩm nang nếu có), 2-4 errors và 2-4 suggestions mỗi mục. Viết thêm overallFeedback (4-6 câu tâm huyết). Trả về JSON thuần túy theo cấu trúc {\"criteria\":[...],\"warnings\":[...],\"overallFeedback\":\"...\"}."),
                ChatMessage.CreateUserMessage(prompt),
            };

            var totalTokensUsed = batchTokens;
            string? lastFailureReason = null;

            for (var attempt = 1; attempt <= 2; attempt++)
            {
                var attemptMessages = new List<ChatMessage>(messages);
                if (attempt > 1)
                {
                    attemptMessages.Add(ChatMessage.CreateUserMessage(
                        "Kết quả lần trước thiếu dữ liệu hoặc sai JSON. Hãy trả lại JSON hợp lệ, đủ đúng 20 key rubric, mỗi key có feedback, evidence (trích dẫn nguyên văn), errors (≥2), suggestions (≥2) không rỗng, bibleComparison nếu có cẩm nang, và overallFeedback 4-6 câu."));
                }

                var response = await CompleteChatWithGeminiAsync(
                    attemptMessages,
                    maxTokens: 16000, // Tăng thêm budget cho report dài
                    temperature: 0.1f,
                    cancellationToken: cancellationToken);

                totalTokensUsed += response.Usage?.TotalTokenCount ?? 0;

                var raw = NormalizeAiText(response.Content.FirstOrDefault()?.Text ?? string.Empty);
                if (TryParseAiEvaluation(raw, out var aiResults, out var warnings, out var overallFeedback, out var parseReason))
                {
                    if (ValidateAiEvaluation(aiResults, overallFeedback, out var qualityReason))
                        return (MergeWithRubric(aiResults), warnings, overallFeedback.Trim(), totalTokensUsed);

                    lastFailureReason = qualityReason ?? "AI response quality invalid.";
                }
                else
                {
                    lastFailureReason = parseReason ?? "AI response parse invalid.";
                }

                _logger.LogWarning("Project analysis AI output invalid at attempt {Attempt}: {Reason}", attempt, lastFailureReason);
            }

            throw new InvalidOperationException($"AI trả về kết quả phân tích không hợp lệ sau nhiều lần thử. {lastFailureReason}");
        }

        private static bool TryParseAiEvaluation(
            string raw,
            out List<AiScoreItem> aiResults,
            out List<StoryWarning> warnings,
            out string overallFeedback,
            out string? reason)
        {
            aiResults = new();
            warnings = new();
            overallFeedback = string.Empty;
            reason = null;

            var normalized = string.IsNullOrWhiteSpace(raw) ? "{}" : raw.Trim();
            normalized = ExtractJsonPayload(normalized);
            normalized = RepairTruncatedJsonArray(normalized);

            var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            try
            {
                var parsed = JsonSerializer.Deserialize<AiFullResponse>(normalized, jsonOpts)
                    ?? throw new InvalidOperationException("Deserialize trả về null.");

                aiResults = parsed.Criteria ?? new();
                warnings = (parsed.Warnings ?? new())
                    .Where(w => !string.IsNullOrWhiteSpace(w.Code))
                    .ToList();
                overallFeedback = parsed.OverallFeedback ?? string.Empty;
                return true;
            }
            catch
            {
                try
                {
                    aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(normalized, jsonOpts) ?? new();
                    warnings = new();
                    overallFeedback = string.Empty;
                    return true;
                }
                catch (Exception ex)
                {
                    reason = $"Không parse được JSON từ AI: {ex.Message}";
                    return false;
                }
            }
        }

        private static bool ValidateAiEvaluation(List<AiScoreItem> aiResults, string overallFeedback, out string? reason)
        {
            reason = null;

            var rubricKeys = Rubric.Select(r => r.Key).ToHashSet(StringComparer.Ordinal);
            var byKey = aiResults
                .Where(x => !string.IsNullOrWhiteSpace(x.Key))
                .GroupBy(x => x.Key.Trim(), StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

            var missingKeys = Rubric
                .Select(r => r.Key)
                .Where(k => !byKey.ContainsKey(k))
                .ToList();
            if (missingKeys.Count > 0)
            {
                reason = $"Thiếu tiêu chí: {string.Join(", ", missingKeys.Take(5))}{(missingKeys.Count > 5 ? "..." : "")}";
                return false;
            }

            var emptyFeedbackCount = byKey
                .Where(x => rubricKeys.Contains(x.Key))
                .Count(x => string.IsNullOrWhiteSpace(x.Value.Feedback));
            if (emptyFeedbackCount > 0)
            {
                reason = $"Có {emptyFeedbackCount} tiêu chí thiếu feedback.";
                return false;
            }

            var emptyErrorsCount = byKey
                .Where(x => rubricKeys.Contains(x.Key))
                .Count(x => x.Value.Errors == null || x.Value.Errors.Count(e => !string.IsNullOrWhiteSpace(e)) < 2);
            if (emptyErrorsCount > 0)
            {
                reason = $"Có {emptyErrorsCount} tiêu chí có ít hơn 2 errors.";
                return false;
            }

            var emptySuggestionsCount = byKey
                .Where(x => rubricKeys.Contains(x.Key))
                .Count(x => x.Value.Suggestions == null || x.Value.Suggestions.Count(s => !string.IsNullOrWhiteSpace(s)) < 2);
            if (emptySuggestionsCount > 0)
            {
                reason = $"Có {emptySuggestionsCount} tiêu chí có ít hơn 2 suggestions.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(overallFeedback) || overallFeedback.Trim().Length < 20)
            {
                reason = "Thiếu overallFeedback có ý nghĩa.";
                return false;
            }

            return true;
        }

        private async Task<(string ContextText, int TokensUsed)> BuildAnalysisContextAsync(
            string projectTitle,
            List<string> decryptedChunks,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            var batchSize = ReadIntConfig("Gemini:AnalyzeBatchSize", DefaultAnalyzeBatchSize, 1, 50);
            var maxSummaryBlocks = ReadIntConfig("Gemini:AnalyzeMaxSummaryBlocks", 30, 4, 100);
            var totalBatches = (int)Math.Ceiling(decryptedChunks.Count / (double)batchSize);

            var batchSummaries = new List<string>(totalBatches);
            var tokensUsed = 0;

            for (var batchIndex = 0; batchIndex < totalBatches; batchIndex++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var currentBatch = decryptedChunks
                    .Skip(batchIndex * batchSize)
                    .Take(batchSize)
                    .ToList();

                var batchText = string.Join(
                    "\n\n---\n\n",
                    currentBatch.Select((chunk, chunkIndex) =>
                        $"[Đoạn {batchIndex * batchSize + chunkIndex + 1}]\n{PromptSanitizer.SanitizeUserContent(chunk)}"));

                var summaryPrompt = $$"""
                    Bạn là biên tập viên phân tích văn học.
                    Đây là batch {{batchIndex + 1}}/{{totalBatches}} của tác phẩm "{{projectTitle}}".
                    Hãy tóm tắt bằng chứng quan trọng để phục vụ chấm rubric cuối cùng.

                    Yêu cầu đầu ra:
                    - Dạng bullet, tiếng Việt, súc tích.
                    - Tối đa 15 bullet.
                    - Mỗi bullet <= 300 ký tự.
                    - PHẢI GIỮ LẠI CÁC TRÍCH DẪN (QUOTES) ĐẮT GIÁ: thoại nhân vật, mô tả bối cảnh quan trọng.
                    - Tập trung vào: mâu thuẫn nhân vật, tiến triển cốt truyện, và các hạt sạn logic.
                    - LƯU Ý: Các đoạn văn có thể có phần gối đầu (overlap) nhẹ về văn bản ở đầu/cuối, hãy bỏ qua sự lặp lại kỹ thuật này khi tóm tắt.

                    Nội dung batch:
                    {{batchText}}
                    """;

                var summaryMessages = new List<ChatMessage>
                {
                    ChatMessage.CreateSystemMessage("Tóm tắt bằng chứng ngắn gọn, trung lập, không suy diễn ngoài nội dung."),
                    ChatMessage.CreateUserMessage(summaryPrompt),
                };

                var summaryResponse = await CompleteChatWithGeminiAsync(
                    summaryMessages,
                    maxTokens: 2500, // Tăng budget cho summary chi tiết hơn
                    temperature: 0.1f,
                    cancellationToken: cancellationToken);

                var summaryText = NormalizeAiText(summaryResponse.Content.FirstOrDefault()?.Text ?? string.Empty);
                if (string.IsNullOrWhiteSpace(summaryText))
                    summaryText = "- Không trích xuất được bằng chứng từ batch này.";

                batchSummaries.Add($"[Batch {batchIndex + 1}/{totalBatches}]\n{summaryText}");
                tokensUsed += summaryResponse.Usage?.TotalTokenCount ?? 0;

                if (progressCallback != null)
                {
                    var progress = 20 + (int)Math.Round(((batchIndex + 1d) / totalBatches) * 50d); // 20..70
                    await progressCallback(Math.Clamp(progress, 20, 70), $"Batch {batchIndex + 1}/{totalBatches}", cancellationToken);
                }
            }

            if (batchSummaries.Count > maxSummaryBlocks)
            {
                var reducedResult = await ReduceBatchSummariesAsync(
                    batchSummaries,
                    maxSummaryBlocks,
                    cancellationToken);

                batchSummaries = reducedResult.Summaries;
                tokensUsed += reducedResult.TokensUsed;

                if (progressCallback != null)
                    await progressCallback(80, "Đang tổng hợp toàn bộ batch", cancellationToken);
            }

            return (string.Join("\n\n====================\n\n", batchSummaries), tokensUsed);
        }

        private async Task<(List<string> Summaries, int TokensUsed)> ReduceBatchSummariesAsync(
            List<string> summaries,
            int maxSummaryBlocks,
            CancellationToken cancellationToken)
        {
            const int groupSize = 6;
            var current = summaries;
            var round = 1;
            var tokensUsed = 0;

            while (current.Count > maxSummaryBlocks)
            {
                var next = new List<string>();
                var totalGroups = (int)Math.Ceiling(current.Count / (double)groupSize);

                for (var groupIndex = 0; groupIndex < totalGroups; groupIndex++)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var groupItems = current
                        .Skip(groupIndex * groupSize)
                        .Take(groupSize)
                        .ToList();
                    var groupText = string.Join("\n\n---\n\n", groupItems);

                    var reducePrompt = $$"""
                        Rút gọn các ghi chú phân tích sau thành bản tổng hợp ngắn gọn nhưng không mất ý quan trọng.
                        Yêu cầu:
                        - Tối đa 16 bullet.
                        - Mỗi bullet <= 220 ký tự.
                        - Giữ lại bằng chứng quan trọng về: nhân vật, cốt truyện, ngôn ngữ, mâu thuẫn, lặp lại, cảnh báo đặc biệt.

                        Dữ liệu đầu vào:
                        {{groupText}}
                        """;

                    var reduceMessages = new List<ChatMessage>
                    {
                        ChatMessage.CreateSystemMessage("Rút gọn nội dung phân tích theo dạng bullet súc tích, không thêm dữ kiện mới."),
                        ChatMessage.CreateUserMessage(reducePrompt),
                    };

                    var reducedResponse = await CompleteChatWithGeminiAsync(
                        reduceMessages,
                        maxTokens: 1600,
                        temperature: 0.1f,
                        cancellationToken: cancellationToken);

                    var reducedText = NormalizeAiText(reducedResponse.Content.FirstOrDefault()?.Text ?? string.Empty);
                    if (string.IsNullOrWhiteSpace(reducedText))
                        reducedText = "- Không rút gọn được nhóm dữ liệu này.";

                    next.Add($"[R{round}-G{groupIndex + 1}/{totalGroups}]\n{reducedText}");
                    tokensUsed += reducedResponse.Usage?.TotalTokenCount ?? 0;
                }

                current = next;
                round++;
            }

            return (current, tokensUsed);
        }

        private async Task WaitForAnalyzeRateSlotAsync(CancellationToken cancellationToken)
        {
            var rpmLimit = ReadIntConfig("Gemini:AnalyzeRpmLimit", DefaultAnalyzeRpmLimit, 1, 120);
            await AnalyzeRpmLock.WaitAsync(cancellationToken);
            try
            {
                while (true)
                {
                    var now = DateTime.UtcNow;
                    while (AnalyzeCallTimestamps.Count > 0 &&
                           now - AnalyzeCallTimestamps.Peek() >= TimeSpan.FromMinutes(1))
                    {
                        AnalyzeCallTimestamps.Dequeue();
                    }

                    if (AnalyzeCallTimestamps.Count < rpmLimit)
                    {
                        AnalyzeCallTimestamps.Enqueue(now);
                        return;
                    }

                    var wait = TimeSpan.FromMinutes(1) - (now - AnalyzeCallTimestamps.Peek());
                    if (wait < TimeSpan.FromMilliseconds(200))
                        wait = TimeSpan.FromMilliseconds(200);

                    _logger.LogInformation(
                        "Gemini analyze RPM gate waiting {WaitSeconds:F1}s (limit {RpmLimit}/minute).",
                        wait.TotalSeconds,
                        rpmLimit);

                    await Task.Delay(wait, cancellationToken);
                }
            }
            finally
            {
                AnalyzeRpmLock.Release();
            }
        }

        private int ReadIntConfig(string key, int fallback, int min, int max)
        {
            if (int.TryParse(_config[key], out var parsed))
                return Math.Clamp(parsed, min, max);

            return Math.Clamp(fallback, min, max);
        }

        private static string NormalizeAiText(string raw)
        {
            var normalized = raw.Trim();

            normalized = System.Text.RegularExpressions.Regex.Replace(
                normalized,
                @"<think>[\s\S]*?</think>",
                string.Empty,
                System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();

            if (normalized.StartsWith("```"))
            {
                var firstBreak = normalized.IndexOf('\n');
                normalized = firstBreak >= 0 ? normalized[(firstBreak + 1)..] : string.Empty;
            }

            if (normalized.EndsWith("```"))
                normalized = normalized[..^3];

            return normalized.Trim();
        }

        private static string ExtractJsonPayload(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return text;

            var objStart = text.IndexOf('{');
            var objEnd = text.LastIndexOf('}');
            if (objStart >= 0 && objEnd > objStart)
                return text[objStart..(objEnd + 1)];

            var arrStart = text.IndexOf('[');
            var arrEnd = text.LastIndexOf(']');
            if (arrStart >= 0 && arrEnd > arrStart)
                return text[arrStart..(arrEnd + 1)];

            return text;
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

        private static string BuildStoredCriteriaJson(
            List<CriterionResult> criteria,
            List<StoryWarning> warnings,
            string overallFeedback)
        {
            var payload = new AiFullResponse
            {
                Criteria = criteria.Select(c => new AiScoreItem
                {
                    Key = c.Key,
                    Score = c.Score,
                    MaxScore = c.MaxScore,
                    Feedback = c.Feedback,
                    Evidence = c.Evidence ?? string.Empty,
                    BibleComparison = c.BibleComparison,
                    Errors = c.Errors ?? new(),
                    Suggestions = c.Suggestions ?? new(),
                }).ToList(),
                Warnings = warnings ?? new(),
                OverallFeedback = overallFeedback ?? string.Empty,
            };

            return JsonSerializer.Serialize(payload);
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
                    Evidence = ai?.Evidence ?? string.Empty,
                    BibleComparison = ai?.BibleComparison,
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

        private class AiScoreItem
        {
            public string Key { get; set; } = string.Empty;
            public decimal Score { get; set; }
            public decimal MaxScore { get; set; }
            public string Feedback { get; set; } = string.Empty;
            public string Evidence { get; set; } = string.Empty;
            public string? BibleComparison { get; set; }
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
