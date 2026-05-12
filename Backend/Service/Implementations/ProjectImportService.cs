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
        private readonly GeminiChatFailoverExecutor _gemini;

        // Giới hạn số chương AI đọc để tránh tốn quá nhiều token
        private const int MaxChaptersForAiScan = 20;
        // Giới hạn ký tự tóm tắt mỗi chương gửi cho AI (tránh overflow context window)
        private const int MaxCharsPerChapterSummary = 3000;

        public ProjectImportService(
            AppDbContext context,
            IConfiguration config,
            ILogger<ProjectImportService> logger,
            IChunkingService chunkingService)
        {
            _context = context;
            _config = config;
            _logger = logger;
            _chunkingService = chunkingService;
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

            int currentChapterNumber = 0;
            foreach (var part in chapterParts)
            {
                currentChapterNumber++;
                var wordCount = CountWords(part.Content);

                var chapter = new Chapter
                {
                    ProjectId = project.Id,
                    ChapterNumber = currentChapterNumber,
                    Title = part.Title ?? $"Chương {currentChapterNumber}",
                    WordCount = wordCount,
                    CurrentVersionNum = 1,
                };
                _context.Chapters.Add(chapter);
                await _context.SaveChangesAsync();

                var version = new ChapterVersion
                {
                    ChapterId = chapter.Id,
                    VersionNumber = 1,
                    Title = "Phiên bản 1",
                    Content = EncryptionHelper.EncryptWithMasterKey(part.Content, rawDek),
                    WordCount = wordCount,
                    TokenCount = _chunkingService.EstimateTokenCount(part.Content),
                    CreatedBy = userId,
                };
                _context.ChapterVersions.Add(version);
                await _context.SaveChangesAsync();

                chapter.CurrentVersionId = version.Id;
                chapter.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

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

                        // Lưu Nhân vật (WorldbuildingEntry - Category: Character)
                        foreach (var character in aiExtracted.Characters ?? new())
                        {
                            if (string.IsNullOrWhiteSpace(character.Name)) continue;
                            _context.WorldbuildingEntries.Add(new WorldbuildingEntry
                            {
                                Id = Guid.NewGuid(),
                                ProjectId = project.Id,
                                Title = EncryptionHelper.EncryptWithMasterKey(character.Name, rawDek),
                                Content = EncryptionHelper.EncryptWithMasterKey(character.Description ?? string.Empty, rawDek),
                                Category = "Character",
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

            return new ProjectImportResult
            {
                ProjectId = project.Id,
                ProjectTitle = projectTitle,
                ChaptersImported = chaptersImported,
                CharactersExtracted = charactersExtracted,
                SettingsExtracted = settingsExtracted,
                TimelineEventsExtracted = timelineEventsExtracted,
                Summary = extractedSummary,
            };
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
