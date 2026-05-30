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

            var topK             = Math.Clamp(await _sysConfig.GetAsync("rag.top_k_report", 12), 1, 64);
            var stage1BatchChunks = Math.Clamp(await _sysConfig.GetAsync("rag.stage1_batch_chunks", 8), 1, 20);
            var stage1MaxChars   = Math.Clamp(await _sysConfig.GetAsync("rag.stage1_max_chunk_chars", 900), 200, 4000);
            var factsMaxChars    = Math.Clamp(await _sysConfig.GetAsync("rag.facts_json_max_chars", 12000), 2000, 50000);
            var bibleMaxChars    = Math.Clamp(await _sysConfig.GetAsync("rag.bible_max_chars", 4000), 500, 20000);
            var embedTokenEstimate = Math.Clamp(await _sysConfig.GetAsync("rag.estimated_tokens_per_query_embed", 200), 0, 2000);
            var rubricBatchSize  = Math.Clamp(await _sysConfig.GetAsync("rag.rubric_batch_size", 5), 1, 20);


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

            var aiScoresArray = new AiScoreItem[Rubric.Count];
            var reportItemsArray = new ReportItem[Rubric.Count];
            var tokensUsed = stage1Tokens;
            var embedCalls = 0;
            var completedCriteriaCount = 0;

            for (var offset = 0; offset < Rubric.Count; offset += rubricBatchSize)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var batchItems = Rubric.Skip(offset).Take(rubricBatchSize).ToList();
                
                var batchTasks = batchItems.Select(async (item) =>
                {
                    var idx = Rubric.IndexOf(item);
                    var (key, group, name, max) = item;

                    var queryText = RubricQueryTemplates.GetRetrievalQuery(key);
                    var queryEmbedding = await _embeddingService.GetEmbeddingAsync(queryText, EmbeddingUseCase.ChatQuery);
                    System.Threading.Interlocked.Increment(ref embedCalls);

                    var ranked = RagChunkRanking.TopKByCosine(chunkEntities, ordinalByChunkId, queryEmbedding, topK);
                    if (ranked.Count == 0)
                    {
                        _logger.LogWarning("RAG: không lấy được chunk nào cho tiêu chí {Key} — dùng score mặc định 0.", key);
                        aiScoresArray[idx] = new AiScoreItem
                        {
                            Key = key,
                            Score = 0,
                            MaxScore = max,
                            Feedback = "Không đủ dữ liệu để đánh giá tiêu chí này (không tìm được đoạn văn phù hợp).",
                            Evidence = string.Empty,
                            BibleComparison = null,
                            Errors = new List<string> { "Không có chunk phù hợp được truy xuất bởi RAG cho tiêu chí này." },
                            Suggestions = new List<string> { "Hãy đảm bảo các chương đã được chunk và embed trước khi phân tích." },
                        };
                        reportItemsArray[idx] = new ReportItem { CriterionKey = key, EvidenceChunkIds = new List<int>() };

                        if (progressCallback != null)
                        {
                            int done = System.Threading.Interlocked.Increment(ref completedCriteriaCount);
                            var p = 40 + (int)Math.Round((done) / (double)Rubric.Count * 38d);
                            await progressCallback(Math.Clamp(p, 40, 78), $"RAG: chấm {key} ({done}/{Rubric.Count})", cancellationToken);
                        }
                        return;
                    }

                    // Sắp xếp các đoạn trích (chunks) theo đúng thứ tự dòng thời gian của câu chuyện (chronological order)
                    // để tránh AI bị hiểu sai hoặc đánh giá rời rạc các tình tiết nằm ngoài thứ tự.
                    var chronRanked = ranked.OrderBy(r => r.Ordinal).ToList();

                    var contextParts = new List<string>(chronRanked.Count);
                    foreach (var (ch, ord) in chronRanked)
                    {
                        var plain = decryptedChunks[ordinalByChunkId[ch.Id]];
                        var snippet = TruncateForPrompt(PromptSanitizer.SanitizeUserContent(plain), 1600);

                        var chNum = ch.Version?.Chapter?.ChapterNumber;
                        var chTitle = ch.Version?.Chapter?.Title;
                        var locationStr = chNum.HasValue
                            ? (string.IsNullOrWhiteSpace(chTitle) ? $"Chương {chNum.Value}" : $"Chương {chNum.Value}: {chTitle}")
                            : "Không rõ chương";

                        contextParts.Add($"[Đoạn trích (chunk_ord={ord}) - Vị trí: {locationStr}]\n{snippet}");
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

                        ĐOẠN TRUYỆN TRÍCH (Đã được sắp xếp theo đúng thứ tự thời gian của truyện để đảm bảo tính liên kết cốt truyện; chunk_ord là id nguyên số dùng để điền evidence_chunk_ids):
                        {{string.Join("\n\n---\n\n", contextParts)}}

                        QUY TẮC PHÂN BIỆT TRÙNG LẶP KỸ THUẬT VS LẶP CỐT TRUYỆN THỰC TẾ:
                        1. LẶP KỸ THUẬT (OVERLAP): Giữa các đoạn trích kề nhau của cùng một chương (ví dụ cùng thuộc 'Chương 2') có thể có sự trùng lặp nhẹ về câu chữ ở ranh giới biên (đây là kỹ thuật overlap để không mất context khi cắt nhỏ văn bản). Bạn PHẢI bỏ qua sự lặp lại kỹ thuật này, tuyệt đối không được đánh giá là tác giả viết lặp ý hay lỗi văn phong.
                        2. LẶP CHƯƠNG THỰC TẾ (DUPLICATE): Nếu bạn phát hiện hai hoặc nhiều đoạn trích thuộc các chương KHÁC NHAU (ví dụ một đoạn thuộc 'Chương 2' và một đoạn thuộc 'Chương 3') có nội dung giống hệt nhau hoặc gần như giống hệt nhau, đây là lỗi trùng lặp nội dung thực tế do tác giả (ví dụ tác giả copy nhầm chương hoặc viết lặp chương). Bạn PHẢI chỉ ra lỗi nghiêm trọng này trong phần 'errors' để tác giả biết và xử lý.

                        Trả về JSON thuần túy một object với các field:
                        - score (0 đến {{max}})
                        - feedback (3-5 câu tiếng Việt đánh giá tích cực/tiêu cực khách quan, tuyệt đối không dùng từ 'chunk' hay 'chunk_ord')
                        - evidence (trích dẫn ngắn từ đoạn trên)
                        - errors (mảng ≥3 chuỗi): Mỗi chuỗi phải chỉ rõ một vấn đề/sạn cốt truyện cụ thể phát hiện được trong phần trích. Yêu cầu chỉ rõ chương nào (dựa trên thông tin 'Vị trí: Chương X' của đoạn trích), tình tiết nào hoặc nhân vật nào gặp vấn đề, và đưa ra ví dụ cụ thể. Tuyệt đối KHÔNG viết chung chung lý thuyết, và TUYỆT ĐỐI KHÔNG đề cập đến các từ ngữ kỹ thuật hệ thống như 'chunk', 'chunk_ord' hay 'đoạn trích' trong nội dung phản hồi cho tác giả.
                        - suggestions (mảng ≥3 chuỗi): Mỗi chuỗi là giải pháp/khuyến nghị tương ứng cho vấn đề ở trên. Yêu cầu đưa ra ví dụ cụ thể (như gợi ý cách viết lại, lời thoại mẫu hoặc hướng điều chỉnh tình tiết rõ ràng), tuyệt đối KHÔNG khuyên bảo chung chung mơ hồ, và TUYỆT ĐỐI KHÔNG sử dụng các từ kỹ thuật như 'chunk' hay 'chunk_ord' trong nội dung đề xuất.
                        - bibleComparison (chuỗi hoặc null)
                        - evidence_chunk_ids (mảng số nguyên — các chunk_ord đã dùng).

                        Quy tắc: evidence_chunk_ids phải là tập con các chunk_ord đã liệt kê; không bịa trích dẫn ngoài đoạn trích.
                        """;

                    var messages = new List<ChatMessage>
                    {
                        ChatMessage.CreateSystemMessage("Chỉ trả về một JSON object hợp lệ, không markdown, không giải thích ngoài JSON. ZERO HALLUCINATION: không bịa trích dẫn ngoài đoạn trích."),
                        ChatMessage.CreateUserMessage(judgeUserPrompt),
                    };

                    var completion = await CompleteChatWithGeminiAsync(messages, maxTokens: 3500, temperature: 0.15f, cancellationToken);
                    System.Threading.Interlocked.Add(ref tokensUsed, completion.Usage?.TotalTokenCount ?? 0);

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

                    aiScoresArray[idx] = new AiScoreItem
                    {
                        Key = key,
                        Score = score,
                        MaxScore = max,
                        Feedback = feedback,
                        Evidence = evidence,
                        BibleComparison = judge.BibleComparison,
                        Errors = errors,
                        Suggestions = suggestions,
                    };

                    reportItemsArray[idx] = new ReportItem
                    {
                        CriterionKey = key,
                        EvidenceChunkIds = evidenceIds,
                    };

                    if (progressCallback != null)
                    {
                        int done = System.Threading.Interlocked.Increment(ref completedCriteriaCount);
                        var p = 40 + (int)Math.Round((done) / (double)Rubric.Count * 38d);
                        await progressCallback(Math.Clamp(p, 40, 78), $"RAG: chấm {key} ({done}/{Rubric.Count})", cancellationToken);
                    }
                });

                await Task.WhenAll(batchTasks);
            }

            var aiScores = aiScoresArray.ToList();
            var reportItems = reportItemsArray.ToList();

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

                Mã warnings hợp lệ: INCOMPLETE, REPETITION, PLAGIARISM_RISK, INCONSISTENCY, SEXUAL_CONTENT, ANTI_STATE, OTHER.
                Severity: INFO, WARNING, CRITICAL.
                Hướng dẫn severity cho từng code:
                - INCOMPLETE: WARNING nếu dừng giữa chừng không giải quyết, INFO nếu cliffhanger có chủ ý
                - REPETITION: WARNING nếu văn phong lặp lại rõ ràng trong cùng đoạn, KHÔNG báo nếu nhân vật/tình tiết quan trọng xuất hiện nhiều batch (đó là nhất quán)
                - PLAGIARISM_RISK: CRITICAL, chỉ báo khi TỰ TIN cao có sự tương đồng với tác phẩm nổi tiếng
                - INCONSISTENCY: WARNING/CRITICAL nếu có mâu thuẫn RÕ RÀNG (nhân vật chết rồi sống lại không giải thích, timeline đảo lộn...)
                - SEXUAL_CONTENT: WARNING nếu nội dung người lớn explicit, CRITICAL nếu liên quan trẻ em/nhân vật chưa thành niên. KHÔNG báo với cảnh lãng mạn, hôn, ám chỉ tinh tế.
                - ANTI_STATE: CRITICAL nếu có nội dung xuyên tạc lịch sử/chủ quyền Việt Nam, kích động chống phá. KHÔNG báo với phê phán xã hội mang tính văn học thông thường.
                - Nếu không phát hiện vấn đề: warnings=[]

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
            [JsonPropertyName("feedback"), JsonConverter(typeof(SafeStringConverter))] public string? Feedback { get; set; }
            [JsonPropertyName("comment"), JsonConverter(typeof(SafeStringConverter))] public string? Comment { get; set; }
            [JsonPropertyName("evidence"), JsonConverter(typeof(SafeStringConverter))] public string? Evidence { get; set; }
            [JsonPropertyName("errors"), JsonConverter(typeof(SafeStringListConverter))] public List<string>? Errors { get; set; }
            [JsonPropertyName("suggestions"), JsonConverter(typeof(SafeStringListConverter))] public List<string>? Suggestions { get; set; }
            [JsonPropertyName("bibleComparison"), JsonConverter(typeof(SafeStringConverter))] public string? BibleComparison { get; set; }
            [JsonPropertyName("evidence_chunk_ids"), JsonConverter(typeof(SafeIntListConverter))] public List<int>? EvidenceChunkIds { get; set; }
        }

        private sealed class RagSynthesisResponse
        {
            [JsonPropertyName("overallFeedback"), JsonConverter(typeof(SafeStringConverter))] public string? OverallFeedback { get; set; }
            [JsonPropertyName("warnings")] public List<RagSynthesisWarningDto>? Warnings { get; set; }
        }

        private sealed class RagSynthesisWarningDto
        {
            [JsonPropertyName("code"), JsonConverter(typeof(SafeStringConverter))] public string Code { get; set; } = "";
            [JsonPropertyName("severity"), JsonConverter(typeof(SafeStringConverter))] public string? Severity { get; set; }
            [JsonPropertyName("title"), JsonConverter(typeof(SafeStringConverter))] public string? Title { get; set; }
            [JsonPropertyName("detail"), JsonConverter(typeof(SafeStringConverter))] public string? Detail { get; set; }
        }
    }
}
