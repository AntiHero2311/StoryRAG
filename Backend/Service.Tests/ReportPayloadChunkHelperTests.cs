using Service.DTOs;
using Service.Helpers;

namespace Service.Tests;

public class ReportPayloadChunkHelperTests
{
    private const string TestDek = "0123456789abcdef0123456789abcdef";

    [Fact]
    public void EncryptEmotionPacing_roundtrips_large_segment_data_via_shards()
    {
        var source = new EmotionPacingResult
        {
            OverallPacingProfile = "Nhịp độ cân bằng",
            DominantEmotionProfile = "Neutral",
            Insights = new List<string> { "[Nhịp độ & Tiết tấu] Test insight" },
            CharacterFrequencies = new List<CharacterFrequency>
            {
                new() { CharacterName = "An", TotalMentions = 42 },
            },
            PacingPoints = Enumerable.Range(0, 500).Select(i => new PacingPoint
            {
                SegmentIndex = i,
                ChapterNumber = i / 10 + 1,
                Score = i % 100,
            }).ToList(),
            EmotionPoints = Enumerable.Range(0, 500).Select(i => new EmotionPoint
            {
                SegmentIndex = i,
                ChapterNumber = i / 10 + 1,
                Valence = 0.2,
                Intensity = 50,
                DominantEmotion = "Joy",
            }).ToList(),
            CharacterPresence = Enumerable.Range(0, 6).Select(i => new CharacterPresenceSeries
            {
                CharacterName = $"NV{i}",
                Points = Enumerable.Range(0, 80).Select(j => new CharacterPresencePoint
                {
                    SegmentIndex = j,
                    ChapterNumber = j / 10 + 1,
                    Mentions = j % 3,
                }).ToList(),
            }).ToList(),
        };

        var stored = ReportPayloadChunkHelper.EncryptEmotionPacing(source, TestDek, maxPointsPerShard: 80);
        Assert.StartsWith("{", stored.TrimStart());

        var restored = ReportPayloadChunkHelper.DecryptEmotionPacing(stored, TestDek);
        Assert.NotNull(restored);
        Assert.Equal(500, restored!.PacingPoints.Count);
        Assert.Equal(500, restored.EmotionPoints.Count);
        Assert.Equal(6, restored.CharacterPresence.Count);
        Assert.Equal("An", restored.CharacterFrequencies[0].CharacterName);
    }

    [Fact]
    public void EncryptJsonPayload_supports_legacy_single_cipher_format()
    {
        const string json = """{"hello":"world"}""";
        var stored = ReportPayloadChunkHelper.EncryptJsonPayload(json, TestDek);
        Assert.DoesNotContain("\"parts\"", stored);

        var restored = ReportPayloadChunkHelper.DecryptJsonPayload(stored, TestDek);
        Assert.Equal(json, restored);
    }
}
