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

namespace Service.Implementations
{
    public class NarrativeAnalyticsService : INarrativeAnalyticsService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

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

        public NarrativeAnalyticsService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<NarrativeChartsResponse> GetNarrativeChartsAsync(Guid projectId, Guid userId, Guid? chapterId = null)
        {
            await EnsureProjectOwnershipAsync(projectId, userId);
            var rawDek = await GetRawDekAsync(userId);

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

            var pacing = BuildPacingSeries(segments);
            var emotions = BuildEmotionSeries(segments);

            var characterNames = await LoadCharacterNamesAsync(projectId, rawDek);
            var characterPresenceMap = BuildCharacterPresenceMap(segments, characterNames);

            var frequencies = characterPresenceMap
                .Select(kvp => new CharacterFrequency
                {
                    CharacterName = kvp.Key,
                    TotalMentions = kvp.Value.Sum(),
                })
                .Where(x => x.TotalMentions > 0)
                .OrderByDescending(x => x.TotalMentions)
                .Take(12)
                .ToList();

            var trackedCharacters = frequencies.Select(f => f.CharacterName).Take(8).ToList();
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

            var relationships = BuildCharacterRelationships(characterPresenceMap, segments)
                .OrderByDescending(x => x.Weight)
                .Take(30)
                .ToList();

            return new NarrativeChartsResponse
            {
                Pacing = pacing,
                Emotions = emotions,
                CharacterFrequencies = frequencies,
                CharacterPresence = presenceSeries,
                CharacterRelationships = relationships,
            };
        }

        private async Task EnsureProjectOwnershipAsync(Guid projectId, Guid userId)
        {
            var exists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && p.AuthorId == userId && !p.IsDeleted);

            if (!exists)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        private async Task<string> GetRawDekAsync(Guid userId)
        {
            var user = await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("Người dùng không tồn tại.");

            if (string.IsNullOrWhiteSpace(user.DataEncryptionKey))
                throw new Exception("Khóa mã hóa người dùng chưa được thiết lập.");

            var masterKey = _config["Security:MasterKey"]
                ?? throw new Exception("MasterKey không tìm thấy trong cấu hình.");

            return EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey, masterKey);
        }

        private async Task<List<string>> LoadCharacterNamesAsync(Guid projectId, string rawDek)
        {
            var characterEntries = await _context.CharacterEntries
                .Where(c => c.ProjectId == projectId)
                .ToListAsync();

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
                    var wordCount = CountWords(segmentText);
                    if (wordCount <= 0) continue;

                    segments.Add(new TextSegment
                    {
                        SegmentIndex = segmentIndex++,
                        ChapterId = chapter.Id,
                        ChapterNumber = chapter.ChapterNumber,
                        Text = segmentText,
                        WordCount = wordCount,
                        Tokens = Tokenize(segmentText),
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
                var paragraphWords = CountWords(paragraph);
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

        private static List<PacingPoint> BuildPacingSeries(List<TextSegment> segments)
        {
            return segments.Select(segment => new PacingPoint
            {
                SegmentIndex = segment.SegmentIndex,
                ChapterNumber = segment.ChapterNumber,
                Score = Math.Round(CalculatePacingScore(segment), 2),
            }).ToList();
        }

        private static double CalculatePacingScore(TextSegment segment)
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

        private static List<EmotionPoint> BuildEmotionSeries(List<TextSegment> segments)
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

        private static Dictionary<string, int[]> BuildCharacterPresenceMap(List<TextSegment> segments, List<string> characterNames)
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

        private static List<CharacterRelationshipEdge> BuildCharacterRelationships(
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

        private static List<string> Tokenize(string text)
        {
            return Regex.Matches(text.ToLowerInvariant(), @"[\p{L}\p{N}']+")
                .Select(match => NormalizeToken(match.Value))
                .Where(token => !string.IsNullOrWhiteSpace(token))
                .ToList();
        }

        private static string NormalizeToken(string token)
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

        private static int CountWords(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            return text.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length;
        }

        private sealed class ChapterSnapshot
        {
            public Guid Id { get; init; }
            public int ChapterNumber { get; init; }
            public Guid CurrentVersionId { get; init; }
        }

        private sealed class TextSegment
        {
            public int SegmentIndex { get; init; }
            public Guid ChapterId { get; init; }
            public int ChapterNumber { get; init; }
            public string Text { get; init; } = string.Empty;
            public int WordCount { get; init; }
            public List<string> Tokens { get; init; } = new();
        }
    }
}
