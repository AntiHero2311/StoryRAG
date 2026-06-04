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
            string fullManuscriptText,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            if (progressCallback != null)
            {
                await progressCallback(45, "Đang phân tích Story Bible bằng AI (World, Characters, Timeline, Themes)...", cancellationToken);
            }

            if (string.IsNullOrWhiteSpace(fullManuscriptText))
            {
                return (new ContentAnalysisResult { AnalysisNote = "Không có nội dung bản thảo để trích xuất." }, 0);
            }

            var sysPrompt = @"OUTPUT RULE (ABSOLUTE): Respond with ONE valid JSON object only. Start with '{', end with '}'. NO markdown, NO comments, NO text outside JSON.

Bạn là trợ lý AI chuyên nghiệp phân tích cốt truyện, nhân vật và bối cảnh tác phẩm văn học.
Nhiệm vụ của bạn là trích xuất Cẩm nang truyện (Story Bible) súc tích và chính xác từ nội dung bản thảo được cung cấp.

Hãy tuân thủ nghiêm ngặt các yêu cầu về số lượng và chất lượng sau:
- Đối với bối cảnh thế giới (worldSettings): Trích xuất từ 3 đến 6 bối cảnh/luật lệ/địa danh nổi bật nhất. Phần mô tả (description) và tầm quan trọng (importance) nên viết ngắn gọn từ 2 đến 3 câu súc tích nhưng rõ ràng địa lý, cơ chế hoạt động, luật lệ xã hội hoặc quy tắc phép thuật.
- Đối với nhân vật (characters): Trích xuất từ 4 đến 8 nhân vật quan trọng nhất. Phần mô tả (description), tiểu sử (background) và chi tiết mối quan hệ (relationships.description) nên viết ngắn gọn từ 2 đến 3 câu mô tả đầy đủ ngoại hình, tính cách, động cơ hoặc tương tác với nhân vật khác.
- Đối với sự kiện dòng thời gian (timelineEvents): Trích xuất từ 5 đến 10 sự kiện dòng thời gian cốt lõi theo trình tự thời gian. Diễn biến sự kiện (description) và ý nghĩa (importance) nên viết ngắn gọn từ 2 đến 3 câu kể lại trọn vẹn diễn biến và tác động của nó tới mạch truyện.
- Đối với chủ đề (themes): Trích xuất từ 2 đến 4 chủ đề cốt lõi. Phần phân tích chủ đề (description) và dẫn chứng (evidence) nên viết ngắn gọn từ 2 đến 3 câu phân tích sâu sắc thông điệp triết lý và dẫn chứng nghệ thuật trong tác phẩm.

JSON SCHEMA (trả đúng định dạng này, các mảng và số nguyên KHÔNG được có bất kỳ comment nào):
{
  ""worldSettings"": [
    {
      ""title"": ""Tên bối cảnh"",
      ""category"": ""Loại bối cảnh"",
      ""description"": ""Đoạn văn mô tả chi tiết"",
      ""importance"": ""Đoạn văn tầm quan trọng"",
      ""sourceChapters"": [1, 2]
    }
  ],
  ""characters"": [
    {
      ""name"": ""Tên nhân vật"",
      ""role"": ""Vai trò"",
      ""description"": ""Đoạn văn mô tả"",
      ""background"": ""Đoạn văn tiểu sử"",
      ""traits"": [""Tính cách 1"", ""Tính cách 2""],
      ""relationships"": [
        {
          ""targetName"": ""Tên nhân vật mục tiêu"",
          ""type"": ""Kiểu quan hệ"",
          ""description"": ""Đoạn văn chi tiết mối quan hệ""
        }
      ],
      ""firstAppearance"": 1
    }
  ],
  ""timelineEvents"": [
    {
      ""title"": ""Tiêu đề sự kiện nổi bật"",
      ""category"": ""Loại sự kiện"",
      ""timeLabel"": ""Thời điểm xảy ra"",
      ""description"": ""Đoạn văn mô tả chi tiết diễn biến sự kiện"",
      ""importance"": ""Đoạn văn phân tích ý nghĩa sâu sắc"",
      ""sortOrder"": 0
    }
  ],
  ""themes"": [
    {
      ""title"": ""Tên chủ đề chính/thông điệp"",
      ""description"": ""Đoạn văn phân tích sâu sắc"",
      ""evidence"": ""Đoạn văn đưa ra dẫn chứng""
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
                ChatMessage.CreateUserMessage($"Tên tác phẩm: {projectTitle}\n\nToàn bộ nội dung của tác phẩm (đã chia theo chương):\n\n{fullManuscriptText}")
            };

            int tokensUsed = 0;
            ContentAnalysisResult contentResult;

            try
            {
                var response = await CompleteChatWithGeminiAsync(
                    messages,
                    maxTokens: 8000,
                    temperature: 0.2f,
                    jsonMode: true,
                    cancellationToken: cancellationToken);

                tokensUsed = response.Usage?.TotalTokenCount ?? 0;
                var rawText = NormalizeAiText(response.Content.FirstOrDefault()?.Text ?? string.Empty);
                var jsonText = ExtractJsonPayload(rawText);

                // Guard: phải bắt đầu bằng '{'
                if (string.IsNullOrWhiteSpace(jsonText) || !jsonText.TrimStart().StartsWith('{'))
                {
                    _logger.LogWarning("Story Bible: AI không trả về JSON object hợp lệ, tiến hành retry...");

                    var retryMessages = new List<ChatMessage>(messages)
                    {
                        ChatMessage.CreateAssistantMessage(rawText),
                        ChatMessage.CreateUserMessage(
                            "Phản hồi trước không phải JSON object hợp lệ. " +
                            "Hãy trả về DUY NHẤT một JSON object bắt đầu bằng '{' và kết thúc bằng '}', " +
                            "không có bất kỳ văn bản nào trước hoặc sau, không có markdown.")
                    };

                    var retryResponse = await CompleteChatWithGeminiAsync(
                        retryMessages,
                        maxTokens: 8000,
                        temperature: 0.1f,
                        jsonMode: true,
                        cancellationToken: cancellationToken);

                    tokensUsed += retryResponse.Usage?.TotalTokenCount ?? 0;
                    rawText = NormalizeAiText(retryResponse.Content.FirstOrDefault()?.Text ?? string.Empty);
                    jsonText = ExtractJsonPayload(rawText);
                }

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
            List<(string Content, int ChapterNumber, string? ChapterTitle)> decryptedChunks,
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

            foreach (var item in decryptedChunks)
            {
                var chunk = item.Content;
                var chNumber = item.ChapterNumber;
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
                        ChapterNumber = chNumber,
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
                    sampleText.Add($"[Chương {s.ChapterNumber} - Đoạn {s.SegmentIndex}]: {s.Text[..Math.Min(350, s.Text.Length)]}...");
                }

                var pacingStats = $"Nhịp độ TB: {pacingPoints.Average(p => p.Score):F1}, Max: {pacingPoints.Max(p => p.Score):F1}";
                var emotionStats = $"Cảm xúc chủ đạo: {string.Join(", ", emotionPoints.GroupBy(e => e.DominantEmotion).OrderByDescending(g => g.Count()).Take(2).Select(g => g.Key))}";

                var sysPrompt = @"OUTPUT RULE (ABSOLUTE): Respond with ONE valid JSON object only. Start with '{', end with '}'. NO markdown, NO comments, NO text outside JSON.

Bạn là nhà phê bình văn học chuyên nghiệp người Việt. Hãy phân tích nhịp điệu (pacing) và dòng cảm xúc (emotion/sentiment) của tác phẩm văn học được cung cấp.
Nhiệm vụ của bạn là đưa ra đúng 5 nhận xét, đánh giá sâu sắc và chi tiết (mỗi nhận xét là một đoạn văn ngắn gồm 2-4 câu).

PHÂN LOẠI NHẬN XÉT (BẮT BUỘC):
Mỗi nhận xét trong danh sách 'insights' PHẢI bắt đầu bằng một trong các tiền tố phân loại sau (bao gồm cả dấu ngoặc vuông) để phân loại chủ đề:
- `[Nhịp độ & Tiết tấu]`: Phân tích về tốc độ cốt truyện, nhịp điệu hành động, nhịp kể chuyện nhanh/chậm.
- `[Dòng cảm xúc]`: Phân tích về sự biến đổi cảm xúc, bầu không khí, sắc thái tình cảm của các phân đoạn.
- `[Động lực nhân vật]`: Phân tích về tương tác tâm lý, động lực nội tâm hoặc các quan hệ xung đột.
- `[Đề xuất kịch bản]`: Các đề xuất chỉnh sửa thực tế, giải pháp để cải thiện chất lượng nghệ thuật của tác phẩm.

Ví dụ: ""[Nhịp độ & Tiết tấu] Tác phẩm có tốc độ phát triển khá hợp lý...""

YÊU CẦU NỘI DUNG:
1. Đánh giá khách quan, đa chiều (phải có cả nhận xét khen/điểm mạnh và nhận xét chê/điểm yếu/điểm cần cải thiện).
2. Phải chỉ ra các bước ngoặt cốt truyện (plot twists), biến cố hoặc các chi tiết nghệ thuật cụ thể làm nổi bật nhịp điệu nhanh/chậm hoặc sự thay đổi cảm xúc của nhân vật trong tác phẩm.
3. Tuyệt đối không lặp lại các số liệu thống kê thô có sẵn trong prompt một cách máy móc.

JSON SCHEMA (trả đúng định dạng này, không bọc trong markdown, không có comment):
{
  ""insights"": [
    ""[Nhịp độ & Tiết tấu] Nhận xét thứ 1..."",
    ""[Dòng cảm xúc] Nhận xét thứ 2..."",
    ""[Động lực nhân vật] Nhận xét thứ 3..."",
    ""[Đề xuất kịch bản] Nhận xét thứ 4..."",
    ""[Đề xuất kịch bản] Nhận xét thứ 5...""
  ]
}";

                var insightPrompt = $@"DỮ LIỆU ĐỊNH LƯỢNG BIỂU ĐỒ:
- {pacingStats}
- {emotionStats}

NỘI DUNG TÁC PHẨM (MẪU ĐẠI DIỆN):
{string.Join("\n\n", sampleText)}";

                var insightMessages = new List<ChatMessage>
                {
                    ChatMessage.CreateSystemMessage(sysPrompt),
                    ChatMessage.CreateUserMessage(insightPrompt)
                };

                var insightResponse = await CompleteChatWithGeminiAsync(
                    insightMessages,
                    maxTokens: 3000,
                    temperature: 0.3f,
                    jsonMode: true,
                    cancellationToken: cancellationToken);

                tokensUsed = insightResponse.Usage?.TotalTokenCount ?? 0;
                var rawInsights = insightResponse.Content.FirstOrDefault()?.Text ?? "";
                var jsonText = ExtractJsonPayload(rawInsights);

                try
                {
                    using (var doc = JsonDocument.Parse(jsonText))
                    {
                        var list = new List<string>();
                        JsonElement arrayElement = default;
                        bool foundArray = false;

                        if (doc.RootElement.ValueKind == JsonValueKind.Object)
                        {
                            foreach (var prop in doc.RootElement.EnumerateObject())
                            {
                                if (prop.Name.Equals("insights", StringComparison.OrdinalIgnoreCase) && prop.Value.ValueKind == JsonValueKind.Array)
                                {
                                    arrayElement = prop.Value;
                                    foundArray = true;
                                    break;
                                }
                            }

                            if (!foundArray)
                            {
                                foreach (var prop in doc.RootElement.EnumerateObject())
                                {
                                    if (prop.Value.ValueKind == JsonValueKind.Array)
                                    {
                                        arrayElement = prop.Value;
                                        foundArray = true;
                                        break;
                                    }
                                }
                            }
                        }
                        else if (doc.RootElement.ValueKind == JsonValueKind.Array)
                        {
                            arrayElement = doc.RootElement;
                            foundArray = true;
                        }

                        if (foundArray)
                        {
                            foreach (var item in arrayElement.EnumerateArray())
                            {
                                if (item.ValueKind == JsonValueKind.String)
                                {
                                    var val = item.GetString();
                                    if (!string.IsNullOrWhiteSpace(val))
                                    {
                                        list.Add(val);
                                    }
                                }
                            }
                        }

                        if (list.Count > 0)
                        {
                            insights = list.Where(l => !string.IsNullOrWhiteSpace(l) && l.Length > 10).Take(5).ToList();
                        }
                    }
                }
                catch (Exception pEx)
                {
                    _logger.LogWarning(pEx, "Failed to parse pacing insights JSON. Fallback to robust text extraction.");
                }

                if (insights.Count == 0)
                {
                    // Fallback 1: Extract tag patterns like [Tag] Content
                    var matches = Regex.Matches(rawInsights, @"\[([^\]]+)\]\s*([^\n\[]+)");
                    foreach (Match match in matches)
                    {
                        var tag = match.Groups[1].Value.Trim();
                        var content = match.Groups[2].Value.Trim();
                        if (!string.IsNullOrWhiteSpace(content) && content.Length > 10)
                        {
                            insights.Add($"[{tag}] {content}");
                        }
                    }
                    insights = insights.Distinct().Take(5).ToList();
                }

                if (insights.Count == 0)
                {
                    // Fallback 2: Line splitting with heavy syntax cleaning
                    insights = rawInsights.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                                          .Select(l => l.Trim().TrimStart('-', '*', ' ', '•'))
                                          .Select(l => l.Trim('"', '\'', ',', '[', ']', '{', '}'))
                                          .Select(l => l.Trim())
                                          .Where(l => !string.IsNullOrWhiteSpace(l) 
                                                      && l.Length > 10
                                                      && !l.StartsWith("insights", StringComparison.OrdinalIgnoreCase)
                                                      && !l.Contains("insights\":", StringComparison.OrdinalIgnoreCase)
                                                      && !l.Contains("insights\" :", StringComparison.OrdinalIgnoreCase))
                                          .Take(5)
                                          .ToList();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate AI insights for pacing/emotion. Using programmatic fallback.");
            }

            if (insights.Count == 0)
            {
                insights.Add($"Nhịp độ trung bình tác phẩm đạt {pacingPoints.Average(p => p.Score):F1}/100, thể hiện sự phát triển cốt truyện ổn định và nhịp điệu vừa phải.");
                insights.Add($"Trạng thái cảm xúc chủ đạo nổi bật là {string.Join(", ", emotionPoints.GroupBy(e => e.DominantEmotion).OrderByDescending(g => g.Count()).Take(2).Select(g => g.Key))}.");
                insights.Add("Tác phẩm có sự phối hợp tốt giữa các phân cảnh hành động nhanh và khoảng lặng nội tâm.");
                insights.Add("Một số phân đoạn chuyển cảnh cần được làm mượt mà hơn để giữ vững dòng cảm xúc của độc giả.");
                insights.Add("Các bước ngoặt tâm lý nhân vật phát triển tương đối hợp lý nhưng cần tăng thêm tính bất ngờ.");
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

        private sealed class PacingInsightsRaw
        {
            public List<string>? Insights { get; set; }
        }
    }
}
