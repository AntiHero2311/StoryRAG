using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using OpenAI.Chat;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;

namespace Service.Implementations
{
    public partial class ProjectReportService
    {
        private async Task<(List<CriterionResult> Criteria, List<StoryWarning> Warnings, string OverallFeedback, int TokensUsed, string FactsPayloadJson, List<ReportItem> ReportItems)>
            EvaluateWithRagPipelineAsync(
                string projectTitle,
                List<ChapterChunk> chunkEntities,
                List<string> decryptedChunks,
                string? storyBibleText,
                int chapterCount,
                int totalWords,
                string? aiInstructions,
                Func<int, string?, CancellationToken, Task>? progressCallback,
                Guid _analysisRunId,
                CancellationToken cancellationToken)
        {
            if (chunkEntities.Count != decryptedChunks.Count)
                throw new InvalidOperationException("Chunk entities và plaintext không khớp số lượng.");

            var topK             = Math.Clamp(await _sysConfig.GetAsync("rag.top_k_report", 8), 1, 64);
            var stage1BatchChunks = ReadIntConfig("RagAnalysis:Stage1BatchChunks", 8, 1, 20);
            var stage1MaxChars   = ReadIntConfig("RagAnalysis:Stage1MaxChunkChars", 900, 200, 4000);
            var factsMaxChars    = ReadIntConfig("RagAnalysis:FactsJsonMaxChars", 12000, 2000, 50000);
            var bibleMaxChars    = ReadIntConfig("RagAnalysis:BibleMaxChars", 4000, 500, 20000);
            var embedTokenEstimate = ReadIntConfig("RagAnalysis:EstimatedTokensPerQueryEmbed", 200, 0, 2000);


            var ordinalByChunkId = new Dictionary<Guid, int>(chunkEntities.Count);
            for (var i = 0; i < chunkEntities.Count; i++)
                ordinalByChunkId[chunkEntities[i].Id] = i;

            if (progressCallback != null)
                await progressCallback(12, "RAG: trích xuất facts (Stage 1)", cancellationToken);

            var (stage1Fragments, stage1Tokens) = await RunStage1ExtractBatchesAsync(
                projectTitle,
                chunkEntities,
                decryptedChunks,
                stage1BatchChunks,
                stage1MaxChars,
                progressCallback,
                cancellationToken);

            var factsPayloadJson = MergeStage1FactJsonFragments(stage1Fragments);
            var factsForPrompt = TruncateForPrompt(factsPayloadJson, factsMaxChars);
            var bibleForPrompt = string.IsNullOrWhiteSpace(storyBibleText)
                ? ""
                : TruncateForPrompt(storyBibleText, bibleMaxChars);

            var completenessNote = BuildCompletenessNote(chapterCount, totalWords);
            var instructionsPart = string.IsNullOrWhiteSpace(aiInstructions)
                ? ""
                : $"\n\nGHI CHÚ CỦA TÁC GIẢ:\n{TruncateForPrompt(aiInstructions, 2000)}";

            var aiScores = new List<AiScoreItem>(Rubric.Count);
            var reportItems = new List<ReportItem>(Rubric.Count);
            var tokensUsed = stage1Tokens;
            var embedCalls = 0;

            for (var i = 0; i < Rubric.Count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var (key, group, name, max) = Rubric[i];

                if (progressCallback != null)
                {
                    var p = 40 + (int)Math.Round((i + 1d) / Rubric.Count * 38d);
                    await progressCallback(Math.Clamp(p, 40, 78), $"RAG: chấm {key} ({i + 1}/{Rubric.Count})", cancellationToken);
                }

                var queryText = RubricQueryTemplates.GetRetrievalQuery(key);
                var queryEmbedding = await _embeddingService.GetEmbeddingAsync(queryText, EmbeddingUseCase.ChatQuery);
                embedCalls++;

                var ranked = RagChunkRanking.TopKByCosine(chunkEntities, ordinalByChunkId, queryEmbedding, topK);
                if (ranked.Count == 0)
                {
                    _logger.LogWarning("RAG: không lấy được chunk nào cho tiêu chí {Key} — dùng score mặc định 0.", key);
                    aiScores.Add(new AiScoreItem
                    {
                        Key = key,
                        Score = 0,
                        MaxScore = max,
                        Feedback = "Không đủ dữ liệu để đánh giá tiêu chí này (không tìm được đoạn văn phù hợp).",
                        Evidence = string.Empty,
                        BibleComparison = null,
                        Errors = ["Không có chunk phù hợp được truy xuất bởi RAG cho tiêu chí này."],
                        Suggestions = ["Hãy đảm bảo các chương đã được chunk và embed trước khi phân tích."],
                    });
                    reportItems.Add(new ReportItem { CriterionKey = key, EvidenceChunkIds = [] });
                    continue;
                }

                var contextParts = new List<string>(ranked.Count);
                foreach (var (ch, ord) in ranked)
                {
                    var plain = decryptedChunks[ordinalByChunkId[ch.Id]];
                    var snippet = TruncateForPrompt(PromptSanitizer.SanitizeUserContent(plain), 1600);
                    contextParts.Add($"[chunk_ord={ord}]\n{snippet}");
                }

                var judgeUserPrompt = $$"""
                    Bạn là giám khảo văn học. Chấm ĐÚNG MỘT tiêu chí rubric dưới đây dựa trên các đoạn truyện đã trích (RAG), facts đã trích trước đó, và tham chiếu nền (bible).

                    THÔNG TIN HOÀN THIỆN:
                    {{completenessNote}}

                    TIÊU CHÍ (key={{key}}, nhóm={{group}}, tên={{name}}, điểm tối đa={{max}}).

                    FACTS JSON (Stage 1, có thể rút gọn):
                    {{factsForPrompt}}

                    THAM CHIẾU NỀN (không trừ điểm vì khác biệt với truyện; chỉ dùng bibleComparison trung lập):
                    {{(string.IsNullOrEmpty(bibleForPrompt) ? "(Không có)" : bibleForPrompt)}}
                    {{instructionsPart}}

                    ĐOẠN TRUYỆN TRÍCH (chỉ dùng làm bằng chứng; chunk_ord là id nguyên số để trả về evidence_chunk_ids):
                    {{string.Join("\n\n---\n\n", contextParts)}}

                    Trả về JSON thuần túy một object với các field: score (0 đến {{max}}), feedback (3-5 câu tiếng Việt), evidence (trích dẫn ngắn từ đoạn trên), errors (mảng ≥3 chuỗi), suggestions (mảng ≥3 chuỗi), bibleComparison (chuỗi hoặc null), evidence_chunk_ids (mảng số nguyên — các chunk_ord đã dùng).

                    Quy tắc: evidence_chunk_ids phải là tập con các chunk_ord đã liệt kê; không bịa trích dẫn ngoài đoạn trích.
                    """;

                var messages = new List<ChatMessage>
                {
                    ChatMessage.CreateSystemMessage("Chỉ trả về một JSON object hợp lệ, không markdown, không giải thích ngoài JSON. ZERO HALLUCINATION: không bịa trích dẫn ngoài đoạn trích."),
                    ChatMessage.CreateUserMessage(judgeUserPrompt),
                };

                var completion = await CompleteChatWithGeminiAsync(messages, maxTokens: 3500, temperature: 0.15f, cancellationToken);
                tokensUsed += completion.Usage?.TotalTokenCount ?? 0;

                var raw = NormalizeAiText(completion.Content.FirstOrDefault()?.Text ?? string.Empty);
                if (!TryParseRagJudge(raw, out var judge, out var parseErr))
                    throw new InvalidOperationException($"RAG judge {key}: {parseErr}");

                var score = Math.Clamp(judge.Score, 0m, max);
                var feedback = string.IsNullOrWhiteSpace(judge.Feedback) ? (judge.Comment ?? "").Trim() : judge.Feedback.Trim();
                if (string.IsNullOrWhiteSpace(feedback))
                    feedback = "Nhận xét RAG theo các đoạn trích; cần đọc thêm ngữ cảnh nếu thiếu chi tiết.";

                var evidence = (judge.Evidence ?? "").Trim();
                if (string.IsNullOrWhiteSpace(evidence))
                    evidence = ranked.Count > 0
                        ? TruncateForPrompt(decryptedChunks[ordinalByChunkId[ranked[0].Chunk.Id]], 400)
                        : "";

                var errors = PadStringList(judge.Errors, "RAG: đánh giá dựa trên phần trích, có thể thiếu toàn cục.", 3);
                var suggestions = PadStringList(judge.Suggestions, "Đọc thêm các chương liên quan hoặc mở rộng truy vấn để củng cố nhận định.", 3);

                var evidenceIds = (judge.EvidenceChunkIds ?? new List<int>())
                    .Where(id => ranked.Any(r => r.Ordinal == id))
                    .Distinct()
                    .ToList();
                if (evidenceIds.Count == 0)
                    evidenceIds = ranked.Select(r => r.Ordinal).Take(topK).ToList();

                aiScores.Add(new AiScoreItem
                {
                    Key = key,
                    Score = score,
                    MaxScore = max,
                    Feedback = feedback,
                    Evidence = evidence,
                    BibleComparison = judge.BibleComparison,
                    Errors = errors,
                    Suggestions = suggestions,
                });

                reportItems.Add(new ReportItem
                {
                    CriterionKey = key,
                    EvidenceChunkIds = evidenceIds,
                });
            }

            if (progressCallback != null)
                await progressCallback(82, "RAG: tổng hợp overall + warnings", cancellationToken);

            var (warnings, overallFeedback, synTokens) = await SynthesizeRagOverallAndWarningsAsync(
                projectTitle,
                aiScores,
                factsForPrompt,
                bibleForPrompt,
                completenessNote,
                cancellationToken);
            tokensUsed += synTokens;
            tokensUsed += embedCalls * embedTokenEstimate;

            var merged = MergeWithRubric(aiScores);
            return (merged, warnings, overallFeedback.Trim(), tokensUsed, factsPayloadJson, reportItems);
        }

        private async Task<(List<string> Fragments, int TokensUsed)> RunStage1ExtractBatchesAsync(
            string projectTitle,
            List<ChapterChunk> chunkEntities,
            List<string> decryptedChunks,
            int batchChunkCount,
            int maxCharsPerChunk,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            var fragments = new List<string>();
            var batchTokens = 0;
            var totalBatches = (int)Math.Ceiling(chunkEntities.Count / (double)batchChunkCount);

            for (var b = 0; b < totalBatches; b++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var slice = new List<string>();
                for (var j = 0; j < batchChunkCount; j++)
                {
                    var idx = b * batchChunkCount + j;
                    if (idx >= chunkEntities.Count)
                        break;
                    var body = decryptedChunks[idx];
                    slice.Add(TruncateForPrompt(PromptSanitizer.SanitizeUserContent(body), maxCharsPerChunk));
                }

                if (slice.Count == 0)
                    break;

                if (progressCallback != null)
                {
                    var prog = 14 + (int)Math.Round((b + 1d) / totalBatches * 22d);
                    await progressCallback(Math.Clamp(prog, 14, 36), $"RAG Stage1 batch {b + 1}/{totalBatches}", cancellationToken);
                }

                var userPrompt = $$"""
                    Bạn trích xuất cấu trúc JSON cho pipeline RAG. Chỉ trả về MỘT object JSON (không markdown), các key đúng tên sau:
                    "characters","chapter_stats","plot_events","consistency_flags" — mỗi key là mảng (có thể rỗng).

                    Quy ước phần tử gợi ý (tự do thêm field phụ):
                    - characters: { "name", "role?", "notes?" }
                    - chapter_stats: { "chapterNumber?", "excerptTheme?", "wordHint?" }
                    - plot_events: { "order", "summary", "chapterHint?" }
                    - consistency_flags: { "code", "detail", "severity?" }

                    Tác phẩm: "{{projectTitle}}".
                    Đây là batch {{b + 1}}/{{totalBatches}} (các đoạn có thể chồng lấp với batch khác — gộp ý, tránh trùng lặp vô ích).

                    Nội dung:
                    {{string.Join("\n\n---\n\n", slice.Select((text, i) => $"[part_{b}_{i}]\n{text}"))}}
                    """;

                var messages = new List<ChatMessage>
                {
                    ChatMessage.CreateSystemMessage("Chỉ trả về JSON. Tiếng Việt cho string. Không bịa ngoài nội dung batch."),
                    ChatMessage.CreateUserMessage(userPrompt),
                };

                var completion = await CompleteChatWithGeminiAsync(messages, maxTokens: 3000, temperature: 0.1f, cancellationToken);
                batchTokens += completion.Usage?.TotalTokenCount ?? 0;
                var raw = NormalizeAiText(completion.Content.FirstOrDefault()?.Text ?? string.Empty);
                var extracted = ExtractJsonPayload(raw.Trim());
                if (!string.IsNullOrWhiteSpace(extracted))
                    fragments.Add(extracted);
            }

            if (fragments.Count == 0)
                fragments.Add("""{"characters":[],"chapter_stats":[],"plot_events":[],"consistency_flags":[]}""");

            return (fragments, batchTokens);
        }

        private static string MergeStage1FactJsonFragments(IReadOnlyList<string> fragments)
        {
            var root = new JsonObject
            {
                ["characters"] = new JsonArray(),
                ["chapter_stats"] = new JsonArray(),
                ["plot_events"] = new JsonArray(),
                ["consistency_flags"] = new JsonArray(),
            };

            foreach (var frag in fragments)
            {
                if (string.IsNullOrWhiteSpace(frag))
                    continue;
                JsonNode? node;
                try
                {
                    node = JsonNode.Parse(frag);
                }
                catch
                {
                    continue;
                }

                if (node is not JsonObject obj)
                    continue;

                foreach (var key in new[] { "characters", "chapter_stats", "plot_events", "consistency_flags" })
                {
                    if (obj[key] is not JsonArray arr)
                        continue;
                    var target = (JsonArray)root[key]!;
                    foreach (var item in arr)
                        target.Add(item?.DeepClone());
                }
            }

            return root.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
        }

        private async Task<(List<StoryWarning> Warnings, string OverallFeedback, int TokensUsed)> SynthesizeRagOverallAndWarningsAsync(
            string projectTitle,
            List<AiScoreItem> scores,
            string factsSnippet,
            string bibleSnippet,
            string completenessNote,
            CancellationToken cancellationToken)
        {
            var rubricDigest = string.Join("\n", scores.Select(s =>
                $"{s.Key}: điểm {s.Score}/{s.MaxScore} — {TruncateForPrompt(s.Feedback, 220)}"));

            var userPrompt = $$"""
                Dựa trên các nhận xét đã chấm theo từng tiêu chí (RAG, có thể thiếu ngữ cảnh toàn văn), hãy viết overallFeedback (4-6 câu tiếng Việt tâm huyết) và mảng warnings (0..n) giống schema StoryWarning: code, severity, title, detail.

                Mã warnings hợp lệ: INCOMPLETE, REPETITION, PLAGIARISM_RISK, INCONSISTENCY, OTHER.
                Severity: INFO, WARNING, CRITICAL.

                THÔNG TIN HOÀN THIỆN:
                {{completenessNote}}

                Tóm tắt tiêu chí:
                {{rubricDigest}}

                FACTS (rút gọn):
                {{TruncateForPrompt(factsSnippet, 6000)}}

                BIBLE (rút gọn):
                {{(string.IsNullOrWhiteSpace(bibleSnippet) ? "(Không có)" : TruncateForPrompt(bibleSnippet, 3000))}}

                Tác phẩm: "{{projectTitle}}".

                Trả về JSON thuần: {"overallFeedback":"...","warnings":[...]} — nếu không có vấn đề đặc biệt thì warnings=[].
                """;

            var messages = new List<ChatMessage>
            {
                ChatMessage.CreateSystemMessage("Chỉ trả về JSON. Không markdown."),
                ChatMessage.CreateUserMessage(userPrompt),
            };

            var completion = await CompleteChatWithGeminiAsync(messages, maxTokens: 2500, temperature: 0.2f, cancellationToken);
            var tokens = completion.Usage?.TotalTokenCount ?? 0;
            var raw = NormalizeAiText(completion.Content.FirstOrDefault()?.Text ?? string.Empty);
            raw = ExtractJsonPayload(raw.Trim());

            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            try
            {
                var doc = JsonSerializer.Deserialize<RagSynthesisResponse>(raw, opts);
                var warnings = doc?.Warnings?
                    .Where(w => !string.IsNullOrWhiteSpace(w.Code))
                    .Select(w => new StoryWarning
                    {
                        Code = w.Code.Trim(),
                        Severity = string.IsNullOrWhiteSpace(w.Severity) ? "INFO" : w.Severity.Trim(),
                        Title = w.Title ?? "",
                        Detail = w.Detail ?? "",
                    })
                    .ToList() ?? new List<StoryWarning>();

                var overall = doc?.OverallFeedback?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(overall) || overall.Length < 20)
                    overall = "Tổng kết RAG: các nhận xét dựa trên phần trích ngữ cảnh; nên đọc toàn bộ trong workspace để hiểu sâu hơn.";
                return (warnings, overall, tokens);
            }
            catch
            {
                return (new List<StoryWarning>(), "Tổng kết RAG: hệ thống không tổng hợp được overallFeedback chi tiết từ LLM.", tokens);
            }
        }

        private static string TruncateForPrompt(string text, int maxChars)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxChars)
                return text;
            return text[..maxChars] + "\n[...]";
        }

        private static List<string> PadStringList(List<string>? source, string filler, int minCount)
        {
            var list = (source ?? new List<string>())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .ToList();
            while (list.Count < minCount)
                list.Add(filler);
            return list;
        }

        private static bool TryParseRagJudge(string raw, out RagCriterionJudgeDto dto, out string? error)
        {
            dto = new RagCriterionJudgeDto();
            error = null;
            try
            {
                var normalized = ExtractJsonPayload(raw.Trim());
                var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsed = JsonSerializer.Deserialize<RagCriterionJudgeDto>(normalized, opts);
                if (parsed == null)
                {
                    error = "Deserialize null";
                    return false;
                }

                dto = parsed;
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        private sealed class RagCriterionJudgeDto
        {
            [JsonPropertyName("score")] public decimal Score { get; set; }
            [JsonPropertyName("feedback")] public string? Feedback { get; set; }
            [JsonPropertyName("comment")] public string? Comment { get; set; }
            [JsonPropertyName("evidence")] public string? Evidence { get; set; }
            [JsonPropertyName("errors")] public List<string>? Errors { get; set; }
            [JsonPropertyName("suggestions")] public List<string>? Suggestions { get; set; }
            [JsonPropertyName("bibleComparison")] public string? BibleComparison { get; set; }
            [JsonPropertyName("evidence_chunk_ids")] public List<int>? EvidenceChunkIds { get; set; }
        }

        private sealed class RagSynthesisResponse
        {
            [JsonPropertyName("overallFeedback")] public string? OverallFeedback { get; set; }
            [JsonPropertyName("warnings")] public List<RagSynthesisWarningDto>? Warnings { get; set; }
        }

        private sealed class RagSynthesisWarningDto
        {
            [JsonPropertyName("code")] public string Code { get; set; } = "";
            [JsonPropertyName("severity")] public string? Severity { get; set; }
            [JsonPropertyName("title")] public string? Title { get; set; }
            [JsonPropertyName("detail")] public string? Detail { get; set; }
        }
    }
}
