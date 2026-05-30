using Microsoft.EntityFrameworkCore;
using OpenAI.Chat;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text;
using System.Globalization;
using Microsoft.Extensions.Logging;

namespace Service.Implementations
{
    public partial class ProjectReportService
    {
        private static readonly HashSet<string> ActionLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            "chay", "lao", "danh", "chem", "ban", "dam", "tancong", "tron", "giat", "keo",
            "doi", "ruotduoi", "dap", "nhay", "xong", "pha", "vat"
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

        private async Task<(ContentAnalysisResult Content, int TokensUsed)> ExtractStoryBibleAsync(
            string projectTitle,
            List<string> decryptedChunks,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            if (progressCallback != null)
            {
                await progressCallback(45, "Đang phân tích Story Bible bằng AI (World, Characters, Timeline, Themes)...", cancellationToken);
            }

            if (decryptedChunks == null || decryptedChunks.Count == 0)
            {
                return (new ContentAnalysisResult { AnalysisNote = "Không có nội dung bản thảo để trích xuất." }, 0);
            }

            // Đưa toàn bộ các đoạn bản thảo của tác phẩm vào phân tích để đảm bảo trích xuất trọn vẹn và đầy đủ nhất, tránh bỏ sót.
            var sampledChunks = decryptedChunks;

            var sysPrompt = @"Bạn là trợ lý AI chuyên nghiệp phân tích cốt truyện, nhân vật và bối cảnh tác phẩm văn học.
Nhiệm vụ của bạn là trích xuất Cẩm nang truyện (Story Bible) cực kỳ chi tiết, phong phú và chuyên sâu từ nội dung bản thảo được cung cấp.

MỖI THÀNH PHẦN TRÍCH XUẤT CẦN CÓ MỘT NỘI DUNG RẤT CHI TIẾT VÀ ĐẦY ĐỦ. Hãy tuân thủ nghiêm ngặt các yêu cầu về số lượng và chất lượng sau:
- Đối với bối cảnh thế giới (worldSettings): Trích xuất TỐI THIỂU từ 5 đến 8 bối cảnh/luật lệ/địa danh nổi bật nhất. Phần mô tả (description) và tầm quan trọng (importance) PHẢI là những đoạn văn phân tích chi tiết, sâu sắc (tối thiểu từ 3 đến 5 câu dài trở lên), mô tả rõ ràng địa lý, cơ chế hoạt động, luật lệ xã hội hoặc quy tắc phép thuật, chứ không viết tóm tắt ngắn gọn.
- Đối với nhân vật (characters): Trích xuất TOÀN BỘ các nhân vật có tên (TỐI THIỂU từ 5 đến 10 nhân vật quan trọng nhất nếu có). Phần mô tả (description), tiểu sử (background) và chi tiết mối quan hệ (relationships.description) PHẢI là những đoạn văn dài, đầy đủ (tối thiểu từ 3 đến 5 câu dài trở lên), phân tích sâu sắc ngoại hình, tính cách, động cơ sâu xa, các biến cố cuộc đời và tương tác tâm lý tinh tế với các nhân vật khác.
- Đối với sự kiện dòng thời gian (timelineEvents): Trích xuất TỐI THIỂU từ 8 đến 15 sự kiện dòng thời gian cốt lõi theo đúng trình tự thời gian xảy ra. Diễn biến sự kiện (description) và ý nghĩa (importance) PHẢI là những đoạn văn chi tiết (tối thiểu từ 3 đến 5 câu dài trở lên), kể lại trọn vẹn diễn biến sự việc, nguyên nhân kết quả và tác động của nó tới mạch truyện.
- Đối với chủ đề (themes): Trích xuất TỐI THIỂU từ 3 đến 5 chủ đề cốt lõi. Phần phân tích chủ đề (description) và dẫn chứng (evidence) PHẢI đạt độ dài tối thiểu từ 3 đến 5 câu dài trở lên, đi sâu mổ xẻ thông điệp triết học, tư tưởng cốt lõi của tác phẩm, và cách tác giả lồng ghép nó qua các chi tiết nghệ thuật cụ thể.

Hãy trả về kết quả dưới dạng JSON duy nhất khớp HOÀN TOÀN với cấu trúc C# sau (không bọc trong thẻ markdown ```json):
{
  ""worldSettings"": [
    {
      ""title"": ""Tên bối cảnh/Địa danh/Luật lệ bối cảnh"",
      ""category"": ""Thể loại bối cảnh (Ví dụ: Địa lý, Phép thuật, Xã hội, Lịch sử, v.v.)"",
      ""description"": ""Đoạn văn mô tả chi tiết, sâu sắc bối cảnh (tối thiểu từ 3-5 câu dài trở lên)"",
      ""importance"": ""Đoạn văn phân tích kỹ lưỡng tầm quan trọng đối với cốt truyện (tối thiểu từ 3-5 câu dài)"",
      ""sourceChapters"": [] // Danh sách số chương trích dẫn bối cảnh này (nếu có, số nguyên)
    }
  ],
  ""characters"": [
    {
      ""name"": ""Tên nhân vật (Viết hoa)"",
      ""role"": ""Vai trò (Ví dụ: Nhân vật chính, Nhân vật phản diện, Đồng hành, Phụ, v.v.)"",
      ""description"": ""Đoạn văn mô tả rất chi tiết ngoại hình, tâm lý, tính cách, động cơ chính (tối thiểu từ 3-5 câu dài)"",
      ""background"": ""Đoạn văn phân tích sâu sắc tiểu sử/Thân thế/Lịch sử phát triển của nhân vật (tối thiểu từ 3-5 câu dài)"",
      ""traits"": [""Tính cách 1"", ""Tính cách 2""], // Mảng chuỗi các nét tính cách/đặc điểm nổi bật
      ""relationships"": [
        {
          ""targetName"": ""Tên nhân vật mục tiêu"",
          ""type"": ""Kiểu quan hệ (Ví dụ: Bạn bè, Kẻ thù, Gia đình, Tình yêu, Đồng nghiệp, v.v.)"",
          ""description"": ""Đoạn văn chi tiết phân tích mối quan hệ và sự ảnh hưởng lẫn nhau giữa hai người (tối thiểu từ 3-5 câu dài)""
        }
      ],
      ""firstAppearance"": 1 // Số chương xuất hiện lần đầu (số nguyên)
    }
  ],
  ""timelineEvents"": [
    {
      ""title"": ""Tiêu đề sự kiện nổi bật"",
      ""category"": ""Loại sự kiện (Ví dụ: Khởi đầu, Mâu thuẫn, Cao trào, Bước ngoặt, Kết thúc)"",
      ""timeLabel"": ""Thời điểm xảy ra (Ví dụ: Chương 1, Ngày hôm sau, Năm 2026, v.v.)"",
      ""description"": ""Đoạn văn mô tả chi tiết diễn biến sự kiện đầy đủ nguyên nhân hệ quả (tối thiểu từ 3-5 câu dài)"",
      ""importance"": ""Đoạn văn phân tích ý nghĩa sâu sắc của sự kiện này đối với mạch truyện (tối thiểu từ 3-5 câu dài)"",
      ""sortOrder"": 0 // Thứ tự sắp xếp tăng dần theo thời gian (0, 1, 2, ...)
    }
  ],
  ""themes"": [
    {
      ""title"": ""Tên chủ đề chính/thông điệp (Ví dụ: Sự hy sinh, Tình bạn, Lòng tham, Sự chuộc tội, v.v.)"",
      ""description"": ""Đoạn văn phân tích sâu sắc cách chủ đề này được thể hiện trong tác phẩm (tối thiểu từ 3-5 câu dài)"",
      ""evidence"": ""Đoạn văn đưa ra dẫn chứng, chi tiết cụ thể từ truyện thể hiện chủ đề này (tối thiểu từ 3-5 câu dài)""
    }
  ],
  ""analysisNote"": ""Ghi chú tóm tắt chung về cẩm nang truyện (1-2 câu).""
}

QUY TẮC QUAN TRỌNG:
1. Đảm bảo ngôn ngữ đầu ra hoàn toàn bằng TIẾNG VIỆT.
2. Trích xuất thông tin khách quan, chính xác dựa trên nội dung tác phẩm. Không tự bịa đặt thông tin không có trong văn bản.
3. Không thêm bất kỳ văn bản giải thích nào ngoài JSON. Không dùng thẻ markdown ```json...``` nếu có thể, hoặc đảm bảo chỉ trả về JSON hợp lệ.";

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage(sysPrompt),
                ChatMessage.CreateUserMessage($"Tên tác phẩm: {projectTitle}\n\nToàn bộ nội dung của tác phẩm:\n\n{string.Join("\n\n---\n\n", sampledChunks)}")
            };

            int tokensUsed = 0;
            ContentAnalysisResult contentResult;

            try
            {
                var response = await CompleteChatWithGeminiAsync(
                    messages,
                    maxTokens: 8000,
                    temperature: 0.2f,
                    cancellationToken: cancellationToken);

                tokensUsed = response.Usage?.TotalTokenCount ?? 0;
                var rawText = NormalizeAiText(response.Content.FirstOrDefault()?.Text ?? string.Empty);
                var jsonText = ExtractJsonPayload(rawText);

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                contentResult = JsonSerializer.Deserialize<ContentAnalysisResult>(jsonText, options) ?? new ContentAnalysisResult();
                if (string.IsNullOrWhiteSpace(contentResult.AnalysisNote))
                {
                    contentResult.AnalysisNote = "Dữ liệu được trích xuất tự động bằng AI từ nội dung bản thảo.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi trích xuất Story Bible cho dự án {Title}", projectTitle);
                contentResult = new ContentAnalysisResult
                {
                    AnalysisNote = "Không thể trích xuất tự động Cẩm nang truyện do lỗi xử lý AI: " + ex.Message
                };
            }

            return (contentResult, tokensUsed);
        }

        private async Task<(EmotionPacingResult Pacing, int TokensUsed)> AnalyzeEmotionPacingAsync(
            string projectTitle,
            List<string> decryptedChunks,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            if (progressCallback != null)
            {
                await progressCallback(50, "Đang phân tích định lượng nhịp độ và cảm xúc...", cancellationToken);
            }

            if (decryptedChunks == null || decryptedChunks.Count == 0)
            {
                return (new EmotionPacingResult(), 0);
            }

            // 1. Local segment splitting (similar to NarrativeAnalyticsService)
            var segments = new List<TextSegmentLocal>();
            var segmentIndex = 0;

            foreach (var chunk in decryptedChunks)
            {
                if (string.IsNullOrWhiteSpace(chunk)) continue;

                foreach (var segmentText in SplitTextIntoSegmentsLocal(chunk, 220))
                {
                    var words = segmentText.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                    var wordCount = words.Length;
                    if (wordCount <= 0) continue;

                    var tokens = words.Select(w => NormalizeTokenLocal(w))
                                      .Where(t => !string.IsNullOrWhiteSpace(t))
                                      .ToList();

                    segments.Add(new TextSegmentLocal
                    {
                        SegmentIndex = segmentIndex++,
                        ChapterNumber = 1 + (segmentIndex / 10), // Approximated chapter ordering
                        Text = segmentText,
                        WordCount = wordCount,
                        Tokens = tokens
                    });
                }
            }

            if (segments.Count == 0)
            {
                return (new EmotionPacingResult(), 0);
            }

            // 2. Programmatic score calculation
            var pacingPoints = new List<PacingPoint>();
            var emotionPoints = new List<EmotionPoint>();

            foreach (var segment in segments)
            {
                // Pacing Calculation
                var words = Math.Max(1, segment.WordCount);
                var actionHits = segment.Tokens.Count(token => ActionLexicon.Contains(token));
                var actionDensity = actionHits * 100.0 / words;

                var strongPunctuation = Regex.Matches(segment.Text, @"[!?]").Count;
                var punctuationDensity = strongPunctuation * 100.0 / words;

                var sentenceCount = Math.Max(1, Regex.Matches(segment.Text, @"[.!?]").Count);
                var avgSentenceLength = words / (double)sentenceCount;

                var dialogueMarkers = Regex.Matches(segment.Text, "[\"“”«»]").Count;
                var dialogueRatio = dialogueMarkers / (double)Math.Max(1, segment.Text.Length);

                var pacingScore = 35
                            + actionDensity * 4.5
                            + punctuationDensity * 2.8
                            + dialogueRatio * 120
                            - avgSentenceLength * 0.9;

                pacingScore = Math.Clamp(pacingScore, 0, 100);

                pacingPoints.Add(new PacingPoint
                {
                    SegmentIndex = segment.SegmentIndex,
                    ChapterNumber = segment.ChapterNumber,
                    Score = Math.Round(pacingScore, 2)
                });

                // Sentiment/Emotion Calculation
                var positive = 0;
                var negative = 0;
                var emotionBuckets = EmotionLexicon.Keys.ToDictionary(key => key, _ => 0, StringComparer.OrdinalIgnoreCase);

                foreach (var token in segment.Tokens)
                {
                    if (PositiveLexicon.Contains(token)) positive++;
                    if (NegativeLexicon.Contains(token)) negative++;

                    foreach (var (emotion, lexicon) in EmotionLexicon)
                    {
                        if (lexicon.Contains(token))
                            emotionBuckets[emotion]++;
                    }
                }

                var sentimentMass = positive + negative;
                var valence = sentimentMass == 0 ? 0 : (positive - negative) / (double)sentimentMass;
                valence = Math.Clamp(valence, -1, 1);

                var intensity = sentimentMass * 100.0 / words * 10.0;
                intensity = Math.Clamp(intensity, 0, 100);

                var dominant = emotionBuckets
                    .OrderByDescending(x => x.Value)
                    .FirstOrDefault();

                emotionPoints.Add(new EmotionPoint
                {
                    SegmentIndex = segment.SegmentIndex,
                    ChapterNumber = segment.ChapterNumber,
                    Valence = Math.Round(valence, 3),
                    Intensity = Math.Round(intensity, 2),
                    DominantEmotion = dominant.Value > 0 ? dominant.Key : "Neutral"
                });
            }

            // Set Peak and Trough labels for Pacing
            var maxPacing = pacingPoints.OrderByDescending(p => p.Score).First();
            var minPacing = pacingPoints.OrderBy(p => p.Score).First();
            maxPacing.Label = "Cao nhất";
            minPacing.Label = "Thấp nhất";

            // Set peak/trough labels for Emotion
            var maxEmotion = emotionPoints.OrderByDescending(e => e.Valence).First();
            var minEmotion = emotionPoints.OrderBy(e => e.Valence).First();
            if (maxEmotion.Valence > 0.1) maxEmotion.Label = "Tích cực nhất";
            if (minEmotion.Valence < -0.1 && minEmotion != maxEmotion) minEmotion.Label = "Căng thẳng/U buồn nhất";

            // 3. Generate literary insights via Gemini (sampling 25 segments)
            var insights = new List<string>();
            int tokensUsed = 0;

            try
            {
                var sampleSize = Math.Min(segments.Count, 25);
                var sampleText = new List<string>();
                for (int i = 0; i < sampleSize; i++)
                {
                    var idx = i * segments.Count / sampleSize;
                    var s = segments[idx];
                    sampleText.Add($"[Đoạn {s.SegmentIndex}]: {s.Text[..Math.Min(350, s.Text.Length)]}...");
                }

                var pacingStats = $"Nhịp độ TB: {pacingPoints.Average(p => p.Score):F1}, Max: {pacingPoints.Max(p => p.Score):F1}";
                var emotionStats = $"Cảm xúc chủ đạo: {string.Join(", ", emotionPoints.GroupBy(e => e.DominantEmotion).OrderByDescending(g => g.Count()).Take(2).Select(g => g.Key))}";

                var insightPrompt = $@"Bạn là nhà phê bình văn học chuyên nghiệp người Việt. Hãy phân tích nhịp điệu và dòng cảm xúc của tác phẩm.

DỮ LIỆU ĐỊNH LƯỢNG BIỂU ĐỒ:
- {pacingStats}
- {emotionStats}

NỘI DUNG TÁC PHẨM (MẪU ĐẠI DIỆN):
{string.Join("\n\n", sampleText)}

Nhiệm vụ: Hãy đưa ra đúng 3 nhận xét sâu sắc (mỗi nhận xét là 1 dòng) về diễn biến nhịp độ và cảm sắc thái của tác phẩm.
QUY TẮC BẮT BUỘC:
1. Đảm bảo ngôn ngữ đầu ra hoàn toàn bằng TIẾNG VIỆT.
2. TUYỆT ĐỐI KHÔNG lặp lại bất kỳ con số thống kê thô nào đã có trong prompt.
3. Không thêm các nhãn meta-talk hoặc tiêu đề.
4. Trả về đúng 3 dòng nhận xét tương ứng với 3 ý phân tích văn học.";

                var insightMessages = new List<ChatMessage>
                {
                    ChatMessage.CreateSystemMessage("Bạn là chuyên gia phê bình văn học người Việt. Chỉ trả về 3 dòng nhận xét."),
                    ChatMessage.CreateUserMessage(insightPrompt)
                };

                var insightResponse = await CompleteChatWithGeminiAsync(
                    insightMessages,
                    maxTokens: 1000,
                    temperature: 0.3f,
                    cancellationToken: cancellationToken);

                tokensUsed = insightResponse.Usage?.TotalTokenCount ?? 0;
                var rawInsights = insightResponse.Content.FirstOrDefault()?.Text ?? "";

                insights = rawInsights.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                                      .Select(l => l.Trim().TrimStart('-', '*', ' ', '•'))
                                      .Where(l => !string.IsNullOrWhiteSpace(l) && l.Length > 10)
                                      .Take(3)
                                      .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate AI insights for pacing/emotion. Using programmatic fallback.");
            }

            if (insights.Count == 0)
            {
                insights.Add($"Nhịp độ trung bình tác phẩm đạt {pacingPoints.Average(p => p.Score):F1}/100, thể hiện sự phát triển cốt truyện ổn định.");
                insights.Add($"Trạng thái cảm xúc chủ đạo nổi bật là {string.Join(", ", emotionPoints.GroupBy(e => e.DominantEmotion).OrderByDescending(g => g.Count()).Take(2).Select(g => g.Key))}.");
            }

            var result = new EmotionPacingResult
            {
                PacingPoints = pacingPoints,
                EmotionPoints = emotionPoints,
                Insights = insights,
                OverallPacingProfile = pacingPoints.Average(p => p.Score) > 55 ? "Nhịp độ nhanh" : "Nhịp độ cân bằng",
                DominantEmotionProfile = emotionPoints.GroupBy(e => e.DominantEmotion).OrderByDescending(g => g.Count()).First().Key
            };

            return (result, tokensUsed);
        }

        private static List<string> SplitTextIntoSegmentsLocal(string text, int targetWords)
        {
            var normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');
            var paragraphs = normalized.Split(new[] { "\n\n" }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();

            if (paragraphs.Count == 0)
            {
                return new List<string> { normalized.Trim() };
            }

            var result = new List<string>();
            var builder = new StringBuilder();
            var currentWords = 0;

            foreach (var paragraph in paragraphs)
            {
                var paragraphWords = paragraph.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length;
                if (builder.Length > 0)
                    builder.Append("\n\n");
                builder.Append(paragraph);
                currentWords += paragraphWords;

                if (currentWords >= targetWords)
                {
                    result.Add(builder.ToString().Trim());
                    builder.Clear();
                    currentWords = 0;
                }
            }

            if (builder.Length > 0)
                result.Add(builder.ToString().Trim());

            return result;
        }

        private static string NormalizeTokenLocal(string token)
        {
            var decomposed = token.Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(decomposed.Length);

            foreach (var character in decomposed)
            {
                var category = CharUnicodeInfo.GetUnicodeCategory(character);
                if (category == UnicodeCategory.NonSpacingMark) continue;
                if (char.IsLetterOrDigit(character) || character == '\'')
                    builder.Append(char.ToLowerInvariant(character));
            }

            return builder.ToString().Normalize(NormalizationForm.FormC);
        }

        private sealed class TextSegmentLocal
        {
            public int SegmentIndex { get; init; }
            public int ChapterNumber { get; init; }
            public string Text { get; init; } = string.Empty;
            public int WordCount { get; init; }
            public List<string> Tokens { get; init; } = new();
        }
    }
}
