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
using System.Text.Json.Serialization;
using System.Text;

namespace Service.Implementations
{
    public partial class ProjectReportService : IProjectReportService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmbeddingService _embeddingService;
        private readonly IChapterService _chapterService;
        private readonly ILogger<ProjectReportService> _logger;
        private readonly GeminiChatFailoverExecutor _geminiChatExecutor;
        private readonly ISystemConfigService _sysConfig;
        private const int DefaultAnalyzeBatchSize = 12;
        private const int DefaultAnalyzeRpmLimit = 8;
        internal const string ReviewStatusPendingStaff = "PendingStaffReview";
        internal const string ReviewStatusStaffReviewing = "StaffReviewing";
        internal const string ReviewStatusReleased = "Released";
        private static readonly SemaphoreSlim AnalyzeRpmLock = new(1, 1);
        private static readonly Queue<DateTime> AnalyzeCallTimestamps = [];

        // ── Rubric definition (8 nhóm, 20 tiêu chí, 100 điểm) ──────────────────────
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

        public ProjectReportService(
            AppDbContext context,
            IConfiguration config,
            IEmbeddingService embeddingService,
            IChapterService chapterService,
            ILogger<ProjectReportService> logger,
            ISystemConfigService sysConfig)
        {
            _context = context;
            _config = config;
            _embeddingService = embeddingService;
            _chapterService = chapterService;
            _logger = logger;
            _sysConfig = sysConfig;
            _geminiChatExecutor = new GeminiChatFailoverExecutor(
                config,
                logger,
                "Gemini Report",
                GeminiPrimaryKeyRole.Analyze,
                TimeSpan.FromMinutes(10),
                modelsConfigKey: "Gemini:AnalyzeModels"); // Dùng "Gemini:AnalyzeModels" nếu có, fallback "Gemini:ChatModels"
        }



        private async Task<OpenAI.Chat.ChatCompletion> CompleteChatWithGeminiAsync(
            IEnumerable<ChatMessage> messages,
            int maxTokens = 2500,
            float temperature = 0.7f,
            bool jsonMode = false,
            CancellationToken cancellationToken = default)
        {
            await WaitForAnalyzeRateSlotAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();

            var options = new ChatCompletionOptions
            {
                MaxOutputTokenCount = maxTokens,
                Temperature = temperature,
            };

            if (jsonMode)
            {
                options.ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat();
            }

            return await _geminiChatExecutor.CompleteAsync(messages, options, cancellationToken);
        }

        public async Task<ProjectReportResponse> AnalyzeAsync(
            Guid projectId,
            Guid userId,
            Func<int, string?, CancellationToken, Task>? progressCallback = null,
            CancellationToken cancellationToken = default,
            Guid? analysisJobId = null)
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

            if (totalWords < 1000)
            {
                throw new InvalidOperationException($"Tác phẩm cần đạt tối thiểu 1.000 chữ để có thể phân tích (hiện tại có {totalWords:N0} chữ). Hãy sáng tác thêm để AI có đủ dữ liệu đánh giá nhé!");
            }

            var snapshot = await EnsureProjectAnalysisSnapshotAsync(
                projectId,
                userId,
                chapters,
                progressCallback,
                cancellationToken);

            var chunksRaw = await _context.ChapterChunks
                .Include(c => c.Version)
                .ThenInclude(v => v.Chapter)
                .Where(c => c.ProjectId == projectId && c.Embedding != null && snapshot.ActiveVersionIds.Contains(c.VersionId))
                .ToListAsync(cancellationToken);

            if (chunksRaw.Count == 0)
                throw new InvalidOperationException("Dự án chưa có nội dung được nhúng (embed). Vui lòng chunk và embed các chương trong Workspace trước khi phân tích.");

            var orderedTuples = OrderChunksByChapter(chapters, chunksRaw);
            var chunks = orderedTuples.Select(t => t.Chunk).ToList();
            var decryptedChunks = chunks
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Content, rawDek))
                .ToList();
            var decryptedChunksWithMeta = orderedTuples
                .Select(t => (
                    Content: EncryptionHelper.DecryptWithMasterKey(t.Chunk.Content, rawDek),
                    ChapterNumber: t.ChapterNumber,
                    ChapterTitle: t.ChapterTitle
                ))
                .ToList();

            // 5. Fetch Story Bible context (genres, summary, characters, worldbuilding)
            var projectFull = await _context.Projects
                .Include(p => p.ProjectGenres).ThenInclude(pg => pg.Genre)
                .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

            var genres = projectFull?.ProjectGenres.Select(pg => pg.Genre.Name).ToList() ?? new();
            var summary = !string.IsNullOrEmpty(project.Summary)
                ? EncryptionHelper.DecryptWithMasterKey(project.Summary, rawDek)
                : null;

            var latestReport = await _context.ProjectReports
                .Where(r => r.ProjectId == projectId && r.Status == "Completed")
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            List<ReportCharacterEntry> characterEntries = new();
            List<ReportWorldbuildingEntry> worldEntries = new();
            List<ReportThemeEntry> themeEntries = new();
            List<ReportTimelineEvent> timelineEvents = new();

            if (latestReport != null)
            {
                characterEntries = await _context.ReportCharacterEntries
                    .Where(c => c.ProjectReportId == latestReport.Id)
                    .ToListAsync(cancellationToken);
                worldEntries = await _context.ReportWorldbuildingEntries
                    .Where(w => w.ProjectReportId == latestReport.Id)
                    .ToListAsync(cancellationToken);
                themeEntries = await _context.ReportThemeEntries
                    .Where(t => t.ProjectReportId == latestReport.Id)
                    .ToListAsync(cancellationToken);
                timelineEvents = await _context.ReportTimelineEvents
                    .Where(t => t.ProjectReportId == latestReport.Id)
                    .ToListAsync(cancellationToken);
            }

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
            if (themeEntries.Count > 0)
            {
                bibleBuilder.AppendLine("Chủ đề & Trọng tâm:");
                foreach (var t in themeEntries)
                {
                    var tTitle = EncryptionHelper.DecryptWithMasterKey(t.Title, rawDek);
                    var tDesc = EncryptionHelper.DecryptWithMasterKey(t.Description, rawDek);
                    var tEvidence = !string.IsNullOrWhiteSpace(t.Evidence) ? EncryptionHelper.DecryptWithMasterKey(t.Evidence, rawDek) : "";
                    var fullDesc = tDesc + (string.IsNullOrWhiteSpace(tEvidence) ? "" : $"\nDẫn chứng: {tEvidence}");
                    bibleBuilder.AppendLine($"- {tTitle}: {fullDesc[..Math.Min(1500, fullDesc.Length)]}");
                }
            }
            if (timelineEvents.Count > 0)
            {
                bibleBuilder.AppendLine("Sự kiện dòng thời gian:");
                foreach (var p in timelineEvents)
                {
                    var pTitle = EncryptionHelper.DecryptWithMasterKey(p.Title, rawDek);
                    var pContent = EncryptionHelper.DecryptWithMasterKey(p.Description, rawDek);
                    bibleBuilder.AppendLine($"- [{p.Category}] {pTitle}: {pContent[..Math.Min(1500, pContent.Length)]}");
                }
            }
            var storyBibleText = bibleBuilder.ToString().Trim();

            // Include author's AI instructions if set
            var aiInstructions = !string.IsNullOrEmpty(project.AiInstructions)
                ? EncryptionHelper.DecryptWithMasterKey(project.AiInstructions, rawDek)
                : null;

            var useRag = _config.GetValue("RagAnalysis:Enabled", true);
            List<CriterionResult> criteria;
            List<StoryWarning> warnings;
            string overallFeedback;
            int analyzeTokens;
            string factsPayloadJson;
            List<ReportItem> reportItemsForSave;
            Guid analysisRunId;
            ProjectAnalysisJob? syntheticRunCarrier = null;
            string? contentAnalysisData = null;
            string? emotionPacingData = null;
            ContentAnalysisResult? contentResObj = null;

            if (analysisJobId is Guid existingRun &&
                await _context.ProjectAnalysisJobs.AnyAsync(
                    j => j.Id == existingRun && j.ProjectId == projectId && j.UserId == userId, cancellationToken))
            {
                analysisRunId = existingRun;
            }
            else
            {
                syntheticRunCarrier = new ProjectAnalysisJob
                {
                    Id = Guid.NewGuid(),
                    ProjectId = projectId,
                    UserId = userId,
                    Status = "Completed",
                    Stage = "Completed",
                    Progress = 100,
                    ProjectVersionHash = $"sync-rag-{DateTime.UtcNow:O}",
                    StartedAt = DateTime.UtcNow,
                    CompletedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                };
                _context.ProjectAnalysisJobs.Add(syntheticRunCarrier);
                await _context.SaveChangesAsync(cancellationToken);
                analysisRunId = syntheticRunCarrier.Id;
            }

            if (useRag)
            {
                var sbManuscript = new StringBuilder();
                var currentChapterNum = -1;
                foreach (var item in decryptedChunksWithMeta)
                {
                    if (item.ChapterNumber != currentChapterNum)
                    {
                        currentChapterNum = item.ChapterNumber;
                        sbManuscript.AppendLine($"\n--- CHƯƠNG {item.ChapterNumber}{(string.IsNullOrWhiteSpace(item.ChapterTitle) ? "" : $": {item.ChapterTitle}")} ---");
                    }
                    sbManuscript.AppendLine(item.Content);
                }
                var fullManuscriptText = sbManuscript.ToString().Trim();

                // Load character names sequentially before concurrent execution to avoid EF DbContext threading conflicts
                var characterNames = await NarrativeAnalyticsHelper.LoadCharacterNamesAsync(_context, projectId, rawDek);

                var rubricTask = EvaluateWithRagPipelineAsync(
                    projectTitle,
                    chunks,
                    decryptedChunks,
                    storyBibleText,
                    chapterCount,
                    totalWords,
                    aiInstructions,
                    progressCallback,
                    analysisRunId,
                    cancellationToken);

                var contentTask = ExtractStoryBibleAsync(
                    projectTitle,
                    fullManuscriptText,
                    progressCallback,
                    cancellationToken);

                var emotionTask = AnalyzeEmotionPacingAsync(
                    projectId,
                    rawDek,
                    projectTitle,
                    decryptedChunksWithMeta,
                    characterNames,
                    progressCallback,
                    cancellationToken);

                await Task.WhenAll(rubricTask, contentTask, emotionTask);

                var rubricRes = rubricTask.Result;
                var contentRes = contentTask.Result;
                var emotionRes = emotionTask.Result;

                criteria = rubricRes.Criteria;
                warnings = rubricRes.Warnings;
                overallFeedback = rubricRes.OverallFeedback;
                analyzeTokens = rubricRes.TokensUsed + contentRes.TokensUsed + emotionRes.TokensUsed;
                factsPayloadJson = rubricRes.FactsPayloadJson;
                reportItemsForSave = rubricRes.ReportItems;

                var rawContentData = JsonSerializer.Serialize(contentRes.Content, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                var rawEmotionData = JsonSerializer.Serialize(emotionRes.Pacing, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                contentAnalysisData = EncryptionHelper.EncryptWithMasterKey(rawContentData, rawDek);
                emotionPacingData = EncryptionHelper.EncryptWithMasterKey(rawEmotionData, rawDek);
                contentResObj = contentRes.Content;
            }
            else
            {
                var rubricRes = await EvaluateWithAiAsync(
                    projectTitle,
                    decryptedChunks,
                    storyBibleText,
                    chapterCount,
                    totalWords,
                    aiInstructions,
                    progressCallback,
                    cancellationToken);

                criteria = rubricRes.Criteria;
                warnings = rubricRes.Warnings;
                overallFeedback = rubricRes.OverallFeedback;
                analyzeTokens = rubricRes.TokensUsed;
                factsPayloadJson = """{"characters":[],"chapter_stats":[],"plot_events":[],"consistency_flags":[]}""";
                reportItemsForSave = new List<ReportItem>();
            }

            var reportStatus = "Completed";
            var projectVersion = snapshot.ProjectVersionLabel;

            if (useRag)
            {
                foreach (var item in reportItemsForSave)
                {
                    var c = criteria.FirstOrDefault(x => x.Key == item.CriterionKey);
                    if (c != null && item.EvidenceChunkIds is { Count: > 0 })
                        c.EvidenceChunkOrdinals = item.EvidenceChunkIds.ToList();
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
                ReviewStatus = ReviewStatusReleased,
                ProjectVersion = projectVersion,
                TotalScore = total,
                CriteriaJson = BuildStoredCriteriaJson(criteria, warnings, overallFeedback),
                ContentAnalysisJson = contentAnalysisData,
                EmotionPacingJson = emotionPacingData,
                CreatedAt = DateTime.UtcNow,
            };
            _context.ProjectReports.Add(report);

            // Save Story Bible into report-specific tables
            if (contentResObj != null)
            {
                // 1. Save Characters
                if (contentResObj.Characters != null)
                {
                    foreach (var character in contentResObj.Characters)
                    {
                        var encName = EncryptionHelper.EncryptWithMasterKey(character.Name ?? string.Empty, rawDek);
                        var encDesc = EncryptionHelper.EncryptWithMasterKey(character.Description ?? string.Empty, rawDek);
                        var encBg = !string.IsNullOrWhiteSpace(character.Background)
                            ? EncryptionHelper.EncryptWithMasterKey(character.Background, rawDek)
                            : null;

                        var traitsStr = character.Traits != null ? JsonSerializer.Serialize(character.Traits) : "[]";
                        var encTraits = EncryptionHelper.EncryptWithMasterKey(traitsStr, rawDek);

                        var relStr = character.Relationships != null ? JsonSerializer.Serialize(character.Relationships) : "[]";
                        var encRel = EncryptionHelper.EncryptWithMasterKey(relStr, rawDek);

                        var rawRole = character.Role ?? "Supporting";
                        if (rawRole.Length > 50) rawRole = rawRole[..50];

                        _context.ReportCharacterEntries.Add(new ReportCharacterEntry
                        {
                            Id = Guid.NewGuid(),
                            ProjectReportId = report.Id,
                            Name = encName,
                            Role = rawRole,
                            Description = encDesc,
                            Background = encBg,
                            TraitsJson = encTraits,
                            RelationshipsJson = encRel,
                            FirstAppearance = character.FirstAppearance > 0 ? character.FirstAppearance : null,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                // 2. Save World Settings
                if (contentResObj.WorldSettings != null)
                {
                    foreach (var worldSetting in contentResObj.WorldSettings)
                    {
                        var encTitle = EncryptionHelper.EncryptWithMasterKey(worldSetting.Title ?? string.Empty, rawDek);
                        var encContent = EncryptionHelper.EncryptWithMasterKey(worldSetting.Description ?? string.Empty, rawDek);
                        var encImportance = !string.IsNullOrWhiteSpace(worldSetting.Importance)
                            ? EncryptionHelper.EncryptWithMasterKey(worldSetting.Importance, rawDek)
                            : null;

                        var chaptersStr = worldSetting.SourceChapters != null ? JsonSerializer.Serialize(worldSetting.SourceChapters) : "[]";
                        var encChapters = EncryptionHelper.EncryptWithMasterKey(chaptersStr, rawDek);

                        var rawCategory = worldSetting.Category ?? "Other";
                        if (rawCategory.Length > 50) rawCategory = rawCategory[..50];

                        _context.ReportWorldbuildingEntries.Add(new ReportWorldbuildingEntry
                        {
                            Id = Guid.NewGuid(),
                            ProjectReportId = report.Id,
                            Title = encTitle,
                            Content = encContent,
                            Category = rawCategory,
                            Importance = encImportance,
                            SourceChaptersJson = encChapters,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                // 3. Save Themes
                if (contentResObj.Themes != null)
                {
                    foreach (var theme in contentResObj.Themes)
                    {
                        var encTitle = EncryptionHelper.EncryptWithMasterKey(theme.Title ?? string.Empty, rawDek);
                        var encDesc = EncryptionHelper.EncryptWithMasterKey(theme.Description ?? string.Empty, rawDek);
                        var encEvidence = !string.IsNullOrWhiteSpace(theme.Evidence)
                            ? EncryptionHelper.EncryptWithMasterKey(theme.Evidence, rawDek)
                            : null;

                        _context.ReportThemeEntries.Add(new ReportThemeEntry
                        {
                            Id = Guid.NewGuid(),
                            ProjectReportId = report.Id,
                            Title = encTitle,
                            Description = encDesc,
                            Evidence = encEvidence,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                // 4. Save Timeline Events
                if (contentResObj.TimelineEvents != null)
                {
                    foreach (var timelineEvent in contentResObj.TimelineEvents)
                    {
                        var encTitle = EncryptionHelper.EncryptWithMasterKey(timelineEvent.Title ?? string.Empty, rawDek);
                        var encDesc = EncryptionHelper.EncryptWithMasterKey(timelineEvent.Description ?? string.Empty, rawDek);
                        var encTime = !string.IsNullOrWhiteSpace(timelineEvent.TimeLabel)
                            ? EncryptionHelper.EncryptWithMasterKey(timelineEvent.TimeLabel, rawDek)
                            : null;

                        // Importance là metadata enum (Normal/High/Critical) — KHÔNG mã hóa, varchar(20)
                        var rawImportance = !string.IsNullOrWhiteSpace(timelineEvent.Importance)
                            ? timelineEvent.Importance.Length <= 20
                                ? timelineEvent.Importance
                                : timelineEvent.Importance[..20]
                            : "Normal";

                        var rawCategory = timelineEvent.Category ?? "Story";
                        if (rawCategory.Length > 50) rawCategory = rawCategory[..50];

                        _context.ReportTimelineEvents.Add(new ReportTimelineEvent
                        {
                            Id = Guid.NewGuid(),
                            ProjectReportId = report.Id,
                            Category = rawCategory,
                            Title = encTitle,
                            Description = encDesc,
                            TimeLabel = encTime,
                            SortOrder = timelineEvent.SortOrder,
                            Importance = rawImportance,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }

            // Save Snapshot Data
            foreach (var chapter in chapters)
            {
                var state = snapshot.Chapters.FirstOrDefault(c => c.ChapterNumber == chapter.ChapterNumber);
                if (state == null || !state.CurrentVersionId.HasValue) continue;
                
                var version = await _context.ChapterVersions
                    .Where(v => v.Id == state.CurrentVersionId.Value)
                    .Select(v => new { v.Title, v.Content, v.WordCount })
                    .FirstOrDefaultAsync(cancellationToken);
                
                if (version != null)
                {
                    _context.ProjectReportSnapshots.Add(new ProjectReportSnapshot
                    {
                        ProjectReportId = report.Id,
                        ChapterNumber = chapter.ChapterNumber,
                        Title = version.Title ?? string.Empty,
                        Content = version.Content ?? string.Empty, // Already encrypted in DB
                        WordCount = version.WordCount
                    });
                }
            }

            if (useRag)
            {
                _context.ProjectAnalysisFacts.Add(new ProjectAnalysisFact
                {
                    ProjectId = projectId,
                    RunId = analysisRunId,
                    Payload = factsPayloadJson,
                });

                foreach (var item in reportItemsForSave)
                {
                    item.ProjectReportId = report.Id;
                    _context.ReportItems.Add(item);
                }
            }

            // 7. Deduct usage — trừ cả analysis count và token, nhưng chỉ nếu phân tích hợp lệ
            // Kiểm tra xem phân tích có dữ liệu thực tế không trước khi tính vào lượt
            bool hasValidAnalysisData = criteria.Count > 0;
            
            if (!hasValidAnalysisData)
            {
                _logger.LogWarning(
                    "Analysis for project {ProjectId} user {UserId} produced no criteria. " +
                    "Report saved but UsedAnalysisCount NOT incremented.",
                    projectId, userId);
            }
            else
            {
                // Chỉ tăng counter khi phân tích thực sự có kết quả
                sub.UsedAnalysisCount += 1;
            }
            
            await _context.SaveChangesAsync(cancellationToken);

            if (syntheticRunCarrier != null)
            {
                var carrier = await _context.ProjectAnalysisJobs.FirstOrDefaultAsync(j => j.Id == syntheticRunCarrier.Id, cancellationToken);
                if (carrier != null)
                {
                    carrier.ReportId = report.Id;
                    carrier.ProjectVersionHash = snapshot.ProjectVersionHash;
                    carrier.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(cancellationToken);
                }
            }

            return BuildResponse(report.Id, projectId, projectTitle, reportStatus, total, criteria, warnings, overallFeedback, projectVersion, snapshot.ProjectVersionHash);
        }

        public async Task<ProjectReportResponse?> GetLatestAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var requestingUser = await _context.Users.FindAsync(userId);
            var isStaffOrAdmin = requestingUser != null && (requestingUser.Role == "Staff" || requestingUser.Role == "Admin");

            var query = _context.ProjectReports
                .Include(r => r.Project)
                .Include(r => r.ReportItems)
                .Where(r => r.ProjectId == projectId);

            if (!isStaffOrAdmin)
            {
                query = query.Where(r => r.ReviewStatus == null || r.ReviewStatus == "" || r.ReviewStatus == ReviewStatusReleased);
            }

            var report = await query
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            if (report == null) return null;

            var author = await _context.Users.FindAsync(report.Project.AuthorId);
            if (author == null) throw new KeyNotFoundException("Không tìm thấy tác giả của dự án.");
            var rawDek = EncryptionHelper.DecryptWithMasterKey(author.DataEncryptionKey!, _config["Security:MasterKey"]!);
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, rawDek);

            var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            List<AiScoreItem> aiResults;
            List<StoryWarning> warnings;
            string overallFeedback = "";
            
            var criteriaSource = !string.IsNullOrWhiteSpace(report.StaffEditedCriteriaJson)
                ? report.StaffEditedCriteriaJson
                : report.CriteriaJson;

            try
            {
                var parsed = JsonSerializer.Deserialize<AiFullResponse>(criteriaSource, jsonOpts);
                aiResults = parsed?.Criteria ?? new();
                warnings = parsed?.Warnings ?? new();
                overallFeedback = parsed?.OverallFeedback ?? "";
            }
            catch
            {
                aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(criteriaSource, jsonOpts) ?? new();
                warnings = new();
            }

            var mergedLatest = MergeWithRubric(aiResults);
            foreach (var row in report.ReportItems)
            {
                var c = mergedLatest.FirstOrDefault(x => x.Key == row.CriterionKey);
                if (c != null && row.EvidenceChunkIds is { Count: > 0 })
                    c.EvidenceChunkOrdinals = row.EvidenceChunkIds.ToList();
            }

            ContentAnalysisResult? contentRes = null;
            EmotionPacingResult? emotionRes = null;
            if (!string.IsNullOrWhiteSpace(report.ContentAnalysisJson))
            {
                var decData = EncryptionHelper.DecryptWithMasterKey(report.ContentAnalysisJson, rawDek);
                try { contentRes = JsonSerializer.Deserialize<ContentAnalysisResult>(decData, jsonOpts); } catch { }
            }
            if (!string.IsNullOrWhiteSpace(report.EmotionPacingJson))
            {
                var decData = EncryptionHelper.DecryptWithMasterKey(report.EmotionPacingJson, rawDek);
                try { emotionRes = JsonSerializer.Deserialize<EmotionPacingResult>(decData, jsonOpts); } catch { }
            }

            var projectVersionHash = await ResolveProjectVersionHashAsync(report.Id, CancellationToken.None);
            return BuildResponse(report.Id, projectId, projectTitle, report.Status, report.TotalScore, mergedLatest, warnings, overallFeedback, report.ProjectVersion, projectVersionHash, report.CreatedAt, contentRes, emotionRes);
        }

        public async Task<List<ProjectReportSummary>> GetAllAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var requestingUser = await _context.Users.FindAsync(userId);
            var isStaffOrAdmin = requestingUser != null && (requestingUser.Role == "Staff" || requestingUser.Role == "Admin");

            var query = _context.ProjectReports
                .Where(r => r.ProjectId == projectId);

            if (!isStaffOrAdmin)
            {
                query = query.Where(r => r.ReviewStatus == null || r.ReviewStatus == "" || r.ReviewStatus == ReviewStatusReleased);
            }

            var reports = await query
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

            var reportIds = reports.Select(r => r.Id).ToList();
            var hashes = await _context.ProjectAnalysisJobs
                .AsNoTracking()
                .Where(j => j.ReportId.HasValue && reportIds.Contains(j.ReportId.Value))
                .Select(j => new
                {
                    ReportId = j.ReportId!.Value,
                    j.ProjectVersionHash,
                    j.CreatedAt
                })
                .ToListAsync();

            var hashLookup = hashes
                .GroupBy(x => x.ReportId)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.CreatedAt).Select(x => x.ProjectVersionHash).FirstOrDefault() ?? string.Empty);

            return reports.Select(r => new ProjectReportSummary
            {
                Id = r.Id,
                Status = r.Status,
                TotalScore = r.TotalScore,
                Classification = Classify(r.TotalScore),
                ProjectVersion = r.ProjectVersion,
                ProjectVersionHash = hashLookup.GetValueOrDefault(r.Id) ?? string.Empty,
                CreatedAt = r.CreatedAt,
            }).ToList();
        }

        public async Task<ProjectReportResponse?> GetByIdAsync(Guid reportId, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var requestingUser = await _context.Users.FindAsync(userId);
            var isStaffOrAdmin = requestingUser != null && (requestingUser.Role == "Staff" || requestingUser.Role == "Admin");

            var query = _context.ProjectReports
                .Include(r => r.Project)
                .Include(r => r.ReportItems)
                .Where(r => r.Id == reportId && r.ProjectId == projectId);

            if (!isStaffOrAdmin)
            {
                query = query.Where(r => r.ReviewStatus == null || r.ReviewStatus == "" || r.ReviewStatus == ReviewStatusReleased);
            }

            var report = await query.FirstOrDefaultAsync();

            if (report == null) return null;

            var author = await _context.Users.FindAsync(report.Project.AuthorId);
            if (author == null) throw new KeyNotFoundException("Không tìm thấy tác giả của dự án.");
            var rawDek = EncryptionHelper.DecryptWithMasterKey(author.DataEncryptionKey!, _config["Security:MasterKey"]!);
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, rawDek);

            var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            List<AiScoreItem> aiResults;
            List<StoryWarning> warnings;
            string overallFeedback = "";
            
            var criteriaSource = !string.IsNullOrWhiteSpace(report.StaffEditedCriteriaJson)
                ? report.StaffEditedCriteriaJson
                : report.CriteriaJson;

            try
            {
                var parsed = JsonSerializer.Deserialize<AiFullResponse>(criteriaSource, jsonOpts);
                aiResults = parsed?.Criteria ?? new();
                warnings = parsed?.Warnings ?? new();
                overallFeedback = parsed?.OverallFeedback ?? "";
            }
            catch
            {
                aiResults = JsonSerializer.Deserialize<List<AiScoreItem>>(criteriaSource, jsonOpts) ?? new();
                warnings = new();
            }

            var mergedById = MergeWithRubric(aiResults);
            foreach (var row in report.ReportItems)
            {
                var c = mergedById.FirstOrDefault(x => x.Key == row.CriterionKey);
                if (c != null && row.EvidenceChunkIds is { Count: > 0 })
                    c.EvidenceChunkOrdinals = row.EvidenceChunkIds.ToList();
            }

            ContentAnalysisResult? contentRes = null;
            EmotionPacingResult? emotionRes = null;
            if (!string.IsNullOrWhiteSpace(report.ContentAnalysisJson))
            {
                var decData = EncryptionHelper.DecryptWithMasterKey(report.ContentAnalysisJson, rawDek);
                try { contentRes = JsonSerializer.Deserialize<ContentAnalysisResult>(decData, jsonOpts); } catch { }
            }
            if (!string.IsNullOrWhiteSpace(report.EmotionPacingJson))
            {
                var decData = EncryptionHelper.DecryptWithMasterKey(report.EmotionPacingJson, rawDek);
                try { emotionRes = JsonSerializer.Deserialize<EmotionPacingResult>(decData, jsonOpts); } catch { }
            }

            var projectVersionHash = await ResolveProjectVersionHashAsync(report.Id, CancellationToken.None);
            return BuildResponse(report.Id, projectId, projectTitle, report.Status, report.TotalScore, mergedById, warnings, overallFeedback, report.ProjectVersion, projectVersionHash, report.CreatedAt, contentRes, emotionRes);
        }

        public async Task<List<ProjectReportSnapshotItem>> GetReportSnapshotsAsync(
            Guid reportId,
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var report = await _context.ProjectReports
                .Include(r => r.Snapshots)
                .Include(r => r.Project)
                .FirstOrDefaultAsync(r => r.Id == reportId && r.ProjectId == projectId, cancellationToken);

            if (report == null)
                throw new KeyNotFoundException("Không tìm thấy báo cáo.");

            var author = await _context.Users.FindAsync(report.Project.AuthorId);
            if (author == null) throw new KeyNotFoundException("Không tìm thấy người dùng.");
            var rawDek = EncryptionHelper.DecryptWithMasterKey(author.DataEncryptionKey!, _config["Security:MasterKey"]!);

            return report.Snapshots
                .OrderBy(s => s.ChapterNumber)
                .Select(s => new ProjectReportSnapshotItem
                {
                    Id = s.Id,
                    ProjectReportId = s.ProjectReportId,
                    ChapterNumber = s.ChapterNumber,
                    Title = s.Title,
                    Content = EncryptionHelper.DecryptWithMasterKey(s.Content, rawDek),
                    WordCount = s.WordCount
                })
                .ToList();
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private async Task VerifyOwnershipAsync(Guid projectId, Guid userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user != null && (user.Role == "Staff" || user.Role == "Admin"))
            {
                var projectExists = await _context.Projects.AnyAsync(p => p.Id == projectId && !p.IsDeleted);
                if (!projectExists)
                    throw new KeyNotFoundException("Dự án không tồn tại.");
                return;
            }

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
    {""code"":""INCOMPLETE"",""severity"":""INFO"",""title"":"""",""detail"":""""},
    {""code"":""REPETITION"",""severity"":""WARNING"",""title"":"""",""detail"":""""},
    {""code"":""PLAGIARISM_RISK"",""severity"":""CRITICAL"",""title"":"""",""detail"":""""},
    {""code"":""INCONSISTENCY"",""severity"":""WARNING"",""title"":"""",""detail"":""""},
    {""code"":""SEXUAL_CONTENT"",""severity"":""WARNING"",""title"":"""",""detail"":""""},
    {""code"":""ANTI_STATE"",""severity"":""CRITICAL"",""title"":"""",""detail"":""""},
    {""code"":""SPELLING_FORMATTING"",""severity"":""WARNING"",""title"":"""",""detail"":""""}
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
                 LƯU Ý QUAN TRỌNG VỀ LỖI CHÍNH TẢ & KỸ THUẬT VĂN BẢN (code="SPELLING_FORMATTING"):
                 - Bạn PHẢI quét kỹ toàn bộ tác phẩm để phát hiện các lỗi chính tả, lỗi gõ phím tiếng Việt (vd: 'loi' thay vì 'lỗi', 'đưọc' thay vì 'được'), viết hoa tùy tiện, khoảng trắng kép, dấu câu đặt sai vị trí hoặc định dạng văn bản bị lỗi.
                 - BẮT BUỘC phải chỉ ra các ví dụ cụ thể của từ bị viết sai và định vị rõ chương nào, đoạn nào. Tuyệt đối KHÔNG nhận xét chung chung như "có một số lỗi chính tả". Nếu phát hiện lỗi chính tả, bắt buộc phải trả về warning này với severity="WARNING", title="Lỗi kỹ thuật văn bản & chính tả" và detail liệt kê cụ thể các lỗi kèm vị trí chương để tác giả sửa đổi.

                Bạn là giám khảo văn học chuyên nghiệp. Nhiệm vụ: đọc kỹ toàn bộ văn bản, đánh giá 20 tiêu chí và phát hiện các vấn đề đặc biệt (CHƯA KẾT THÚC, LẶP LẠI, ĐẠO NHÁI...).

                THÔNG TIN HOÀN THIỆN TÁC PHẨM:
                {{completenessNote}}

                QUY TẮC BẮT BUỘC — VI PHẠM SẼ BỊ HỦY:
                1. CHẾ ĐỘ GIÁM KHẢO KHÓ TÍNH: Bạn đóng vai một Cố vấn văn học CỰC KỲ KHẮT KHE. Hãy tìm ra mọi hạt sạn, lỗi lặp từ, văn phong sáo rỗng (cliches), hoặc sự thiếu nhất quán. TUYỆT ĐỐI không cho điểm khuyến khích. Thà cho điểm thấp để tác giả tiến bộ còn hơn cho điểm cao ảo.
                2. CHỐNG ẢO GIÁC 100% (ZERO HALLUCINATION): TUYỆT ĐỐI KHÔNG SỬ DỤNG KIẾN THỨC BÊN NGOÀI. Nếu truyện mượn tên nhân vật nổi tiếng (vd: Tiểu Long Nữ), bạn CẤM tự suy diễn bối cảnh gốc của tác phẩm đó. Chỉ được phép phân tích dựa trên nội dung tác giả cung cấp trong "Nội dung tác phẩm".
                2. TUỲ BIẾN THEO THỂ LOẠI: Tiêu chuẩn đánh giá phải dựa vào Thể loại của truyện (nếu có trong Tham chiếu nền). Ví dụ: Tiên hiệp ưu tiên tính logic của hệ thống tu luyện & thế giới quan; Ngôn tình ưu tiên chiều sâu cảm xúc & chemistry; Trinh thám ưu tiên tính logic của vụ án.
                3. feedback: 3-4 câu nhận xét CỤ THỂ, phân tích sâu về kỹ thuật viết.
                4. evidence: TRÍCH DẪN NGUYÊN VĂN ít nhất 2 đến 3 câu quan trọng nhất từ nội dung truyện làm bằng chứng cho nhận xét (phân tách rõ ràng giữa các dẫn chứng bằng dấu ba chấm '...' hoặc dấu xuống dòng). PHẢI CÓ TRÍCH DẪN THỰC TẾ, không được tự bịa.
                5. bibleComparison: SO SÁNH trung lập với cẩm nang (nếu có). Nêu rõ điểm nào khớp, điểm nào khác biệt/thay đổi. KHÔNG trừ điểm nếu có sự khác biệt so với kế hoạch ban đầu. Nếu không có cẩm nang: để null.
                6. errors: BẮT BUỘC liệt kê 3-5 lỗi/vấn đề cụ thể cho mỗi mục — nêu rõ vấn đề + ví dụ câu văn mắc lỗi.
                7. suggestions: BẮT BUỘC liệt kê 3-5 gợi ý/cách sửa cụ thể cho mỗi mục — nêu hướng xử lý chi tiết cho từng lỗi đã nêu.
                8. score: Chấm điểm CỰC KỲ NGHIÊM KHẮC theo RUBRIC 5 ĐIỂM sau (Tiêu chuẩn xuất bản):
                   - 1 điểm: Kém — Văn phong thô sơ, sai chính tả/ngữ pháp nặng, phá vỡ logic cơ bản.
                   - 2 điểm: Yếu — Có cốt truyện nhưng diễn đạt lúng túng, nhân vật mờ nhạt, nhiều sáo rỗng.
                   - 3 điểm: Đạt yêu cầu — Viết đúng quy tắc nhưng chưa có chất riêng, còn lặp ý, nhịp độ chưa tốt. (Đây là mức điểm cho các tác phẩm 'tạm ổn' nhưng chưa hay).
                   - 4 điểm: Tốt — Chuyên nghiệp, ngôn ngữ sắc sảo, cảm xúc chân thực, có bản sắc riêng.
                   - 5 điểm: Xuất sắc — Tinh tế, độc đáo, lôi cuốn ấn tượng, không có hạt sạn về logic. (Chỉ dành cho tác phẩm thực sự xuất sắc).
                9. Tất cả 20 mục phải có đủ feedback, evidence, errors (≥3), suggestions (≥3) — KHÔNG được để trống. Nếu tác phẩm quá ngắn hoặc quá tệ, hãy mạnh dạn cho điểm 1-2.

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

                e) NỘI DUNG TÌNH DỤC KHÔNG PHÙ HỢP (code="SEXUAL_CONTENT"):
                   - Phát hiện: các cảnh quan hệ tình dục được miêu tả trực tiếp, chi tiết, phô trương (explicit sexual scenes); nội dung khiêu dâm; miêu tả tình dục liên quan đến nhân vật chưa thành niên (dù có hay không có xác nhận tuổi).
                   - PHÂN BIỆT: Cảnh lãng mạn, hôn nhẹ, ám chỉ tinh tế hoặc ngụ ý (implied) là BÌNH THƯỜNG, KHÔNG cắm cờ. Chỉ cắm khi nội dung VÀO THẲNG miêu tả hành vi tình dục một cách rõ ràng.
                   - Nếu phát hiện:
                     + Người lớn (adult explicit): severity="WARNING", title="Nội dung người lớn — cần dán nhãn 18+", detail: trích dẫn đoạn cụ thể
                     + Liên quan trẻ em / nhân vật chưa thành niên: severity="CRITICAL", title="Nội dung tình dục liên quan trẻ em — vi phạm nghiêm trọng", detail: trích dẫn và giải thích rõ
                   - Đây là cờ BẮT BUỘC xem xét — không được bỏ sót.

                f) NỘI DUNG CHÍNH TRỊ NHẠY CẢM / XUYÊN TẠC / CHỐNG PHÁ (code="ANTI_STATE"):
                   - Phát hiện các nội dung:
                     + Phủ nhận, bác bỏ hoặc xuyên tạc lịch sử dân tộc, chủ quyền quốc gia Việt Nam
                     + Tuyên truyền chống lại Nhà nước, Đảng Cộng sản Việt Nam hoặc chế độ chính trị
                     + Kích động chia rẽ dân tộc, tôn giáo, vùng miền
                     + Ca ngợi, biện hộ cho các tổ chức/cá nhân bị coi là phản quốc, khủng bố
                     + Xuyên tạc chính sách, lãnh đạo Nhà nước một cách có chủ đích và mang tính kích động
                   - PHÂN BIỆT: Phê phán xã hội mang tính văn học, phản ánh mặt trái cuộc sống (tham nhũng, bất công…) là BÌNH THƯỜNG nếu không có ý đồ chống phá rõ ràng. Chỉ cắm cờ khi nội dung mang tính kích động, tuyên truyền có hệ thống.
                   - Nếu phát hiện: severity="CRITICAL", title="Nội dung chính trị nhạy cảm — cần xem xét pháp lý", detail: trích dẫn đoạn cụ thể và giải thích lý do xếp loại
                   - Đây là cờ BẮT BUỘC xem xét — không được bỏ sót.

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
                    jsonMode: true,
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
            var rpmLimit = Math.Clamp(await _sysConfig.GetAsync("gemini.analyze_rpm_limit", 120), 1, 1200);
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

            var extracted = text;
            var objStart = text.IndexOf('{');
            var objEnd = text.LastIndexOf('}');
            if (objStart >= 0 && objEnd > objStart)
            {
                extracted = text[objStart..(objEnd + 1)];
            }
            else
            {
                var arrStart = text.IndexOf('[');
                var arrEnd = text.LastIndexOf(']');
                if (arrStart >= 0 && arrEnd > arrStart)
                {
                    extracted = text[arrStart..(arrEnd + 1)];
                }
            }

            return JsonSanitizer.Sanitize(extracted);
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
            List<StoryWarning>? warnings = null, string overallFeedback = "", string projectVersion = "v1.0", string projectVersionHash = "", DateTime? createdAt = null, ContentAnalysisResult? contentAnalysis = null, EmotionPacingResult? emotionPacing = null)
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
                ProjectVersionHash = projectVersionHash,
                Groups = groups,
                Warnings = warnings ?? new(),
                ContentAnalysis = contentAnalysis,
                EmotionPacing = emotionPacing,
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
            [JsonConverter(typeof(SafeStringConverter))]
            public string Feedback { get; set; } = string.Empty;
            [JsonConverter(typeof(SafeStringConverter))]
            public string Evidence { get; set; } = string.Empty;
            [JsonConverter(typeof(SafeStringConverter))]
            public string? BibleComparison { get; set; }
            [JsonConverter(typeof(SafeStringListConverter))]
            public List<string> Errors { get; set; } = new();
            [JsonConverter(typeof(SafeStringListConverter))]
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
