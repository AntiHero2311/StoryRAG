using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Service.Implementations
{
    public class ProjectImportService : IProjectImportService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly ILogger<ProjectImportService> _logger;
        private readonly IChunkingService _chunkingService;
        private readonly IEmbeddingService _embeddingService;
        private readonly INotificationService _notificationService;
        private readonly GeminiChatFailoverExecutor _gemini;
        private readonly IServiceScopeFactory _scopeFactory;

        // Giới hạn số chương AI đọc để tránh tốn quá nhiều token
        private const int MaxChaptersForAiScan = 20;
        // Giới hạn ký tự tóm tắt mỗi chương gửi cho AI (tránh overflow context window)
        private const int MaxCharsPerChapterSummary = 3000;

        public ProjectImportService(
            AppDbContext context,
            IConfiguration config,
            ILogger<ProjectImportService> logger,
            IChunkingService chunkingService,
            IEmbeddingService embeddingService,
            INotificationService notificationService,
            IServiceScopeFactory scopeFactory)
        {
            _context = context;
            _config = config;
            _logger = logger;
            _chunkingService = chunkingService;
            _embeddingService = embeddingService;
            _notificationService = notificationService;
            _scopeFactory = scopeFactory;
            // Dùng ImportModels (gemini flash, RPM cao) thay vì ChatModels (gemma, 15 RPM)
            _gemini = new GeminiChatFailoverExecutor(
                config,
                logger,
                "Project Import AI Extraction",
                GeminiPrimaryKeyRole.Analyze,
                TimeSpan.FromMinutes(8),
                modelsConfigKey: "Gemini:ImportModels");
        }

        public async Task<ProjectImportResult> ImportFromManuscriptAsync(
            Guid userId,
            string fileName,
            string? contentType,
            byte[] fileBytes)
        {
            // ── Bước 1: Lấy User & DEK ──────────────────────────────────────────
            var masterKey = _config["Security:MasterKey"]
                ?? throw new InvalidOperationException("MasterKey không tìm thấy trong cấu hình.");

            var user = await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("Người dùng không tồn tại.");

            if (string.IsNullOrEmpty(user.DataEncryptionKey))
                throw new InvalidOperationException("Khóa mã hóa người dùng chưa được thiết lập.");

            var rawDek = EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey, masterKey);

            // ── Bước 2: Trích xuất văn bản từ file ──────────────────────────────
            var (_, plainText) = ManuscriptExtractorHelper.ExtractText(fileName, contentType, fileBytes);
            if (string.IsNullOrWhiteSpace(plainText))
                throw new Exception("Không trích xuất được nội dung từ file.");

            // ── Bước 3: Tạo Project mới ─────────────────────────────────────────
            var projectTitle = Path.GetFileNameWithoutExtension(fileName);
            if (projectTitle.Length > 200) projectTitle = projectTitle[..200];

            var project = new Project
            {
                AuthorId = userId,
                Title = EncryptionHelper.EncryptWithMasterKey(projectTitle, rawDek),
                Status = "Draft",
            };
            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            // ── Bước 4: Chia chương & lưu vào DB ───────────────────────────────
            var chapterParts = ManuscriptExtractorHelper.SplitIntoChapterParts(plainText, splitByHeadings: true);
            int chaptersImported = 0;
            var plainContentByVersionId = new Dictionary<Guid, string>(); // plain text để chunk
            var now = DateTime.UtcNow;
            var chaptersToInsert = new List<Chapter>(chapterParts.Count);
            var versionsToInsert = new List<ChapterVersion>(chapterParts.Count);
            var currentVersionByChapterId = new Dictionary<Guid, Guid>(chapterParts.Count);

            int currentChapterNumber = 0;
            foreach (var part in chapterParts)
            {
                currentChapterNumber++;
                var wordCount = CountWords(part.Content);
                var chapterId = Guid.NewGuid();
                var versionId = Guid.NewGuid();

                var chapter = new Chapter
                {
                    Id = chapterId,
                    ProjectId = project.Id,
                    ChapterNumber = currentChapterNumber,
                    Title = part.Title ?? $"Chương {currentChapterNumber}",
                    WordCount = wordCount,
                    CurrentVersionNum = 1,
                    UpdatedAt = now,
                };
                chaptersToInsert.Add(chapter);

                var htmlContent = PlainTextToHtml(part.Content);
                var version = new ChapterVersion
                {
                    Id = versionId,
                    ChapterId = chapterId,
                    VersionNumber = 1,
                    Title = "Phiên bản 1",
                    Content = EncryptionHelper.EncryptWithMasterKey(htmlContent, rawDek),
                    WordCount = wordCount,
                    TokenCount = _chunkingService.EstimateTokenCount(part.Content),
                    CreatedBy = userId,
                };
                versionsToInsert.Add(version);
                currentVersionByChapterId[chapterId] = versionId;
                plainContentByVersionId[versionId] = part.Content;
                chaptersImported++;
            }

            _context.Chapters.AddRange(chaptersToInsert);
            await _context.SaveChangesAsync();

            _context.ChapterVersions.AddRange(versionsToInsert);
            await _context.SaveChangesAsync();

            foreach (var chapter in chaptersToInsert)
            {
                if (currentVersionByChapterId.TryGetValue(chapter.Id, out var versionId))
                    chapter.CurrentVersionId = versionId;
            }
            await _context.SaveChangesAsync();

            // ── Bước 5: Trích xuất nhanh bằng heuristic (Bỏ qua theo yêu cầu: không trích xuất nội dung khác ngoài chương truyện) ─
            int genresLinked = 0;
            int timelineEventsExtracted = 0;
            string? extractedSummary = null;



            // ── Bước 6: Chunk tất cả chương ─────────────────────────────────────
            _logger.LogInformation("Import {ProjectId}: bắt đầu chunk {Count} chương.", project.Id, versionsToInsert.Count);
            var chunksToInsert = new List<ChapterChunk>();
            foreach (var version in versionsToInsert)
            {
                if (!plainContentByVersionId.TryGetValue(version.Id, out var plainContent))
                    continue;

                var textChunks = _chunkingService.SplitIntoChunks(plainContent);
                var chunkEntities = textChunks.Select((chunkText, idx) => new ChapterChunk
                {
                    VersionId = version.Id,
                    ProjectId = project.Id,
                    ChunkIndex = idx,
                    Content = EncryptionHelper.EncryptWithMasterKey(chunkText, rawDek),
                    TokenCount = _chunkingService.EstimateTokenCount(chunkText),
                }).ToList();

                chunksToInsert.AddRange(chunkEntities);
                version.IsChunked = true;
                version.IsEmbedded = false;
                version.UpdatedAt = DateTime.UtcNow;
            }
            if (chunksToInsert.Count > 0)
                _context.ChapterChunks.AddRange(chunksToInsert);
            await _context.SaveChangesAsync();

            // ── Bước 7: Nhúng tất cả chương trong nền song song (không chặn response HTTP) ──
            _logger.LogInformation("Import {ProjectId}: Khởi chạy tiến trình nhúng dữ liệu song song trong nền ({Count} chương).", project.Id, chaptersToInsert.Count);
            _ = Task.Run(async () =>
            {
                try
                {
                    // Chạy song song tối đa 5 chương cùng lúc để tránh làm nghẽn DbConnection pool hoặc rate limit
                    using var semaphore = new SemaphoreSlim(5);
                    var embeddingTasks = chaptersToInsert.Select(async chapter =>
                    {
                        await semaphore.WaitAsync();
                        try
                        {
                            using var scope = _scopeFactory.CreateScope();
                            var scopedEmbeddingService = scope.ServiceProvider.GetRequiredService<IEmbeddingService>();
                            await scopedEmbeddingService.EmbedChapterAsync(chapter.Id, userId);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Import {ProjectId} trong nền: embed chương {ChapterId} thất bại, worker sẽ tự động retry sau.", project.Id, chapter.Id);
                        }
                        finally
                        {
                            semaphore.Release();
                        }
                    });

                    await Task.WhenAll(embeddingTasks);
                    _logger.LogInformation("Import {ProjectId}: Đã hoàn thành nhúng dữ liệu trong nền thành công.", project.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Import {ProjectId}: Lỗi nghiêm trọng khi nhúng dữ liệu trong nền.", project.Id);
                }
            });

            // ── Bước 8: Chạy AI trích xuất thông tin bằng AI (Tóm tắt, nhân vật, bối cảnh, timeline) ──
            int charactersExtracted = 0;
            int settingsExtracted = 0;
            bool aiExtractionFailed = false;
            string? aiExtractionError = null;

            var samples = new List<string>();
            int scanCount = 0;
            foreach (var part in chapterParts)
            {
                if (scanCount >= MaxChaptersForAiScan) break;
                var chapterTitle = part.Title ?? $"Chương {scanCount + 1}";
                var sample = part.Content.Length > MaxCharsPerChapterSummary
                    ? part.Content[..MaxCharsPerChapterSummary]
                    : part.Content;
                samples.Add($"--- {chapterTitle} ---\n{sample}");
                scanCount++;
            }

            if (samples.Count > 0)
            {
                var combinedContent = string.Join("\n\n", samples);
                _logger.LogInformation("Import {ProjectId}: Bắt đầu chạy AI trích xuất thông tin.", project.Id);
                try
                {
                    var aiExtracted = await ExtractProjectInfoWithAiAsync(combinedContent, projectTitle);
                    if (aiExtracted != null)
                    {
                        var counts = await ApplyAiExtractionAsync(project, aiExtracted, rawDek, isReExtract: false);
                        if (!string.IsNullOrWhiteSpace(counts.Summary))
                        {
                            extractedSummary = counts.Summary;
                        }
                        charactersExtracted = counts.Characters;
                        settingsExtracted = counts.Settings;
                        timelineEventsExtracted += counts.Timeline;
                        _logger.LogInformation("Import {ProjectId}: AI trích xuất thành công tóm tắt, {CharCount} nhân vật, {SettingCount} bối cảnh, {TimelineCount} sự kiện.",
                            project.Id, charactersExtracted, settingsExtracted, counts.Timeline);
                    }
                    else
                    {
                        aiExtractionFailed = true;
                        aiExtractionError = "AI không trả về kết quả hợp lệ.";
                        _logger.LogWarning("Import {ProjectId}: AI trích xuất trả về null hoặc không hợp lệ.", project.Id);
                    }
                }
                catch (Exception ex)
                {
                    aiExtractionFailed = true;
                    aiExtractionError = ex.Message;
                    _logger.LogError(ex, "Import {ProjectId}: Chạy AI trích xuất thất bại.", project.Id);
                }
            }

            var result = new ProjectImportResult
            {
                ProjectId = project.Id,
                ProjectTitle = projectTitle,
                ChaptersImported = chaptersImported,
                CharactersExtracted = charactersExtracted,
                SettingsExtracted = settingsExtracted,
                TimelineEventsExtracted = timelineEventsExtracted,
                GenresLinked = genresLinked,
                Summary = extractedSummary,
                AiExtractionFailed = aiExtractionFailed,
                AiExtractionError = aiExtractionError,
            };

            // ── Bước 9: Gửi notification ─────────────────────────────────────────
            try
            {
                var details = new List<string> { $"{chaptersImported} chương" };
                if (genresLinked > 0) details.Add($"{genresLinked} thể loại");
                if (charactersExtracted > 0) details.Add($"{charactersExtracted} nhân vật");
                if (settingsExtracted > 0) details.Add($"{settingsExtracted} bối cảnh");
                if (timelineEventsExtracted > 0) details.Add($"{timelineEventsExtracted} sự kiện");

                await _notificationService.CreateForUserAsync(
                    userId,
                    type: "success",
                    title: "Import bản thảo thành công",
                    message: $"Đã nhập \"{projectTitle}\" — {string.Join(", ", details)}.",
                    tag: $"import:{project.Id}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to create import notification for project {ProjectId}.", project.Id);
            }

            return result;
        }

        // ── ReExtract ────────────────────────────────────────────────────────────

        public async Task<ReExtractResult> ReExtractAsync(Guid projectId, Guid userId)
        {
            var masterKey = _config["Security:MasterKey"]
                ?? throw new InvalidOperationException("MasterKey không tìm thấy trong cấu hình.");

            var user = await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("Người dùng không tồn tại.");

            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && p.AuthorId == userId && !p.IsDeleted)
                ?? throw new KeyNotFoundException("Project không tồn tại hoặc bạn không có quyền truy cập.");

            var rawDek = EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);
            var projectTitle = EncryptionHelper.DecryptWithMasterKey(project.Title, rawDek);

            // Lấy nội dung tối đa MaxChaptersForAiScan chương đầu
            var chapters = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .OrderBy(c => c.ChapterNumber)
                .Take(MaxChaptersForAiScan)
                .Include(c => c.CurrentVersion)
                .ToListAsync();

            var samples = new List<string>();
            foreach (var ch in chapters)
            {
                if (ch.CurrentVersion == null) continue;
                var plainHtml = EncryptionHelper.DecryptWithMasterKey(ch.CurrentVersion.Content, rawDek);
                // Strip HTML tags để AI đọc plain text
                var plainText = System.Text.RegularExpressions.Regex.Replace(plainHtml, "<[^>]+>", " ");
                var sample = plainText.Length > MaxCharsPerChapterSummary
                    ? plainText[..MaxCharsPerChapterSummary]
                    : plainText;
                var chapterTitle = string.IsNullOrWhiteSpace(ch.Title) ? $"Chương {ch.ChapterNumber}" : ch.Title;
                samples.Add($"--- {chapterTitle} ---\n{sample}");
            }

            if (samples.Count == 0)
                throw new InvalidOperationException("Project không có chapter nào để trích xuất.");

            var combinedContent = string.Join("\n\n", samples);
            AiExtractionResponse? aiExtracted;
            try
            {
                aiExtracted = await ExtractProjectInfoWithAiAsync(combinedContent, projectTitle);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ReExtract AI call failed for project {ProjectId}.", projectId);
                return new ReExtractResult
                {
                    ProjectId = projectId,
                    AiExtractionFailed = true,
                    AiExtractionError = ex.Message,
                };
            }

            if (aiExtracted == null)
                return new ReExtractResult { ProjectId = projectId, AiExtractionFailed = true, AiExtractionError = "AI không trả về kết quả hợp lệ." };

            var counts = await ApplyAiExtractionAsync(project, aiExtracted, rawDek, isReExtract: true);

            return new ReExtractResult
            {
                ProjectId = projectId,
                Summary = counts.Summary,
                CharactersExtracted = counts.Characters,
                SettingsExtracted = counts.Settings,
                TimelineEventsExtracted = counts.Timeline,
                AiExtractionFailed = false,
            };
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        /// <summary>
        /// Ghi kết quả AI extraction vào DB.
        /// isReExtract=true: ghi đè Summary (nếu có), thêm mới Character/Setting/Timeline chưa có.
        /// isReExtract=false: luôn ghi (import lần đầu).
        /// </summary>
        private async Task<(string? Summary, int Characters, int Settings, int Timeline)> ApplyAiExtractionAsync(
            Project project,
            AiExtractionResponse aiExtracted,
            string rawDek,
            bool isReExtract)
        {
            string? extractedSummary = null;
            int charactersExtracted = 0;
            int settingsExtracted = 0;
            int timelineEventsExtracted = 0;

            if (!string.IsNullOrWhiteSpace(aiExtracted.Summary))
            {
                // isReExtract: chỉ cập nhật nếu Summary hiện tại trống
                var currentSummaryEmpty = string.IsNullOrWhiteSpace(project.Summary);
                if (!isReExtract || currentSummaryEmpty)
                {
                    extractedSummary = aiExtracted.Summary;
                    project.Summary = EncryptionHelper.EncryptWithMasterKey(aiExtracted.Summary, rawDek);
                }
            }

            await _context.SaveChangesAsync();
            return (extractedSummary, charactersExtracted, settingsExtracted, timelineEventsExtracted);
        }

        private async Task<AiExtractionResponse?> ExtractProjectInfoWithAiAsync(string combinedContent, string projectTitle)
        {
            var jsonSchema = """
                {
                  "summary": "Tóm tắt cốt truyện tổng thể trong 3-5 câu"
                }
                """;

            var prompt = "Bạn là trợ lý phân tích bản thảo văn học. Dưới đây là nội dung (hoặc một phần) của tác phẩm \"" + projectTitle + "\".\n\n" +
                "Hãy đọc và trả về dữ liệu dưới dạng JSON theo đúng cấu trúc sau (KHÔNG có markdown, KHÔNG có giải thích thêm):\n\n" +
                jsonSchema + "\n\n" +
                "NỘI DUNG BẢN THẢO:\n" + combinedContent;

            var messages = new List<ChatMessage>
            {
                new UserChatMessage(prompt)
            };

            var completion = await _gemini.CompleteAsync(messages);
            var rawJson = completion.Content[0].Text?.Trim() ?? string.Empty;

            // Strip markdown code fences nếu AI vẫn bọc JSON trong ```json ... ```
            if (rawJson.StartsWith("```"))
            {
                var firstNewline = rawJson.IndexOf('\n');
                var lastFence = rawJson.LastIndexOf("```");
                if (firstNewline > 0 && lastFence > firstNewline)
                    rawJson = rawJson[(firstNewline + 1)..lastFence].Trim();
            }

            try
            {
                return JsonSerializer.Deserialize<AiExtractionResponse>(rawJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                });
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to parse AI extraction JSON. Raw: {Raw}", rawJson[..Math.Min(500, rawJson.Length)]);
                return null;
            }
        }

        // Từ khóa nhận diện trường tóm tắt/nội dung của tác giả (dùng cả dạng "Key:" và dạng heading)
        private static readonly string[] SummaryFieldKeywords =
        [
            "nội dung", "noi dung", "tóm tắt", "tom tat",
            "mô tả", "mo ta", "giới thiệu", "gioi thieu",
            "lời mở đầu", "loi mo dau", "lời tựa", "loi tua",
            "synopsis", "summary", "description", "introduction", "preface", "about", "blurb",
        ];

        /// <summary>
        /// Tìm tóm tắt/lời mở đầu do tác giả cung cấp theo thứ tự ưu tiên:
        /// 1) Dòng dạng "Nội Dung: [giá trị]" hoặc "Tóm Tắt: [giá trị]" trước Chương 1
        ///    — bao gồm nội dung nhiều dòng tiếp theo cho đến dòng trống hoặc field khác.
        /// 2) Đoạn văn tự do (không có nhãn) trước Chương 1 nếu đủ dài.
        /// 3) Đoạn đầu tiên của Chương 1 làm fallback.
        /// </summary>
        private static string? ExtractHeuristicSummary(
            string fullPlainText,
            IReadOnlyList<ManuscriptExtractorHelper.ManuscriptChapterPart> chapterParts)
        {
            const int maxSummaryLen = 800;

            var preChapterText = ExtractPreChapterText(fullPlainText);

            if (!string.IsNullOrWhiteSpace(preChapterText))
            {
                var lines = preChapterText
                    .Replace("\r\n", "\n").Replace('\r', '\n')
                    .Split('\n');

                // ── Ưu tiên 1: tìm dòng dạng "Key: Value" ───────────────────────
                for (var i = 0; i < lines.Length; i++)
                {
                    var line = lines[i];
                    var colonIdx = line.IndexOf(':');
                    if (colonIdx <= 0) continue;

                    var key = line[..colonIdx].Trim().ToLowerInvariant();
                    // Loại bỏ dấu tiếng Việt khi so sánh
                    if (!SummaryFieldKeywords.Any(kw => key.Contains(kw)))
                        continue;

                    // Lấy giá trị sau dấu ":"
                    var inlineValue = colonIdx + 1 < line.Length
                        ? line[(colonIdx + 1)..].Trim()
                        : string.Empty;

                    // Thu thập thêm các dòng tiếp theo (multi-line value)
                    var valueBuilder = new StringBuilder();
                    if (!string.IsNullOrWhiteSpace(inlineValue))
                        valueBuilder.Append(inlineValue);

                    for (var j = i + 1; j < lines.Length; j++)
                    {
                        var nextLine = lines[j].Trim();
                        // Dừng khi gặp dòng trống (blank separator) hoặc field mới
                        if (string.IsNullOrWhiteSpace(nextLine)) break;
                        var nextColon = nextLine.IndexOf(':');
                        if (nextColon > 0)
                        {
                            var nextKey = nextLine[..nextColon].Trim().ToLowerInvariant();
                            // Là field mới nếu key ngắn (tên trường thường < 30 ký tự)
                            if (nextKey.Length < 30) break;
                        }
                        if (valueBuilder.Length > 0) valueBuilder.Append(' ');
                        valueBuilder.Append(nextLine);
                    }

                    var value = valueBuilder.ToString().Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                        return value.Length <= maxSummaryLen ? value : value[..maxSummaryLen] + "...";
                }

                // ── Ưu tiên 2: đoạn văn tự do đủ dài trước Chương 1 ─────────────
                var paragraphs = preChapterText
                    .Replace("\r\n", "\n").Replace('\r', '\n')
                    .Split(new[] { "\n\n" }, StringSplitOptions.RemoveEmptyEntries);

                foreach (var para in paragraphs)
                {
                    var trimmed = para.Trim();
                    // Bỏ qua đoạn ngắn kiểu "Tên truyện: ...", "Thể loại: ..."
                    if (trimmed.Length < 80) continue;
                    return trimmed.Length <= maxSummaryLen ? trimmed : trimmed[..maxSummaryLen] + "...";
                }
            }

            // ── Fallback: đoạn đầu chương 1 ─────────────────────────────────────
            var firstContent = chapterParts.FirstOrDefault()?.Content ?? string.Empty;
            if (string.IsNullOrWhiteSpace(firstContent)) return null;

            var ch1Paras = firstContent.Replace("\r\n", "\n").Replace('\r', '\n')
                .Split(new[] { "\n\n" }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var para in ch1Paras)
            {
                var trimmed = para.Trim();
                if (trimmed.Length < 30) continue;
                return trimmed.Length <= maxSummaryLen ? trimmed : trimmed[..maxSummaryLen] + "...";
            }

            return null;
        }

        // Từ khóa nhận diện trường thể loại
        private static readonly string[] GenreFieldKeywords =
            ["thể loại", "the loai", "genre", "genres", "category", "categories", "loại", "loai"];

        /// <summary>
        /// Parse danh sách thể loại từ dòng dạng "Thể loại: Fantasy, Phiêu Lưu" trước Chương 1.
        /// Tách theo dấu phẩy, gạch ngang, dấu chấm phẩy.
        /// </summary>
        private static List<string> ExtractGenreNames(string fullPlainText)
        {
            var preText = ExtractPreChapterText(fullPlainText);
            if (string.IsNullOrWhiteSpace(preText)) return [];

            var lines = preText.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            foreach (var line in lines)
            {
                var colonIdx = line.IndexOf(':');
                if (colonIdx <= 0) continue;

                var key = line[..colonIdx].Trim().ToLowerInvariant();
                if (!GenreFieldKeywords.Any(kw => key.Contains(kw))) continue;

                var value = line[(colonIdx + 1)..].Trim();
                if (string.IsNullOrWhiteSpace(value)) continue;

                return value
                    .Split(new[] { ',', ';', '/', '|' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim())
                    .Where(s => s.Length > 0)
                    .ToList();
            }
            return [];
        }

        /// <summary>
        /// Chuẩn hóa chuỗi để so sánh: chuyển thường, bỏ dấu tiếng Việt, bỏ ký tự đặc biệt.
        /// </summary>
        private static string NormalizeForMatch(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;

            var normalized = input.ToLowerInvariant().Trim();

            // Bỏ dấu tiếng Việt
            normalized = System.Text.RegularExpressions.Regex.Replace(
                normalized.Normalize(System.Text.NormalizationForm.FormD),
                @"\p{Mn}", string.Empty);

            // Bỏ ký tự đặc biệt, chỉ giữ chữ cái và số
            normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"[^a-z0-9\s]", " ");
            normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"\s+", " ").Trim();

            return normalized;
        }

        /// <summary>Lấy toàn bộ văn bản trước tiêu đề "Chương X" đầu tiên.</summary>
        private static string ExtractPreChapterText(string fullText)
        {
            if (string.IsNullOrWhiteSpace(fullText)) return string.Empty;

            var normalized = fullText.Replace("\r\n", "\n").Replace('\r', '\n');
            var chapterHeadingRegex = new System.Text.RegularExpressions.Regex(
                @"(?im)^\s*(chapter|ch(?:u|ư)(?:o|ơ)ng)\s+([0-9ivxlcdm]+)\b",
                System.Text.RegularExpressions.RegexOptions.Compiled);

            var firstMatch = chapterHeadingRegex.Match(normalized);
            if (!firstMatch.Success) return string.Empty;

            return normalized[..firstMatch.Index].Trim();
        }

        private static int CountWords(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            return text.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length;
        }

        /// <summary>
        /// Chuyển plain text (newline-separated) sang HTML tương thích với contenteditable editor.
        /// \n\n → thẻ &lt;p&gt; mới; \n đơn → &lt;br&gt;; ký tự đặc biệt được escape.
        /// </summary>
        private static string PlainTextToHtml(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return "<p></p>";

            // Chuẩn hoá line endings
            var normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');

            // Tách thành đoạn văn theo \n\n
            var paragraphs = normalized.Split(new[] { "\n\n" }, StringSplitOptions.None);

            var sb = new StringBuilder();
            foreach (var para in paragraphs)
            {
                var trimmed = para.Trim('\n');
                if (string.IsNullOrWhiteSpace(trimmed)) continue;

                // Escape HTML entities
                var escaped = trimmed
                    .Replace("&", "&amp;")
                    .Replace("<", "&lt;")
                    .Replace(">", "&gt;");

                // \n đơn trong đoạn → <br>
                escaped = escaped.Replace("\n", "<br>");

                sb.Append($"<p>{escaped}</p>");
            }

            return sb.Length > 0 ? sb.ToString() : "<p></p>";
        }

        // ── Internal DTOs for AI JSON parsing ───────────────────────────────────

        private sealed class AiExtractionResponse
        {
            [JsonPropertyName("summary")]
            public string? Summary { get; set; }

            [JsonPropertyName("characters")]
            public List<AiNamedItem>? Characters { get; set; }

            [JsonPropertyName("settings")]
            public List<AiNamedItem>? Settings { get; set; }

            [JsonPropertyName("timeline")]
            public List<AiTimelineItem>? Timeline { get; set; }
        }

        private sealed class AiNamedItem
        {
            [JsonPropertyName("name")]
            public string? Name { get; set; }

            [JsonPropertyName("description")]
            public string? Description { get; set; }
        }

        private sealed class AiTimelineItem
        {
            [JsonPropertyName("title")]
            public string? Title { get; set; }

            [JsonPropertyName("description")]
            public string? Description { get; set; }
        }
    }
}
