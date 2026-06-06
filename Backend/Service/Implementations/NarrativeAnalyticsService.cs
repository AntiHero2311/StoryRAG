using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;

namespace Service.Implementations
{
    /// <summary>
    /// Dịch vụ sinh dữ liệu biểu đồ nhịp độ kể chuyện (pacing) và dòng cảm xúc (emotion) của tác phẩm.
    /// </summary>
    public class NarrativeAnalyticsService : ServiceBase, INarrativeAnalyticsService
    {
        private readonly ILogger<NarrativeAnalyticsService> _logger;
        private readonly GeminiChatFailoverExecutor _geminiChatExecutor;

        private static readonly HashSet<string> ActionLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            "chay", "lao", "danh", "chem", "ban", "dam", "tancong", "tron", "giat", "keo",
            "doi", "ruotduoi", "dap", "nhay", "xong", "pha", "tancong", "pha", "vat"
        };

        private static readonly HashSet<string> PositiveLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            "vui", "hanhphuc", "hyvong", "yeu", "amap", "anui", "tuhao", "camkich", "thanhcong", "binhyen", "cuoi", "anlong"
        };

        private static readonly HashSet<string> NegativeLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            "buon", "dau", "codon", "sohai", "tuyetvong", "gian", "thuongton", "batan", "loau", "hoangloan", "metmoi", "thatvong"
        };

        private static readonly Dictionary<string, HashSet<string>> EmotionLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Joy"] = new HashSet<string>(new[] { "vui", "hanhphuc", "cuoi", "hoanhi", "hyvong", "yeu" }, StringComparer.OrdinalIgnoreCase),
            ["Sadness"] = new HashSet<string>(new[] { "buon", "codon", "tuyetvong", "thatvong", "suysup" }, StringComparer.OrdinalIgnoreCase),
            ["Anger"] = new HashSet<string>(new[] { "gian", "phan", "thinhno", "caycu", "noian" }, StringComparer.OrdinalIgnoreCase),
            ["Fear"] = new HashSet<string>(new[] { "so", "sohai", "hoangloan", "runray", "batan", "loau" }, StringComparer.OrdinalIgnoreCase),
        };

        public NarrativeAnalyticsService(AppDbContext context, IConfiguration config, ILogger<NarrativeAnalyticsService> logger)
            : base(context, config)
        {
            _logger = logger;
            _geminiChatExecutor = new GeminiChatFailoverExecutor(
                config,
                logger,
                "Gemini Narrative Insights",
                GeminiPrimaryKeyRole.Analyze, // Use analyze role for analysis
                TimeSpan.FromMinutes(2));
        }

        public async Task<NarrativeChartsResponse> GetNarrativeChartsAsync(Guid projectId, Guid userId, Guid? chapterId = null)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null || project.IsDeleted)
                throw new KeyNotFoundException("Dự án không tồn tại.");

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new KeyNotFoundException("User không tồn tại.");

            var isStaffOrAdmin = user.Role == "Staff" || user.Role == "Admin";
            if (!isStaffOrAdmin && project.AuthorId != userId)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");

            var author = await _context.Users.FindAsync(project.AuthorId);
            if (author == null)
                throw new KeyNotFoundException("Không tìm thấy tác giả của dự án.");

            var rawDek = EncryptionHelper.DecryptWithMasterKey(author.DataEncryptionKey!, _config["Security:MasterKey"]!);

            var chaptersQuery = _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted && c.CurrentVersionId.HasValue)
                .OrderBy(c => c.ChapterNumber)
                .Select(c => new ChapterSnapshot
                {
                    Id = c.Id,
                    ChapterNumber = c.ChapterNumber,
                    CurrentVersionId = c.CurrentVersionId!.Value,
                });

            if (chapterId.HasValue)
                chaptersQuery = chaptersQuery.Where(c => c.Id == chapterId.Value);

            var chapters = await chaptersQuery.ToListAsync();
            if (chapters.Count == 0)
                return new NarrativeChartsResponse();

            var versionIds = chapters.Select(c => c.CurrentVersionId).ToList();
            var versions = await _context.ChapterVersions
                .Where(v => versionIds.Contains(v.Id))
                .ToDictionaryAsync(v => v.Id);

            var segments = BuildSegments(chapters, versions, rawDek);
            if (segments.Count == 0)
                return new NarrativeChartsResponse();

            var pacing = NarrativeAnalyticsHelper.BuildPacingSeries(segments);
            var emotions = NarrativeAnalyticsHelper.BuildEmotionSeries(segments);

            var characterNames = await NarrativeAnalyticsHelper.LoadCharacterNamesAsync(_context, projectId, rawDek);
            var characterPresenceMap = NarrativeAnalyticsHelper.BuildCharacterPresenceMap(segments, characterNames);

            var frequencies = characterPresenceMap
                .Select(kvp => new CharacterFrequency
                {
                    CharacterName = kvp.Key,
                    TotalMentions = kvp.Value.Sum(),
                })
                .Where(x => x.TotalMentions > 0)
                .OrderByDescending(x => x.TotalMentions)
                .Take(24)
                .ToList();

            var trackedCharacters = frequencies.Select(f => f.CharacterName).Take(15).ToList();
            var presenceSeries = trackedCharacters
                .Select(name => new CharacterPresenceSeries
                {
                    CharacterName = name,
                    Points = segments.Select(segment => new CharacterPresencePoint
                    {
                        SegmentIndex = segment.SegmentIndex,
                        ChapterNumber = segment.ChapterNumber,
                        Mentions = characterPresenceMap.TryGetValue(name, out var values) ? values[segment.SegmentIndex] : 0,
                    }).ToList()
                })
                .ToList();

            var relationships = NarrativeAnalyticsHelper.BuildCharacterRelationships(characterPresenceMap, segments)
                .OrderByDescending(x => x.Weight)
                .Take(60)
                .ToList();

            // Generate insights & annotations
            var insights = new List<string>();

            // Add Deep AI Insights (with character discovery)
            try 
            {
                var bibleContext = await GetBibleContextAsync(projectId, rawDek);
                var discoveredCharacters = await NarrativeAnalyticsHelper.DiscoverCharactersAsync(_geminiChatExecutor, segments, default);
                
                // Merge discovered characters into our tracking list
                var allCharacterNames = characterNames.Union(discoveredCharacters, StringComparer.OrdinalIgnoreCase).ToList();
                
                // Re-build map with merged names for better charts
                var fullPresenceMap = NarrativeAnalyticsHelper.BuildCharacterPresenceMap(segments, allCharacterNames);
                var fullFrequencies = fullPresenceMap
                    .Select(kvp => new CharacterFrequency
                    {
                        CharacterName = kvp.Key,
                        TotalMentions = kvp.Value.Sum(),
                    })
                    .Where(x => x.TotalMentions > 0)
                    .OrderByDescending(x => x.TotalMentions)
                    .Take(24)
                    .ToList();

                // Update charts with discovered data if they found more relevant characters
                if (fullFrequencies.Count > frequencies.Count || discoveredCharacters.Any(d => !characterNames.Contains(d, StringComparer.OrdinalIgnoreCase)))
                {
                    frequencies = fullFrequencies;
                    trackedCharacters = frequencies.Select(f => f.CharacterName).Take(15).ToList();
                    presenceSeries = trackedCharacters
                        .Select(name => new CharacterPresenceSeries
                        {
                            CharacterName = name,
                            Points = segments.Select(segment => new CharacterPresencePoint
                            {
                                SegmentIndex = segment.SegmentIndex,
                                ChapterNumber = segment.ChapterNumber,
                                Mentions = fullPresenceMap.TryGetValue(name, out var values) ? values[segment.SegmentIndex] : 0,
                            }).ToList()
                        })
                        .ToList();
                    
                    relationships = NarrativeAnalyticsHelper.BuildCharacterRelationships(fullPresenceMap, segments)
                        .OrderByDescending(x => x.Weight)
                        .Take(60)
                        .ToList();
                }

                var aiInsights = await GenerateDeepAiInsightsAsync(segments, pacing, emotions, trackedCharacters, bibleContext);
                if (aiInsights.Count > 0)
                {
                    insights.Insert(0, "✨ PHÂN TÍCH CHUYÊN SÂU TỪ AI:");
                    insights.AddRange(aiInsights);
                }
            }
            catch (InvalidOperationException ioex) when (ioex.Message.Contains("content filter", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Phân tích AI cho dự án {ProjectId} bị chặn bởi content filter. Hiển thị biểu đồ cơ bản mà không có insights.", projectId);
                insights.Add("⚠️ Phân tích chuyên sâu tạm thời không khả dụng do hạn chế nội dung.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate Deep AI Insights for project {ProjectId}", projectId);
                insights.Add("⚠️ Phân tích chuyên sâu tạm thời không khả dụng.");
            }

            NarrativeAnalyticsHelper.AnnotatePacingPoints(pacing, insights);
            NarrativeAnalyticsHelper.AnnotateEmotionPoints(emotions, insights);
            NarrativeAnalyticsHelper.GenerateCharacterInsights(frequencies, relationships, insights);

            return new NarrativeChartsResponse
            {
                Pacing = pacing,
                Emotions = emotions,
                CharacterFrequencies = frequencies,
                CharacterPresence = presenceSeries,
                CharacterRelationships = relationships,
                Insights = insights,
                SegmentTexts = segments.Select(s => s.Text).ToList(),
            };
        }

        private async Task<string> GetBibleContextAsync(Guid projectId, string rawDek)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return "";

            var latestReport = await _context.ProjectReports
                .Where(r => r.ProjectId == projectId && r.Status == "Completed")
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            List<ReportCharacterEntry> characters = new();
            if (latestReport != null)
            {
                characters = await _context.ReportCharacterEntries
                    .Where(c => c.ProjectReportId == latestReport.Id)
                    .ToListAsync();
            }

            var sb = new StringBuilder();
            sb.AppendLine("CẨM NANG TRUYỆN (STORY BIBLE):");
            foreach (var ch in characters)
            {
                var name = EncryptionHelper.DecryptWithMasterKey(ch.Name, rawDek);
                var desc = EncryptionHelper.DecryptWithMasterKey(ch.Description, rawDek);
                sb.AppendLine($"- Nhân vật {name}: {desc}");
            }
            return sb.ToString();
        }

        private async Task<List<string>> DiscoverCharactersAsync(List<TextSegment> segments)
        {
            if (segments.Count == 0) return new List<string>();
            
            var sampleSize = Math.Min(segments.Count, 40);
            var textToScan = new StringBuilder();
            for (int i = 0; i < sampleSize; i++)
            {
                var idx = i * segments.Count / sampleSize;
                textToScan.AppendLine(segments[idx].Text[..Math.Min(500, segments[idx].Text.Length)]);
            }

            var prompt = $@"Dưới đây là các đoạn văn mẫu từ truyện. Hãy liệt kê tất cả tên riêng của các NHÂN VẬT xuất hiện trong văn bản này.
Chỉ liệt kê tên, cách nhau bởi dấu phẩy. Không thêm bất kỳ lời giải thích nào.

VĂN BẢN MẪU:
{textToScan}";

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage("Bạn là trợ lý trích xuất thực thể. Chỉ trả về danh sách tên nhân vật, ngăn cách bởi dấu phẩy. Ví dụ: Dế Mèn, Dế Choắt, Chị Cốc"),
                ChatMessage.CreateUserMessage(prompt)
            };

            try
            {
                var response = await _geminiChatExecutor.CompleteAsync(messages, new ChatCompletionOptions { MaxOutputTokenCount = 200, Temperature = 0.1f });
                var text = response.Content.FirstOrDefault()?.Text ?? "";
                return text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            }
            catch
            {
                return new List<string>();
            }
        }

        private async Task<List<string>> GenerateDeepAiInsightsAsync(
            List<TextSegment> segments, 
            List<PacingPoint> pacing, 
            List<EmotionPoint> emotions, 
            List<string> characters,
            string bibleContext)
        {
            if (segments.Count == 0) return new List<string>();

            // Take sample content from segments (beginning, middle, end)
            var sampleSize = Math.Min(segments.Count, 30);
            var samples = new List<string>();
            for (int i = 0; i < sampleSize; i++)
            {
                var idx = i * segments.Count / sampleSize;
                var s = segments[idx];
                samples.Add($"[Chương {s.ChapterNumber}, Đoạn {s.SegmentIndex}]: {s.Text[..Math.Min(450, s.Text.Length)]}...");
            }

            var pacingStats = $"Nhịp độ TB: {pacing.Average(p => p.Score):F1}, Max: {pacing.Max(p => p.Score):F1} (Chương {pacing.OrderByDescending(p => p.Score).First().ChapterNumber})";
            var emotionStats = $"Cảm xúc chủ đạo: {string.Join(", ", emotions.GroupBy(e => e.DominantEmotion).OrderByDescending(g => g.Count()).Take(2).Select(g => g.Key))}";

            var prompt = $@"
Bạn là một chuyên gia phê bình văn học lỗi lạc với ngòi bút sắc sảo. Dựa trên dữ liệu thống kê biểu đồ của câu chuyện, Cẩm nang truyện (Story Bible) và các đoạn trích mẫu, hãy thực hiện một bài phân tích sâu sắc, toàn diện và có cấu trúc rõ ràng về tác phẩm này.

DỮ LIỆU THỐNG KÊ BIỂU ĐỒ:
- {pacingStats}
- {emotionStats}
- Danh sách nhân vật chính được theo dõi: {string.Join(", ", characters)}

DỮ LIỆU CẨM NANG TRUYỆN (STORY BIBLE):
{bibleContext}

CÁC ĐOẠN TRÍCH MẪU TỪ TÁC PHẨM:
{string.Join("\n\n", samples)}

YÊU CẦU PHÂN TÍCH VÀ CẤU TRÚC ĐẦU RA:
Bạn phải viết chính xác 4 đoạn nhận định phân tích độc lập. Mỗi đoạn bắt đầu BẮT BUỘC bằng tiền tố (tag) tương ứng, KHÔNG thêm số thứ tự hay ký hiệu gạch đầu dòng phía trước. Ví dụ: `[Nhịp độ & Tiết tấu] Nhận xét của bạn...`. Tuyệt đối không tự ý thay đổi tên tiền tố.

1. Bắt đầu bằng tiền tố `[Nhịp độ & Tiết tấu]`: Phân tích sâu sắc về cách phân bổ nhịp điệu cốt truyện, đánh giá nhịp điệu nhanh/chậm có hợp lý không, các cao trào hành động hay khoảng lặng tâm lý có được sắp xếp hiệu quả không. Phải trích dẫn cụ thể 1 câu văn mẫu làm dẫn chứng.
2. Bắt đầu bằng tiền tố `[Dòng cảm xúc]`: Phân tích mạch sắc thái cảm xúc tổng thể (valence) và cường độ biến thiên cảm xúc. Đánh giá bầu không khí u tối hay tươi sáng của truyện, tâm lý cảm xúc của nhân vật có đồng điệu với bối cảnh hay không. Phải trích dẫn cụ thể 1 câu văn mẫu làm dẫn chứng.
3. Bắt đầu bằng tiền tố `[Động lực nhân vật]`: Nhận định về mật độ xuất hiện và tầm ảnh hưởng của các nhân vật chính được theo dõi lên mạch truyện, đánh giá các tương tác hoặc mối quan hệ giữa các nhân vật có tự nhiên và sâu sắc hay không. Phải trích dẫn cụ thể 1 câu văn mẫu làm dẫn chứng.
4. Bắt đầu bằng tiền tố `[Đề xuất kịch bản]`: Đưa ra ít nhất 2 đến 3 lời khuyên mang tính chiến lược và cụ thể dành cho tác giả để cải thiện tác phẩm (ví dụ: cần kéo giãn nhịp độ hay thêm đối thoại ở chương nào, nhân vật nào cần làm đậm nét quan hệ hay bộc lộ chiều sâu nội tâm hơn).

QUY TẮC BẮT BUỘC:
- NGÔN NGỮ: Chỉ sử dụng Tiếng Việt trong sáng, hành văn trôi chảy, mang tính chuyên môn văn học cao và truyền cảm hứng.
- KHÔNG lặp lại một cách máy móc các con số thống kê thô có sẵn trong prompt.
- KHÔNG giải thích quy trình phân tích hay thêm các lời chào hỏi, lời dẫn, kết luận thừa thãi. Hãy đi thẳng vào đoạn nhận định đầu tiên.
- BẮT BUỘC phải trích dẫn (quote) nguyên văn câu từ truyện trong ngoặc kép ở mỗi đoạn phân tích để minh chứng thực tế.
";

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage("Bạn là chuyên gia phê bình văn học người Việt. NHIỆM VỤ: Phân tích cốt truyện và nhân vật. QUY TẮC: 1. Chỉ dùng Tiếng Việt. 2. Không lặp lại dữ liệu đầu vào. 3. Không lặp lại hướng dẫn hệ thống. 4. Không meta-talk (như 'Tôi đã hiểu', 'Đây là kết quả'). 5. Trả về kết quả phân tích thuần túy."),
                ChatMessage.CreateUserMessage(prompt)
            };

            var response = await _geminiChatExecutor.CompleteAsync(messages, new ChatCompletionOptions { MaxOutputTokenCount = 1500, Temperature = 0.3f });
            var text = response.Content.FirstOrDefault()?.Text ?? "";
            
            // Clean up any remaining tags or intro/outro fluff
            text = Regex.Replace(text, @"^.*?(?=(\[|1\.|-|\*|•))", "", RegexOptions.Singleline); 
            
            var forbiddenLabels = new[] { 
                "Story Content:", "Only final answer", "No repetition", "No tags", 
                "Professional language", "Format:", "Language:", "Crucial:", "Focus:", 
                "Plot Arc:", "Character Dynamics:", "Dữ liệu biểu đồ", "Pace Analysis",
                "Emotion Analysis", "System Instructions" 
            };

            return text.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                       .Select(l => l.Trim().TrimStart('-', '*', ' ', '•'))
                       .Where(l => !string.IsNullOrWhiteSpace(l) 
                                   && !l.Contains("Bạn nhận được") 
                                   && !l.Contains("HƯỚNG DẪN HỆ THỐNG")
                                   && !forbiddenLabels.Any(label => l.StartsWith(label, StringComparison.OrdinalIgnoreCase))
                                   && !l.Contains("Pace:")
                                   && !l.Contains("Emotions:")
                                   && !l.Contains("Dominant:")
                                   && !l.Contains("Tracked Characters"))
                       .ToList();
        }


        private async Task<List<string>> LoadCharacterNamesAsync(Guid projectId, string rawDek)
        {
            var latestReport = await _context.ProjectReports
                .Where(r => r.ProjectId == projectId && r.Status == "Completed")
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            List<ReportCharacterEntry> characterEntries = new();
            if (latestReport != null)
            {
                characterEntries = await _context.ReportCharacterEntries
                    .Where(c => c.ProjectReportId == latestReport.Id)
                    .ToListAsync();
            }

            return characterEntries
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Name, rawDek).Trim())
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static List<TextSegment> BuildSegments(
            List<ChapterSnapshot> chapters,
            IReadOnlyDictionary<Guid, ChapterVersion> versions,
            string rawDek)
        {
            var segments = new List<TextSegment>();
            var segmentIndex = 0;

            foreach (var chapter in chapters)
            {
                if (!versions.TryGetValue(chapter.CurrentVersionId, out var version))
                    continue;

                var plainText = EncryptionHelper.DecryptWithMasterKey(version.Content, rawDek).Trim();
                if (string.IsNullOrWhiteSpace(plainText))
                    continue;

                foreach (var segmentText in SplitTextIntoSegments(plainText, 220))
                {
                    var wordCount = NarrativeAnalyticsHelper.CountWords(segmentText);
                    if (wordCount <= 0) continue;

                    segments.Add(new TextSegment
                    {
                        SegmentIndex = segmentIndex++,
                        ChapterId = chapter.Id,
                        ChapterNumber = chapter.ChapterNumber,
                        Text = segmentText,
                        WordCount = wordCount,
                        Tokens = NarrativeAnalyticsHelper.Tokenize(segmentText),
                    });
                }
            }

            return segments;
        }

        private static IEnumerable<string> SplitTextIntoSegments(string text, int targetWords)
        {
            var normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');
            var paragraphs = Regex.Split(normalized, @"\n{2,}")
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();

            if (paragraphs.Count == 0)
            {
                yield return normalized.Trim();
                yield break;
            }

            var builder = new StringBuilder();
            var currentWords = 0;

            foreach (var paragraph in paragraphs)
            {
                var paragraphWords = NarrativeAnalyticsHelper.CountWords(paragraph);
                if (builder.Length > 0)
                    builder.Append("\n\n");
                builder.Append(paragraph);
                currentWords += paragraphWords;

                if (currentWords < targetWords) continue;

                yield return builder.ToString().Trim();
                builder.Clear();
                currentWords = 0;
            }

            if (builder.Length > 0)
                yield return builder.ToString().Trim();
        }

        private sealed class ChapterSnapshot
        {
            public Guid Id { get; init; }
            public int ChapterNumber { get; init; }
            public Guid CurrentVersionId { get; init; }
        }
    }
}
