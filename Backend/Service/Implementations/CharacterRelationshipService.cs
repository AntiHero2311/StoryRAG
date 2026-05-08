using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Text.Json;

namespace Service.Implementations
{
    public class CharacterRelationshipService : ICharacterRelationshipService
    {
        private static readonly string[] AllowedRelationTypes =
        [
            "family", "friend", "rival", "romantic", "mentor", "colleague", "unknown"
        ];

        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<CharacterRelationshipService> _logger;
        private readonly GeminiChatFailoverExecutor _gemini;

        public CharacterRelationshipService(
            AppDbContext db,
            IConfiguration config,
            ILogger<CharacterRelationshipService> logger)
        {
            _db = db;
            _config = config;
            _logger = logger;
            _gemini = new GeminiChatFailoverExecutor(
                config,
                logger,
                "Gemini CharacterRelationships",
                GeminiPrimaryKeyRole.Analyze,
                TimeSpan.FromMinutes(4));
        }

        public async Task<IReadOnlyList<CharacterRelationshipDto>> GetAllAsync(
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);

            var rows = await _db.CharacterRelationships
                .AsNoTracking()
                .Where(r => r.ProjectId == projectId)
                .OrderByDescending(r => r.StrengthScore)
                .ThenBy(r => r.CreatedAt)
                .Select(r => new CharacterRelationshipDto
                {
                    Id = r.Id,
                    ProjectId = r.ProjectId,
                    CharAId = r.CharAId,
                    CharBId = r.CharBId,
                    RelationType = r.RelationType,
                    StrengthScore = r.StrengthScore,
                    EvidenceChunkIds = r.EvidenceChunkIds,
                    CreatedAt = r.CreatedAt,
                })
                .ToListAsync(cancellationToken);

            return rows;
        }

        public async Task<CharacterRelationshipExtractResult> ExtractAsync(
            Guid projectId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            await VerifyOwnershipAsync(projectId, userId, cancellationToken);

            var user = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, cancellationToken);
            var rawDek = GetDek(user);

            var chars = await _db.CharacterEntries
                .AsNoTracking()
                .Where(c => c.ProjectId == projectId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync(cancellationToken);

            if (chars.Count < 2)
            {
                return new CharacterRelationshipExtractResult
                {
                    CandidatesConsidered = chars.Count,
                    PairsSentToAi = 0,
                    Upserted = 0,
                    SkippedNoEvidence = 0
                };
            }

            var characterInfos = chars
                .Select(c => new
                {
                    c.Id,
                    Name = SafeLower(EncryptionHelper.DecryptWithMasterKey(c.Name, rawDek))
                })
                .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                .ToList();

            if (characterInfos.Count < 2)
            {
                return new CharacterRelationshipExtractResult
                {
                    CandidatesConsidered = chars.Count,
                    PairsSentToAi = 0,
                    Upserted = 0,
                    SkippedNoEvidence = 0
                };
            }

            // Load & decrypt chunks; create an ordinal per chunk for evidence ids.
            var chapters = await _db.Chapters
                .AsNoTracking()
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .ToListAsync(cancellationToken);

            var versionToChapter = chapters
                .Where(c => c.CurrentVersionId.HasValue)
                .ToDictionary(c => c.CurrentVersionId!.Value, c => (c.ChapterNumber, c.Title));

            var activeVersionIds = versionToChapter.Keys.ToList();

            // Match the same ordinal logic as evidence chunks endpoint:
            // chapterNumber asc, then ChunkIndex asc (only embedded chunks of active versions).
            var chunksRaw = await _db.ChapterChunks
                .AsNoTracking()
                .Where(c => c.ProjectId == projectId && c.Embedding != null && activeVersionIds.Contains(c.VersionId))
                .ToListAsync(cancellationToken);

            var ordered = chunksRaw
                .Where(c => versionToChapter.ContainsKey(c.VersionId))
                .OrderBy(c => versionToChapter[c.VersionId].ChapterNumber)
                .ThenBy(c => c.ChunkIndex)
                .ToList();

            var decryptedChunks = new List<string>(ordered.Count);
            for (var i = 0; i < ordered.Count; i++)
            {
                var txt = EncryptionHelper.DecryptWithMasterKey(ordered[i].Content, rawDek);
                decryptedChunks.Add(txt ?? string.Empty);
            }

            // For each chunk, determine mentioned characters.
            var mentionsByChunkOrdinal = new List<List<Guid>>(ordered.Count);
            for (var i = 0; i < decryptedChunks.Count; i++)
            {
                var text = SafeLower(decryptedChunks[i]);
                var mentioned = new List<Guid>();
                foreach (var ch in characterInfos)
                {
                    if (ch.Name.Length < 2) continue;
                    if (text.Contains(ch.Name, StringComparison.Ordinal))
                        mentioned.Add(ch.Id);
                }
                mentionsByChunkOrdinal.Add(mentioned);
            }

            // Collect co-mention evidence per pair
            var evidenceByPair = new Dictionary<(Guid A, Guid B), List<int>>();
            for (var ordinal = 0; ordinal < mentionsByChunkOrdinal.Count; ordinal++)
            {
                var mentioned = mentionsByChunkOrdinal[ordinal];
                if (mentioned.Count < 2) continue;

                // generate pairs from mentioned list
                for (var i = 0; i < mentioned.Count; i++)
                {
                    for (var j = i + 1; j < mentioned.Count; j++)
                    {
                        var a = mentioned[i];
                        var b = mentioned[j];
                        if (a == b) continue;
                        var key = NormalizePair(a, b);
                        if (!evidenceByPair.TryGetValue(key, out var list))
                        {
                            list = new List<int>();
                            evidenceByPair[key] = list;
                        }
                        list.Add(ordinal);
                    }
                }
            }

            var result = new CharacterRelationshipExtractResult
            {
                CandidatesConsidered = characterInfos.Count
            };

            // Filter pairs with >= 3 co-mention chunks
            var candidates = evidenceByPair
                .Where(kv => kv.Value.Distinct().Count() >= 3)
                .Select(kv => new
                {
                    kv.Key.A,
                    kv.Key.B,
                    Evidence = kv.Value.Distinct().OrderBy(x => x).Take(10).ToList()
                })
                .ToList();

            result.SkippedNoEvidence = evidenceByPair.Count - candidates.Count;
            result.PairsSentToAi = candidates.Count;

            var upserted = 0;

            foreach (var cand in candidates)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var nameA = characterInfos.First(x => x.Id == cand.A).Name;
                var nameB = characterInfos.First(x => x.Id == cand.B).Name;

                var chunkTextPack = string.Join(
                    "\n\n---\n\n",
                    cand.Evidence.Select(i =>
                    {
                        var snippet = decryptedChunks[i];
                        if (snippet.Length > 900) snippet = snippet[..900] + "...";
                        return $"[chunk #{i}]\n{snippet}";
                    }));

                var prompt = BuildPrompt(nameA, nameB, chunkTextPack, cand.Evidence);
                var ai = await CompleteJsonAsync(prompt);
                if (ai == null) continue;

                var relType = NormalizeRelationType(ai.RelationType);
                var strength = Math.Clamp(ai.Strength, 0f, 1f);
                var evidence = ai.EvidenceChunkIds?.Distinct().Where(x => cand.Evidence.Contains(x)).ToList();
                if (evidence == null || evidence.Count == 0)
                {
                    // ensure evidence non-empty for acceptance
                    evidence = cand.Evidence.Take(3).ToList();
                }

                var entity = await _db.CharacterRelationships
                    .FirstOrDefaultAsync(r => r.ProjectId == projectId && r.CharAId == cand.A && r.CharBId == cand.B, cancellationToken);

                if (entity == null)
                {
                    entity = new CharacterRelationship
                    {
                        Id = Guid.NewGuid(),
                        ProjectId = projectId,
                        CharAId = cand.A,
                        CharBId = cand.B,
                        RelationType = relType,
                        StrengthScore = strength,
                        EvidenceChunkIds = evidence,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.CharacterRelationships.Add(entity);
                }
                else
                {
                    // idempotent: update values, keep CreatedAt
                    entity.RelationType = relType;
                    entity.StrengthScore = strength;
                    entity.EvidenceChunkIds = evidence;
                }

                upserted++;
            }

            if (upserted > 0)
            {
                await _db.SaveChangesAsync(cancellationToken);
            }

            result.Upserted = upserted;
            return result;
        }

        private async Task<AiRelationshipOutput?> CompleteJsonAsync(string userPrompt)
        {
            var system = """
Bạn là hệ thống trích xuất quan hệ giữa 2 nhân vật dựa trên các đoạn văn bản truyện.
Chỉ trả về JSON THUẦN, KHÔNG markdown, KHÔNG giải thích, đúng schema:
{
  "relation_type": "family|friend|rival|romantic|mentor|colleague|unknown",
  "strength": 0.0-1.0,
  "evidence_chunk_ids": [int]
}
Yêu cầu:
- evidence_chunk_ids phải là danh sách các chunk id (số) được cung cấp trong input.
- Nếu không chắc chắn, chọn relation_type="unknown".
""";

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage(system),
                ChatMessage.CreateUserMessage(userPrompt)
            };

            var completion = await _gemini.CompleteAsync(messages);
            var raw = completion.Content[0].Text?.Trim() ?? string.Empty;
            raw = LlmOutputValidator.ValidateOrReplace(raw, _logger, "CharacterRelationships");

            var json = ExtractJsonObject(raw);
            if (json == null) return null;

            try
            {
                var parsed = JsonSerializer.Deserialize<AiRelationshipOutput>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (parsed == null) return null;
                if (string.IsNullOrWhiteSpace(parsed.RelationType)) return null;
                if (!AllowedRelationTypes.Contains(parsed.RelationType.Trim().ToLowerInvariant()))
                    parsed.RelationType = "unknown";
                return parsed;
            }
            catch
            {
                _logger.LogWarning("Không parse được JSON relationship: {Raw}", raw);
                return null;
            }
        }

        private static string BuildPrompt(string nameA, string nameB, string chunks, List<int> evidenceIds)
        {
            var ids = string.Join(", ", evidenceIds);
            return $"""
Hai nhân vật: "{nameA}" và "{nameB}"

Các chunk co-mention (id: {ids}):
{chunks}
""";
        }

        private static string? ExtractJsonObject(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var s = raw.Trim().Trim('`');
            var i1 = s.IndexOf('{');
            var i2 = s.LastIndexOf('}');
            if (i1 < 0 || i2 <= i1) return null;
            return s[i1..(i2 + 1)];
        }

        private static string NormalizeRelationType(string? t)
        {
            var v = (t ?? "unknown").Trim().ToLowerInvariant();
            return AllowedRelationTypes.Contains(v) ? v : "unknown";
        }

        private static string SafeLower(string s)
            => (s ?? string.Empty).Trim().ToLowerInvariant();

        private static (Guid A, Guid B) NormalizePair(Guid a, Guid b)
            => a.CompareTo(b) < 0 ? (a, b) : (b, a);

        private async Task VerifyOwnershipAsync(Guid projectId, Guid userId, CancellationToken cancellationToken)
        {
            var ok = await _db.Projects
                .AsNoTracking()
                .AnyAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId, cancellationToken);
            if (!ok) throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        private string GetDek(User user)
        {
            var masterKey = _config["Security:MasterKey"]!;
            return EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);
        }

        private sealed class AiRelationshipOutput
        {
            public string RelationType { get; set; } = "unknown";
            public float Strength { get; set; } = 0;
            public List<int>? EvidenceChunkIds { get; set; }
        }
    }
}

