using Microsoft.EntityFrameworkCore;
using OpenAI.Chat;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Service.Helpers
{
    public static class NarrativeAnalyticsHelper
    {
        public static readonly HashSet<string> ActionLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            "chay", "lao", "danh", "chem", "ban", "dam", "tancong", "tron", "giat", "keo",
            "doi", "ruotduoi", "dap", "nhay", "xong", "pha", "tancong", "pha", "vat"
        };

        public static readonly HashSet<string> PositiveLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            "vui", "hanhphuc", "hyvong", "yeu", "amap", "anui", "tuhao", "camkich", "thanhcong", "binhyen", "cuoi", "anlong"
        };

        public static readonly HashSet<string> NegativeLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            "buon", "dau", "codon", "sohai", "tuyetvong", "gian", "thuongton", "batan", "loau", "hoangloan", "metmoi", "thatvong"
        };

        public static readonly Dictionary<string, HashSet<string>> EmotionLexicon = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Joy"] = new HashSet<string>(new[] { "vui", "hanhphuc", "cuoi", "hoanhi", "hyvong", "yeu" }, StringComparer.OrdinalIgnoreCase),
            ["Sadness"] = new HashSet<string>(new[] { "buon", "codon", "tuyetvong", "thatvong", "suysup" }, StringComparer.OrdinalIgnoreCase),
            ["Anger"] = new HashSet<string>(new[] { "gian", "phan", "thinhno", "caycu", "noian" }, StringComparer.OrdinalIgnoreCase),
            ["Fear"] = new HashSet<string>(new[] { "so", "sohai", "hoangloan", "runray", "batan", "loau" }, StringComparer.OrdinalIgnoreCase),
        };

        public static async Task<List<string>> LoadCharacterNamesAsync(AppDbContext context, Guid projectId, string rawDek)
        {
            var latestReport = await context.ProjectReports
                .Where(r => r.ProjectId == projectId && r.Status == "Completed")
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            List<ReportCharacterEntry> characterEntries = new();
            if (latestReport != null)
            {
                characterEntries = await context.ReportCharacterEntries
                    .Where(c => c.ProjectReportId == latestReport.Id)
                    .ToListAsync();
            }

            return characterEntries
                .Select(c => EncryptionHelper.DecryptWithMasterKey(c.Name, rawDek).Trim())
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public static async Task<List<string>> DiscoverCharactersAsync(
            GeminiChatFailoverExecutor executor,
            List<TextSegment> segments,
            CancellationToken cancellationToken)
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
                var response = await executor.CompleteAsync(messages, new ChatCompletionOptions { MaxOutputTokenCount = 200, Temperature = 0.1f }, cancellationToken);
                var text = response.Content.FirstOrDefault()?.Text ?? "";
                return text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            }
            catch
            {
                return new List<string>();
            }
        }

        public static Dictionary<string, int[]> BuildCharacterPresenceMap(List<TextSegment> segments, List<string> characterNames)
        {
            var result = new Dictionary<string, int[]>(StringComparer.OrdinalIgnoreCase);
            if (characterNames.Count == 0) return result;

            var dedupedNames = characterNames
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var matchers = dedupedNames.Select(name => new
            {
                Name = name,
                Pattern = new Regex(
                    $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(name)}(?![\p{{L}}\p{{N}}])",
                    RegexOptions.IgnoreCase | RegexOptions.Compiled),
            }).ToList();

            foreach (var matcher in matchers)
                result[matcher.Name] = new int[segments.Count];

            for (var segmentIndex = 0; segmentIndex < segments.Count; segmentIndex++)
            {
                var segmentText = segments[segmentIndex].Text;

                foreach (var matcher in matchers)
                {
                    var mentions = matcher.Pattern.Matches(segmentText).Count;
                    if (mentions <= 0) continue;
                    result[matcher.Name][segmentIndex] = mentions;
                }
            }

            return result;
        }

        public static List<CharacterRelationshipEdge> BuildCharacterRelationships(
            IReadOnlyDictionary<string, int[]> presenceMap,
            List<TextSegment> segments)
        {
            var edges = new Dictionary<(string A, string B), int>();
            if (presenceMap.Count < 2 || segments.Count == 0) return new List<CharacterRelationshipEdge>();

            var names = presenceMap.Keys.ToList();

            for (var segmentIndex = 0; segmentIndex < segments.Count; segmentIndex++)
            {
                var activeCharacters = names
                    .Where(name => presenceMap[name][segmentIndex] > 0)
                    .ToList();

                if (activeCharacters.Count < 2) continue;

                for (var i = 0; i < activeCharacters.Count; i++)
                {
                    for (var j = i + 1; j < activeCharacters.Count; j++)
                    {
                        var left = activeCharacters[i];
                        var right = activeCharacters[j];

                        var pair = string.Compare(left, right, StringComparison.OrdinalIgnoreCase) <= 0
                            ? (left, right)
                            : (right, left);

                        var coOccurWeight = Math.Min(presenceMap[left][segmentIndex], presenceMap[right][segmentIndex]);
                        if (coOccurWeight <= 0) coOccurWeight = 1;

                        edges[pair] = edges.TryGetValue(pair, out var weight)
                            ? weight + coOccurWeight
                            : coOccurWeight;
                    }
                }
            }

            return edges.Select(x => new CharacterRelationshipEdge
            {
                SourceCharacter = x.Key.A,
                TargetCharacter = x.Key.B,
                Weight = x.Value,
            }).ToList();
        }

        public static double CalculatePacingScore(TextSegment segment)
        {
            var words = Math.Max(1, segment.WordCount);
            var actionHits = segment.Tokens.Count(token => ActionLexicon.Contains(token));
            var actionDensity = actionHits * 100.0 / words;

            var strongPunctuation = Regex.Matches(segment.Text, @"[!?]").Count;
            var punctuationDensity = strongPunctuation * 100.0 / words;

            var sentenceCount = Math.Max(1, Regex.Matches(segment.Text, @"[.!?]").Count);
            var avgSentenceLength = words / (double)sentenceCount;

            var dialogueMarkers = Regex.Matches(segment.Text, "[\"“”«»]").Count;
            var dialogueRatio = dialogueMarkers / (double)Math.Max(1, segment.Text.Length);

            var score = 35
                        + actionDensity * 4.5
                        + punctuationDensity * 2.8
                        + dialogueRatio * 120
                        - avgSentenceLength * 0.9;

            return Math.Clamp(score, 0, 100);
        }

        public static List<PacingPoint> BuildPacingSeries(List<TextSegment> segments)
        {
            return segments.Select(segment => new PacingPoint
            {
                SegmentIndex = segment.SegmentIndex,
                ChapterNumber = segment.ChapterNumber,
                Score = Math.Round(CalculatePacingScore(segment), 2),
            }).ToList();
        }

        public static List<EmotionPoint> BuildEmotionSeries(List<TextSegment> segments)
        {
            var emotionPoints = new List<EmotionPoint>(segments.Count);

            foreach (var segment in segments)
            {
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
                var valence = sentimentMass == 0
                    ? 0
                    : (positive - negative) / (double)sentimentMass;
                valence = Math.Clamp(valence, -1, 1);

                var intensity = sentimentMass * 100.0 / Math.Max(1, segment.WordCount) * 10.0;
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
                    DominantEmotion = dominant.Value > 0 ? dominant.Key : "Neutral",
                });
            }

            return emotionPoints;
        }

        public static void AnnotatePacingPoints(List<PacingPoint> points, List<string> insights)
        {
            if (points.Count < 3) return;

            var maxPoint = points.OrderByDescending(p => p.Score).First();
            var minPoint = points.OrderBy(p => p.Score).First();

            maxPoint.Label = $"Cao nhất: {maxPoint.Score:F0}";
            minPoint.Label = $"Thấp nhất: {minPoint.Score:F0}";

            var avgScore = points.Average(p => p.Score);
            insights.Add($"Nhịp độ: Nhịp độ trung bình {avgScore:F1}/100. Đỉnh cao nhất tại chương {maxPoint.ChapterNumber} (segment {maxPoint.SegmentIndex}, score {maxPoint.Score:F0}), thấp nhất tại chương {minPoint.ChapterNumber} (segment {minPoint.SegmentIndex}, score {minPoint.Score:F0}).");

            var highCount = points.Count(p => p.Score > 65);
            var lowCount = points.Count(p => p.Score < 35);
            if (highCount > lowCount * 2)
                insights.Add("Nhịp độ nghiêng về nhanh/action liên tục — có thể cần thêm đoạn nghỉ để người đọc 'thở'.");
            else if (lowCount > highCount * 2)
                insights.Add("Nhịp độ nghiêng về chậm/nội tâm — có thể cần thêm cảnh hành động để tăng kịch tính.");
        }

        public static void AnnotateEmotionPoints(List<EmotionPoint> points, List<string> insights)
        {
            if (points.Count < 3) return;

            var mostPositive = points.OrderByDescending(p => p.Valence).FirstOrDefault();
            var mostNegative = points.OrderBy(p => p.Valence).FirstOrDefault();

            if (mostPositive != null && mostPositive.Valence > 0.1)
                mostPositive.Label = mostPositive.DominantEmotion == "Joy" ? "Cao trào tươi sáng" : "Cảm xúc tích cực";

            if (mostNegative != null && mostNegative.Valence < -0.1 && mostNegative != mostPositive)
                mostNegative.Label = mostNegative.DominantEmotion == "Fear" || mostNegative.DominantEmotion == "Sadness"
                    ? "Căng thẳng/U buồn nhất"
                    : "Cảm xúc tiêu cực";

            var emotionCounts = points
                .Where(p => p.DominantEmotion != "Neutral")
                .GroupBy(p => p.DominantEmotion)
                .OrderByDescending(g => g.Count())
                .Take(3)
                .Select(g => $"{g.Key} ({g.Count()} đoạn)")
                .ToList();

            if (emotionCounts.Count > 0)
                insights.Add($"Cảm xúc chủ đạo: {string.Join(", ", emotionCounts)}.");

            var avgValence = points.Average(p => p.Valence);
            var tone = avgValence > 0.2 ? "tích cực" : avgValence < -0.2 ? "tiêu cực" : "trung tính";
            insights.Add($"Tone cảm xúc tổng thể: {tone} (valence trung bình: {avgValence:F2}).");
        }

        public static void GenerateCharacterInsights(
            List<CharacterFrequency> frequencies,
            List<CharacterRelationshipEdge> relationships,
            List<string> insights)
        {
            if (frequencies.Count == 0) return;

            var topN = Math.Min(frequencies.Count, 5);
            var topList = frequencies.Take(topN).Select(f => $"{f.CharacterName} ({f.TotalMentions} lần)").ToList();
            insights.Add($"Nhân vật xuất hiện nhiều nhất: {string.Join(", ", topList)}.");

            if (frequencies.Count >= 2)
            {
                var ratio = (double)frequencies[0].TotalMentions / Math.Max(1, frequencies[1].TotalMentions);
                if (ratio > 3)
                    insights.Add($"Nhân vật {frequencies[0].CharacterName} áp đảo về lượng xuất hiện (gấp {ratio:F1}x nhân vật thứ 2). Các nhân vật phụ có thể cần phát triển thêm.");
            }

            if (relationships.Count > 0)
            {
                var topRel = relationships[0];
                insights.Add($"Mối quan hệ mạnh nhất: {topRel.SourceCharacter} ↔ {topRel.TargetCharacter} (đồng xuất hiện {topRel.Weight} lần).");
            }
        }

        public static List<string> Tokenize(string text)
        {
            return Regex.Matches(text.ToLowerInvariant(), @"[\p{L}\p{N}']+")
                .Select(match => NormalizeToken(match.Value))
                .Where(token => !string.IsNullOrWhiteSpace(token))
                .ToList();
        }

        public static string NormalizeToken(string token)
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

        public static int CountWords(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            return text.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length;
        }

        /// <summary>
        /// Thu gọn dữ liệu biểu đồ trước khi lưu DB — gộp theo chương để tránh JSON/emotion payload quá lớn làm kẹt bước lưu (85%).
        /// Chi tiết theo segment vẫn lấy qua API narrative charts khi cần.
        /// </summary>
        public static EmotionPacingResult CompactEmotionPacingForStorage(EmotionPacingResult source, int maxSegmentPoints = 350)
        {
            var segmentCount = Math.Max(source.PacingPoints.Count, source.EmotionPoints.Count);
            var maxPresencePoints = source.CharacterPresence.Count == 0
                ? 0
                : source.CharacterPresence.Max(s => s.Points.Count);

            if (segmentCount <= maxSegmentPoints && maxPresencePoints <= maxSegmentPoints)
                return source;

            return AggregateEmotionPacingToChapters(source);
        }

        private static EmotionPacingResult AggregateEmotionPacingToChapters(EmotionPacingResult source)
        {
            var pacingByChapter = source.PacingPoints
                .GroupBy(p => p.ChapterNumber)
                .OrderBy(g => g.Key)
                .Select(g => new PacingPoint
                {
                    SegmentIndex = g.Key,
                    ChapterNumber = g.Key,
                    Score = g.Average(x => x.Score),
                    Label = g.Select(x => x.Label).FirstOrDefault(l => !string.IsNullOrWhiteSpace(l)),
                })
                .ToList();

            var emotionByChapter = source.EmotionPoints
                .GroupBy(e => e.ChapterNumber)
                .OrderBy(g => g.Key)
                .Select(g => new EmotionPoint
                {
                    SegmentIndex = g.Key,
                    ChapterNumber = g.Key,
                    Valence = g.Average(x => x.Valence),
                    Intensity = g.Average(x => x.Intensity),
                    DominantEmotion = g.GroupBy(x => x.DominantEmotion)
                        .OrderByDescending(x => x.Count())
                        .First().Key,
                    Label = g.Select(x => x.Label).FirstOrDefault(l => !string.IsNullOrWhiteSpace(l)),
                })
                .ToList();

            var presence = source.CharacterPresence
                .Select(s => new CharacterPresenceSeries
                {
                    CharacterName = s.CharacterName,
                    Points = s.Points
                        .GroupBy(p => p.ChapterNumber)
                        .OrderBy(g => g.Key)
                        .Select(g => new CharacterPresencePoint
                        {
                            SegmentIndex = g.Key,
                            ChapterNumber = g.Key,
                            Mentions = g.Sum(p => p.Mentions),
                        })
                        .ToList(),
                })
                .ToList();

            return new EmotionPacingResult
            {
                PacingPoints = pacingByChapter,
                EmotionPoints = emotionByChapter,
                CharacterFrequencies = source.CharacterFrequencies,
                CharacterPresence = presence,
                CharacterRelationships = source.CharacterRelationships,
                Insights = source.Insights,
                OverallPacingProfile = source.OverallPacingProfile,
                DominantEmotionProfile = source.DominantEmotionProfile,
            };
        }
    }
}
