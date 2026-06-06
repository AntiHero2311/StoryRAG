using System.Text.Json;
using System.Text.Json.Serialization;
using Service.DTOs;

namespace Service.Helpers
{
    /// <summary>
    /// Chia payload JSON lớn thành nhiều phần nhỏ để mã hóa/lưu DB — tránh kẹt bước lưu (85%+).
    /// Định dạng mới: wrapper JSON plaintext {"v":1,"type":"...","parts":["cipher1","cipher2",...]}.
    /// Định dạng cũ: một chuỗi ciphertext duy nhất (tương thích ngược).
    /// </summary>
    public static class ReportPayloadChunkHelper
    {
        private const int DefaultMaxPointsPerShard = 120;
        private const int DefaultMaxPresenceSeriesPerShard = 3;
        private const int DefaultMaxPlainJsonCharsPerChunk = 160_000;

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

        public static string EncryptEmotionPacing(EmotionPacingResult data, string dek, int maxPointsPerShard = DefaultMaxPointsPerShard)
        {
            var shards = BuildEmotionPacingShards(data, maxPointsPerShard);
            return WrapEncryptedShards("emotion_pacing", shards.Select(s => JsonSerializer.Serialize(s, JsonOpts)), dek);
        }

        public static EmotionPacingResult? DecryptEmotionPacing(string? stored, string dek)
        {
            if (string.IsNullOrWhiteSpace(stored)) return null;

            if (!TryParseChunkedWrapper(stored, dek, out var shardJsonParts))
            {
                var legacy = EncryptionHelper.DecryptWithMasterKey(stored, dek);
                return TryDeserialize<EmotionPacingResult>(legacy);
            }

            var shards = new List<EmotionPacingShard>();
            foreach (var part in shardJsonParts)
            {
                var shard = TryDeserialize<EmotionPacingShard>(part);
                if (shard != null) shards.Add(shard);
            }

            return MergeEmotionPacingShards(shards);
        }

        public static string EncryptJsonPayload(string json, string dek, int maxPlainCharsPerChunk = DefaultMaxPlainJsonCharsPerChunk)
        {
            if (string.IsNullOrEmpty(json))
                return WrapEncryptedShards("json", Array.Empty<string>(), dek);

            if (json.Length <= maxPlainCharsPerChunk)
                return EncryptionHelper.EncryptWithMasterKey(json, dek);

            var parts = new List<string>();
            for (var i = 0; i < json.Length; i += maxPlainCharsPerChunk)
            {
                var len = Math.Min(maxPlainCharsPerChunk, json.Length - i);
                parts.Add(json.Substring(i, len));
            }

            return WrapEncryptedShards("json", parts, dek);
        }

        public static string? DecryptJsonPayload(string? stored, string dek)
        {
            if (string.IsNullOrWhiteSpace(stored)) return null;

            if (!TryParseChunkedWrapper(stored, dek, out var parts))
                return EncryptionHelper.DecryptWithMasterKey(stored, dek);

            return string.Concat(parts);
        }

        private static List<EmotionPacingShard> BuildEmotionPacingShards(EmotionPacingResult data, int maxPointsPerShard)
        {
            var shards = new List<EmotionPacingShard>
            {
                new()
                {
                    Kind = "meta",
                    CharacterFrequencies = data.CharacterFrequencies,
                    CharacterRelationships = data.CharacterRelationships,
                    Insights = data.Insights,
                    OverallPacingProfile = data.OverallPacingProfile,
                    DominantEmotionProfile = data.DominantEmotionProfile,
                },
            };

            foreach (var batch in data.PacingPoints.Chunk(maxPointsPerShard))
            {
                shards.Add(new EmotionPacingShard
                {
                    Kind = "pacing",
                    PacingPoints = batch.ToList(),
                });
            }

            foreach (var batch in data.EmotionPoints.Chunk(maxPointsPerShard))
            {
                shards.Add(new EmotionPacingShard
                {
                    Kind = "emotion",
                    EmotionPoints = batch.ToList(),
                });
            }

            foreach (var batch in data.CharacterPresence.Chunk(DefaultMaxPresenceSeriesPerShard))
            {
                shards.Add(new EmotionPacingShard
                {
                    Kind = "presence",
                    CharacterPresence = batch.ToList(),
                });
            }

            return shards;
        }

        private static EmotionPacingResult MergeEmotionPacingShards(IReadOnlyList<EmotionPacingShard> shards)
        {
            var result = new EmotionPacingResult();
            foreach (var shard in shards)
            {
                switch (shard.Kind)
                {
                    case "meta":
                        result.CharacterFrequencies = shard.CharacterFrequencies ?? result.CharacterFrequencies;
                        result.CharacterRelationships = shard.CharacterRelationships ?? result.CharacterRelationships;
                        result.Insights = shard.Insights ?? result.Insights;
                        result.OverallPacingProfile = string.IsNullOrWhiteSpace(shard.OverallPacingProfile)
                            ? result.OverallPacingProfile
                            : shard.OverallPacingProfile;
                        result.DominantEmotionProfile = string.IsNullOrWhiteSpace(shard.DominantEmotionProfile)
                            ? result.DominantEmotionProfile
                            : shard.DominantEmotionProfile;
                        break;
                    case "pacing":
                        if (shard.PacingPoints != null)
                            result.PacingPoints.AddRange(shard.PacingPoints);
                        break;
                    case "emotion":
                        if (shard.EmotionPoints != null)
                            result.EmotionPoints.AddRange(shard.EmotionPoints);
                        break;
                    case "presence":
                        if (shard.CharacterPresence != null)
                            result.CharacterPresence.AddRange(shard.CharacterPresence);
                        break;
                }
            }

            result.PacingPoints = result.PacingPoints
                .OrderBy(p => p.ChapterNumber)
                .ThenBy(p => p.SegmentIndex)
                .ToList();
            result.EmotionPoints = result.EmotionPoints
                .OrderBy(p => p.ChapterNumber)
                .ThenBy(p => p.SegmentIndex)
                .ToList();

            return result;
        }

        private static string WrapEncryptedShards(string type, IEnumerable<string> plainParts, string dek)
        {
            var encrypted = plainParts
                .Select(p => EncryptionHelper.EncryptWithMasterKey(p, dek))
                .ToList();

            if (encrypted.Count <= 1 && type != "emotion_pacing")
            {
                return encrypted.Count == 1 ? encrypted[0] : string.Empty;
            }

            var wrapper = new ChunkedPayloadWrapper
            {
                Version = 1,
                Type = type,
                Parts = encrypted,
            };

            return JsonSerializer.Serialize(wrapper, JsonOpts);
        }

        private static bool TryParseChunkedWrapper(string stored, string dek, out List<string> plainParts)
        {
            plainParts = new List<string>();
            var trimmed = stored.TrimStart();
            if (!trimmed.StartsWith('{'))
                return false;

            ChunkedPayloadWrapper? wrapper;
            try
            {
                wrapper = JsonSerializer.Deserialize<ChunkedPayloadWrapper>(stored, JsonOpts);
            }
            catch
            {
                return false;
            }

            if (wrapper?.Parts == null || wrapper.Parts.Count == 0)
                return false;

            foreach (var cipher in wrapper.Parts)
            {
                if (string.IsNullOrWhiteSpace(cipher)) continue;
                plainParts.Add(EncryptionHelper.DecryptWithMasterKey(cipher, dek));
            }

            return plainParts.Count > 0;
        }

        private static T? TryDeserialize<T>(string json)
        {
            try
            {
                return JsonSerializer.Deserialize<T>(json, JsonOpts);
            }
            catch
            {
                return default;
            }
        }

        private sealed class ChunkedPayloadWrapper
        {
            public int Version { get; set; }
            public string Type { get; set; } = string.Empty;
            public List<string> Parts { get; set; } = new();
        }

        private sealed class EmotionPacingShard
        {
            public string Kind { get; set; } = string.Empty;
            public List<PacingPoint>? PacingPoints { get; set; }
            public List<EmotionPoint>? EmotionPoints { get; set; }
            public List<CharacterPresenceSeries>? CharacterPresence { get; set; }
            public List<CharacterFrequency>? CharacterFrequencies { get; set; }
            public List<CharacterRelationshipEdge>? CharacterRelationships { get; set; }
            public List<string>? Insights { get; set; }
            public string? OverallPacingProfile { get; set; }
            public string? DominantEmotionProfile { get; set; }
        }
    }
}
