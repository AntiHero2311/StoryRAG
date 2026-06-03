using Pgvector;
using Repository.Entities;
using Service.Helpers;
using Service.DTOs;
using System.Text.Json;

namespace Service.Tests;

public class RagComponentsTests
{
    [Fact]
    public void RubricQueryTemplates_has_fixed_query_for_each_rubric_key()
    {
        var keys = new[]
        {
            "1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "3.1", "3.2", "3.3",
            "4.1", "4.2", "4.3", "5.1", "5.2", "6.1", "6.2", "7.1", "7.2", "8.1", "8.2",
        };
        foreach (var k in keys)
        {
            var q = RubricQueryTemplates.GetRetrievalQuery(k);
            Assert.False(string.IsNullOrWhiteSpace(q));
            Assert.True(q.Length > 10);
        }

        Assert.Equal(20, RubricQueryTemplates.AllKeys.Count);
    }

    [Fact]
    public void RagChunkRanking_orders_by_cosine_closer_first()
    {
        var dim = 8;
        var makeEmb = (float[] v) => new Vector(Pad(v, dim));

        var chunks = new List<ChapterChunk>
        {
            new() { Id = Guid.Parse("00000000-0000-4000-8000-000000000001"), Embedding = makeEmb(new float[] { 1f, 0, 0, 0, 0, 0, 0, 0 }) },
            new() { Id = Guid.Parse("00000000-0000-4000-8000-000000000002"), Embedding = makeEmb(new float[] { 0f, 1f, 0, 0, 0, 0, 0, 0 }) },
            new() { Id = Guid.Parse("00000000-0000-4000-8000-000000000003"), Embedding = makeEmb(new float[] { 0.95f, 0.05f, 0, 0, 0, 0, 0, 0 }) },
        };

        var ord = new Dictionary<Guid, int>
        {
            [chunks[0].Id] = 0,
            [chunks[1].Id] = 1,
            [chunks[2].Id] = 2,
        };

        var query = Pad(new float[] { 1f, 0, 0, 0, 0, 0, 0, 0 }, dim);
        var top = RagChunkRanking.TopKByCosine(chunks, ord, query, k: 2);

        Assert.Equal(2, top.Count);
        Assert.Equal(0, top[0].Ordinal);
        Assert.Equal(2, top[1].Ordinal);
    }

    [Fact]
    public void SafeStringConverter_converts_arrays_and_objects_safely()
    {
        var jsonText = @"{
            ""evidence_array"": [""line 1"", ""line 2""],
            ""evidence_object"": {""key"": ""val""},
            ""evidence_string"": ""normal string"",
            ""evidence_num"": 123
        }";

        var options = new System.Text.Json.JsonSerializerOptions();
        options.Converters.Add(new SafeStringConverter());

        using var doc = System.Text.Json.JsonDocument.Parse(jsonText);
        var root = doc.RootElement;

        var arrayStr = System.Text.Json.JsonSerializer.Deserialize<string>(root.GetProperty("evidence_array").GetRawText(), options);
        var objStr = System.Text.Json.JsonSerializer.Deserialize<string>(root.GetProperty("evidence_object").GetRawText(), options);
        var strStr = System.Text.Json.JsonSerializer.Deserialize<string>(root.GetProperty("evidence_string").GetRawText(), options);
        var numStr = System.Text.Json.JsonSerializer.Deserialize<string>(root.GetProperty("evidence_num").GetRawText(), options);

        Assert.Equal("line 1\nline 2", arrayStr);
        Assert.Equal("{\"key\":\"val\"}", objStr?.Replace(" ", "").Replace("\r", "").Replace("\n", ""));
        Assert.Equal("normal string", strStr);
        Assert.Equal("123", numStr);
    }

    [Fact]
    public void JsonSanitizer_sanitizes_malformed_json_safely()
    {
        var malformedJson = "{\n" +
            "  \"score\": 4.5,\n" +
            "  \"feedback\": \"Nhân vật chính là \\\"Mary Sue\\\" nhưng thoại của cô ta \"rất tệ\".\n" +
            "Tuy nhiên cốt truyện vẫn ổn.\",\n" +
            "  \"comment\": \"Đường dẫn C:\\Users\\admin\\file.txt\",\n" +
            "  \"evidence\": \"Cô ta nói: \\\"Không sao\\\"\"\n" +
            "}";

        var sanitized = JsonSanitizer.Sanitize(malformedJson);

        using var doc = System.Text.Json.JsonDocument.Parse(sanitized);
        var root = doc.RootElement;

        Assert.Equal(4.5m, root.GetProperty("score").GetDecimal());
        Assert.Contains("Nhân vật chính là \"Mary Sue\" nhưng thoại của cô ta \"rất tệ\".", root.GetProperty("feedback").GetString());
        Assert.Contains("Tuy nhiên cốt truyện vẫn ổn.", root.GetProperty("feedback").GetString());
        Assert.Equal("Đường dẫn C:\\Users\\admin\\file.txt", root.GetProperty("comment").GetString());
        Assert.Equal("Cô ta nói: \"Không sao\"", root.GetProperty("evidence").GetString());
    }

    [Fact]
    public void JsonSanitizer_strips_comments_and_ellipsis_and_trailing_commas()
    {
        var malformed = @"{
            // This is a comment
            ""worldSettings"": [
                {
                    ""title"": ""Mỏ kim cương"",
                    ""category"": ""Địa lý"",
                    ""description"": ""Nơi chứa nhiều tài nguyên quý giá."",
                    ""importance"": ""Cung cấp kinh tế cho vương quốc."",
                    ""sourceChapters"": [1, 2, ... ] // trailing comma and ellipsis
                },
                ...
            ],
            ""analysisNote"": ""Trích xuất hoàn tất."" // trailing comment
        }";

        var sanitized = JsonSanitizer.Sanitize(malformed);
        
        using var doc = JsonDocument.Parse(sanitized);
        var root = doc.RootElement;
        
        Assert.Equal("Trích xuất hoàn tất.", root.GetProperty("analysisNote").GetString());
        
        var worldList = root.GetProperty("worldSettings");
        Assert.Equal(1, worldList.GetArrayLength());
        
        var firstWorld = worldList[0];
        Assert.Equal("Mỏ kim cương", firstWorld.GetProperty("title").GetString());
        
        var chapters = firstWorld.GetProperty("sourceChapters");
        Assert.Equal(2, chapters.GetArrayLength());
        Assert.Equal(1, chapters[0].GetInt32());
        Assert.Equal(2, chapters[1].GetInt32());
    }

    [Fact]
    public void SafeListObjectConverter_handles_malformed_items_gracefully()
    {
        var rawJson = @"{
            ""worldSettings"": [
                {
                    ""title"": ""Rừng Sương Mù"",
                    ""category"": ""Địa lý"",
                    ""description"": ""Rừng quanh năm bao phủ sương mù."",
                    ""importance"": ""Nơi trú ẩn của yêu quái."",
                    ""sourceChapters"": [3]
                },
                ""invalid string element"",
                {
                    ""title"": ""Thành Ánh Sáng"",
                    ""category"": ""Xã hội"",
                    ""description"": ""Thành phố thủ phủ."",
                    ""importance"": ""Đầu não chính trị."",
                    ""sourceChapters"": [4]
                },
                ...
            ]
        }";

        var sanitized = JsonSanitizer.Sanitize(rawJson);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var result = JsonSerializer.Deserialize<ContentAnalysisResult>(sanitized, options);

        Assert.NotNull(result);
        Assert.NotNull(result.WorldSettings);
        Assert.Equal(2, result.WorldSettings.Count);
        
        Assert.Equal("Rừng Sương Mù", result.WorldSettings[0].Title);
        Assert.Equal("Thành Ánh Sáng", result.WorldSettings[1].Title);
    }

    [Fact]
    public void SafeIntConverter_deserializes_various_types_safely()
    {
        var jsonText = @"{
            ""firstAppearance"": ""15"",
            ""sortOrder"": 4.2
        }";

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        
        var charItem = JsonSerializer.Deserialize<CharacterItem>(jsonText, options);
        var timelineItem = JsonSerializer.Deserialize<TimelineEventItem>(jsonText, options);

        Assert.NotNull(charItem);
        Assert.Equal(15, charItem.FirstAppearance);

        Assert.NotNull(timelineItem);
        Assert.Equal(4, timelineItem.SortOrder);
    }

    private static float[] Pad(float[] shorter, int dim)
    {
        var a = new float[dim];
        Array.Copy(shorter, a, Math.Min(shorter.Length, dim));
        return a;
    }
}
