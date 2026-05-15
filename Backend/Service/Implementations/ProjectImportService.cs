using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
        private readonly INotificationService _notificationService;
        private readonly GeminiChatFailoverExecutor _gemini;

        // Giới hạn số chương AI đọc để tránh tốn quá nhiều token
        private const int MaxChaptersForAiScan = 20;
        // Giới hạn ký tự tóm tắt mỗi chương gửi cho AI (tránh overflow context window)
        private const int MaxCharsPerChapterSummary = 3000;

        public ProjectImportService(
            AppDbContext context,
            IConfiguration config,
            ILogger<ProjectImportService> logger,
            IChunkingService chunkingService,
            INotificationService notificationService)
        {
            _context = context;
            _config = config;
            _logger = logger;
            _chunkingService = chunkingService;
            _notificationService = notificationService;
            _gemini = new GeminiChatFailoverExecutor(
                config,
                logger,
                "Project Import AI Extraction",
                GeminiPrimaryKeyRole.Chat,
                TimeSpan.FromMinutes(5));
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
            var chapterContentSamples = new List<string>(); // Dùng để AI đọc sau
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

                chaptersImported++;

                // Lấy mẫu tối đa MaxChaptersForAiScan chương đầu để AI phân tích
                if (currentChapterNumber <= MaxChaptersForAiScan)
                {
                    var sample = part.Content.Length > MaxCharsPerChapterSummary
                        ? part.Content[..MaxCharsPerChapterSummary]
                        : part.Content;
                    chapterContentSamples.Add($"--- {part.Title ?? $"Chương {currentChapterNumber}"} ---\n{sample}");
                }
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

            // ── Bước 5: AI Trích xuất thông tin ─────────────────────────────────
            int charactersExtracted = 0, settingsExtracted = 0, timelineEventsExtracted = 0;
            string? extractedSummary = null;

            // Kiểm tra subscription token budget (non-fatal nếu không có)
            bool hasTokenBudget = await CheckTokenBudgetAsync(userId);

            if (hasTokenBudget && chapterContentSamples.Count > 0)
            {
                try
                {
                    var combinedContent = string.Join("\n\n", chapterContentSamples);
                    var aiExtracted = await ExtractProjectInfoWithAiAsync(combinedContent, projectTitle);

                    if (aiExtracted != null)
                    {
                        // Cập nhật Project Summary
                        if (!string.IsNullOrWhiteSpace(aiExtracted.Summary))
                        {
                            extractedSummary = aiExtracted.Summary;
                            project.Summary = EncryptionHelper.EncryptWithMasterKey(aiExtracted.Summary, rawDek);
                            await _context.SaveChangesAsync();
                        }

                        // Lưu Nhân vật vào bảng CharacterEntries
                        foreach (var character in aiExtracted.Characters ?? new())
                        {
                            if (string.IsNullOrWhiteSpace(character.Name)) continue;
                            _context.CharacterEntries.Add(new CharacterEntry
                            {
                                Id = Guid.NewGuid(),
                                ProjectId = project.Id,
                                Name = EncryptionHelper.EncryptWithMasterKey(character.Name, rawDek),
                                Role = "Supporting",
                                Description = EncryptionHelper.EncryptWithMasterKey(character.Description ?? string.Empty, rawDek),
                                CreatedAt = DateTime.UtcNow,
                            });
                            charactersExtracted++;
                        }

                        // Lưu Bối cảnh (WorldbuildingEntry - Category: Setting)
                        foreach (var setting in aiExtracted.Settings ?? new())
                        {
                            if (string.IsNullOrWhiteSpace(setting.Name)) continue;
                            _context.WorldbuildingEntries.Add(new WorldbuildingEntry
                            {
                                Id = Guid.NewGuid(),
                                ProjectId = project.Id,
                                Title = EncryptionHelper.EncryptWithMasterKey(setting.Name, rawDek),
                                Content = EncryptionHelper.EncryptWithMasterKey(setting.Description ?? string.Empty, rawDek),
                                Category = "World",
                                CreatedAt = DateTime.UtcNow,
                            });
                            settingsExtracted++;
                        }

                        // Lưu Timeline Events
                        int sortOrder = 0;
                        foreach (var evt in aiExtracted.Timeline ?? new())
                        {
                            if (string.IsNullOrWhiteSpace(evt.Title)) continue;
                            _context.TimelineEvents.Add(new TimelineEvent
                            {
                                ProjectId = project.Id,
                                Title = EncryptionHelper.EncryptWithMasterKey(evt.Title, rawDek),
                                Description = EncryptionHelper.EncryptWithMasterKey(evt.Description ?? string.Empty, rawDek),
                                SortOrder = sortOrder++,
                                Category = "Story",
                                Importance = "Normal",
                                CreatedAt = DateTime.UtcNow,
                            });
                            timelineEventsExtracted++;
                        }

                        await _context.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    // AI extraction là non-fatal: project và chapter đã được tạo xong
                    _logger.LogWarning(ex, "AI extraction failed for project import. Project {ProjectId} still created.", project.Id);
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
                Summary = extractedSummary,
            };

            // ── Bước 6: Gửi notification vào chuông ─────────────────────────────
            try
            {
                var details = new List<string> { $"{chaptersImported} chương" };
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

        // ── Private helpers ──────────────────────────────────────────────────────

        private async Task<bool> CheckTokenBudgetAsync(Guid userId)
        {
            try
            {
                var sub = await _context.UserSubscriptions
                    .Include(s => s.Plan)
                    .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                    .OrderByDescending(s => s.EndDate)
                    .FirstOrDefaultAsync();

                if (sub == null) return false;
                return sub.UsedTokens < sub.Plan.MaxTokenLimit;
            }
            catch
            {
                return false;
            }
        }

        private async Task<AiExtractionResponse?> ExtractProjectInfoWithAiAsync(string combinedContent, string projectTitle)
        {
            var jsonSchema = """
                {
                  "summary": "Tóm tắt cốt truyện tổng thể trong 3-5 câu",
                  "characters": [{"name": "Tên nhân vật", "description": "Mô tả nhân vật"}],
                  "settings": [{"name": "Tên bối cảnh/địa điểm", "description": "Mô tả bối cảnh"}],
                  "timeline": [{"title": "Tên sự kiện", "description": "Mô tả sự kiện"}]
                }
                """;

            var prompt = "Bạn là trợ lý phân tích bản thảo văn học. Dưới đây là nội dung (hoặc một phần) của tác phẩm \"" + projectTitle + "\".\n\n" +
                "Hãy đọc và trả về dữ liệu dưới dạng JSON theo đúng cấu trúc sau (KHÔNG có markdown, KHÔNG có giải thích thêm):\n\n" +
                jsonSchema + "\n\n" +
                "Giới hạn:\n" +
                "- Tối đa 10 nhân vật quan trọng nhất\n" +
                "- Tối đa 5 bối cảnh/địa điểm chính\n" +
                "- Tối đa 8 sự kiện chính theo thứ tự thời gian trong truyện\n\n" +
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
