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
                List<string> stage1Fragments,
                int stage1Tokens,
                CancellationToken cancellationToken)
        {
            if (chunkEntities.Count != decryptedChunks.Count)
                throw new InvalidOperationException("Chunk entities và plaintext không khớp số lượng.");

            var topK             = Math.Clamp(await _sysConfig.GetAsync("rag.top_k_report", 15), 1, 64);
            var factsMaxChars    = Math.Clamp(await _sysConfig.GetAsync("rag.facts_json_max_chars", 12000), 2000, 50000);
            var bibleMaxChars    = Math.Clamp(await _sysConfig.GetAsync("rag.bible_max_chars", 4000), 500, 20000);
            var embedTokenEstimate = Math.Clamp(await _sysConfig.GetAsync("rag.estimated_tokens_per_query_embed", 200), 0, 2000);
            var rubricBatchSize  = Math.Clamp(await _sysConfig.GetAsync("rag.rubric_batch_size", 5), 1, 20);


            var ordinalByChunkId = new Dictionary<Guid, int>(chunkEntities.Count);
            for (var i = 0; i < chunkEntities.Count; i++)
                ordinalByChunkId[chunkEntities[i].Id] = i;

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

                    var auditGuide = GetRubricAuditGuide(key);
                    var judgeUserPrompt = $$"""
                        Bạn là giám khảo văn học. Chấm ĐÚNG MỘT tiêu chí rubric dưới đây dựa trên các đoạn truyện đã trích (RAG), facts đã trích trước đó, và tham chiếu nền (bible).

                        THÔNG TIN HOÀN THIỆN:
                        {{completenessNote}}

                        TIÊU CHÍ (key={{key}}, nhóm={{group}}, tên={{name}}, điểm tối đa={{max}}).

                        {{auditGuide}}

                        FACTS JSON (Stage 1, có thể rút gọn):
                        {{factsForPrompt}}

                        THAM CHIẾU NỀN (không trừ điểm vì khác biệt với truyện; chỉ dùng bibleComparison trung lập):
                        {{(string.IsNullOrEmpty(bibleForPrompt) ? "(Không có)" : bibleForPrompt)}}
                        {{instructionsPart}}

                        ĐOẠN TRUYỆN TRÍCH (Đã được sắp xếp theo đúng thứ tự thời gian của truyện để đảm bảo tính liên kết cốt truyện; chunk_ord là id nguyên số dùng để điền evidence_chunk_ids):
                        {{string.Join("\n\n---\n\n", contextParts)}}

                        YÊU CẦU VỀ DẪN CHỨNG (EVIDENCE) - QUAN TRỌNG:
                        Bạn PHẢI cung cấp đầy đủ và nhiều dẫn chứng thực tế hơn để chứng minh cho nhận xét của mình. Hãy trích xuất ít nhất 2 đến 3 câu văn/đoạn văn tiêu biểu trực tiếp từ các đoạn truyện trích làm dẫn chứng cụ thể. Các dẫn chứng này phải được viết trong trường 'evidence', phân tách rõ ràng với nhau bằng dấu ba chấm '...' hoặc dấu xuống dòng.

                        QUY TẮC PHÂN BIỆT TRÙNG LẶP KỸ THUẬT VS LẶP CỐT TRUYỆN THỰC TẾ:
                        1. LẶP KỸ THUẬT (OVERLAP): Giữa các đoạn trích kề nhau của cùng một chương (ví dụ cùng thuộc 'Chương 2') có thể có sự trùng lặp nhẹ về câu chữ ở ranh giới biên (đây là kỹ thuật overlap để không mất context khi cắt nhỏ văn bản). Bạn PHẢI bỏ qua sự lặp lại kỹ thuật này, tuyệt đối không được đánh giá là tác giả viết lặp ý hay lỗi văn phong.
                        2. LẶP CHƯƠNG THỰC TẾ (DUPLICATE): Nếu bạn phát hiện hai hoặc nhiều đoạn trích thuộc các chương KHÁC NHAU (ví dụ một đoạn thuộc 'Chương 2' và một đoạn thuộc 'Chương 3') có nội dung giống hệt nhau hoặc gần như giống hệt nhau, đây là lỗi trùng lặp nội dung thực tế do tác giả (ví dụ tác giả copy nhầm chương hoặc viết lặp chương). Bạn PHẢI chỉ ra lỗi nghiêm trọng này trong phần 'errors' để tác giả biết và xử lý.

                        OUTPUT: Chỉ trả về JSON object duy nhất, bắt đầu bằng '{', kết thúc bằng '}', không có bất kỳ văn bản nào trước hoặc sau:
                        {"score":0.0,"feedback":"3-5 câu nhận xét tiếng Việt","evidence":"câu văn dẫn chứng 1... câu văn dẫn chứng 2... câu văn dẫn chứng 3","errors":["lỗi 1","lỗi 2","lỗi 3"],"suggestions":["gợi ý 1","gợi ý 2","gợi ý 3"],"bibleComparison":null,"evidence_chunk_ids":[1,2]}

                        Lưu ý: bibleComparison là string nếu có cẩm nang, hoặc null (không phải chú thích). evidence_chunk_ids phải là tập con các chunk_ord đã liệt kê; không bịa trích dẫn ngoài đoạn trích.
                        """;

                    var messages = new List<ChatMessage>
                    {
                        ChatMessage.CreateSystemMessage(
                            "OUTPUT RULE (ABSOLUTE): Your ENTIRE response must be ONE valid JSON object. " +
                            "Start with '{' and end with '}'. NO text before or after the JSON. NO markdown. NO explanation. " +
                            "Required schema: {\"score\":0.0,\"feedback\":\"string\",\"evidence\":\"string\",\"errors\":[\"string\"],\"suggestions\":[\"string\"],\"bibleComparison\":null,\"evidence_chunk_ids\":[0]} " +
                            "where bibleComparison is a string or null (not a comment). ZERO HALLUCINATION."),
                        ChatMessage.CreateUserMessage(judgeUserPrompt),
                    };

                    var completion = await CompleteChatWithGeminiAsync(messages, maxTokens: 3500, temperature: 0.15f, jsonMode: true, cancellationToken: cancellationToken);
                    System.Threading.Interlocked.Add(ref tokensUsed, completion.Usage?.TotalTokenCount ?? 0);

                    var raw = NormalizeAiText(completion.Content.FirstOrDefault()?.Text ?? string.Empty);
                    bool parseSuccess = TryParseRagJudge(raw, out var judge, out var parseErr);

                    if (!parseSuccess)
                    {
                        _logger.LogWarning("RAG: Phân tích tiêu chí {Key} lần 1 bị lỗi JSON: {Error}. Tiến hành gọi AI thử lại...", key, parseErr);
                        try
                        {
                            var retryMessages = new List<ChatMessage>(messages)
                            {
                                ChatMessage.CreateAssistantMessage(raw),
                                ChatMessage.CreateUserMessage(
                                    "Phản hồi trước bị lỗi: '" + parseErr + "'. " +
                                    "Hãy trả về DUY NHẤT một JSON object, BẮT ĐẦU BẰNG '{' và KẾT THÚC BẰNG '}', " +
                                    "KHÔNG có bất kỳ văn bản, lời giải thích, hay markdown nào trước hoặc sau JSON. " +
                                    "Schema bắt buộc: {\"score\":0.0,\"feedback\":\"\",\"evidence\":\"\",\"errors\":[],\"suggestions\":[],\"bibleComparison\":null,\"evidence_chunk_ids\":[]}")
                            };


                            var retryCompletion = await CompleteChatWithGeminiAsync(retryMessages, maxTokens: 3500, temperature: 0.1f, jsonMode: true, cancellationToken: cancellationToken);
                            System.Threading.Interlocked.Add(ref tokensUsed, retryCompletion.Usage?.TotalTokenCount ?? 0);
                            
                            var retryRaw = NormalizeAiText(retryCompletion.Content.FirstOrDefault()?.Text ?? string.Empty);
                            parseSuccess = TryParseRagJudge(retryRaw, out judge, out parseErr);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "RAG: Gọi AI thử lại cho tiêu chí {Key} thất bại.", key);
                        }
                    }

                    if (!parseSuccess)
                    {
                        _logger.LogError("RAG: Phân tích tiêu chí {Key} bị lỗi định dạng sau 2 lần thử. Tự động áp dụng kết quả fallback dự phòng.", key);
                        
                        judge = new RagCriterionJudgeDto
                        {
                            Score = Math.Round(max * 0.6m, 1),
                            Feedback = "Phân tích tiêu chí này gặp lỗi phản hồi từ AI. Chúng tôi đã tạm thời áp dụng điểm trung bình đạt yêu cầu. Vui lòng bấm chạy lại phân tích sau ít phút để hệ thống cập nhật nhận xét chi tiết hơn.",
                            Evidence = ranked.Count > 0 ? TruncateForPrompt(decryptedChunks[ordinalByChunkId[ranked[0].Chunk.Id]], 300) : "",
                            Errors = new List<string>
                            {
                                "Không trích xuất được danh sách lỗi cụ thể do sự cố phản hồi tạm thời từ AI.",
                                "Tác giả vui lòng tự đối chiếu bối cảnh và tình tiết của chương tương ứng.",
                                "Khuyên dùng: Bấm chạy lại phân tích để hệ thống cập nhật đánh giá."
                            },
                            Suggestions = new List<string>
                            {
                                "Đọc kỹ hướng dẫn viết văn trong cẩm nang tác giả.",
                                "Mở rộng nội dung chương và bổ sung chi tiết cụ thể hơn để AI dễ phân tích.",
                                "Thử chạy lại phân tích báo cáo sau ít phút."
                            },
                            EvidenceChunkIds = ranked.Count > 0 ? new List<int> { ranked[0].Ordinal } : new List<int>()
                        };
                    }

                    var score = Math.Clamp(judge.Score, 0m, max);
                    var feedback = string.IsNullOrWhiteSpace(judge.Feedback) ? (judge.Comment ?? "").Trim() : judge.Feedback.Trim();
                    if (string.IsNullOrWhiteSpace(feedback))
                        feedback = "Nhận xét RAG theo các đoạn trích; cần đọc thêm ngữ cảnh nếu thiếu chi tiết.";

                    var evidence = (judge.Evidence ?? "").Trim();
                    if (string.IsNullOrWhiteSpace(evidence))
                        evidence = ranked.Count > 0
                            ? TruncateForPrompt(decryptedChunks[ordinalByChunkId[ranked[0].Chunk.Id]], 400)
                            : "";

                    var errors = CleanStringList(judge.Errors);
                    var suggestions = CleanStringList(judge.Suggestions);

                    var evidenceIds = (judge.EvidenceChunkIds ?? new List<int>())
                        .Where(id => ranked.Any(r => r.Ordinal == id))
                        .Distinct()
                        .ToList();

                    // TRÙNG KHỚP TRỰC TIẾP QUOTE VỚI CHƯƠNG THỰC TẾ (Chia nhỏ theo dấu chấm lửng/xuống dòng):
                    var cleanEvidence = (judge.Evidence ?? "").Trim();
                    var matchedByQuote = new List<int>();
                    if (cleanEvidence.Length >= 5)
                    {
                        var subQuotes = cleanEvidence
                            .Split(new[] { "...", "..", "\n", "…" }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(q => q.Trim().Trim('"', '\'', '“', '”', '«', '»'))
                            .Where(q => q.Length >= 5)
                            .ToList();

                        if (subQuotes.Count > 0)
                        {
                            var chunkMatches = new List<(int Index, int MatchCount)>();
                            for (var i = 0; i < decryptedChunks.Count; i++)
                            {
                                var normPlain = NormalizeForMatching(decryptedChunks[i]);
                                int matchCount = 0;
                                foreach (var sub in subQuotes)
                                {
                                    var normSub = NormalizeForMatching(sub);
                                    if (normSub.Length >= 5 && normPlain.Contains(normSub))
                                    {
                                        matchCount++;
                                    }
                                }
                                if (matchCount > 0)
                                {
                                    chunkMatches.Add((i, matchCount));
                                }
                            }

                            // Lấy tối đa 3 chunk khớp tốt nhất (có chứa nhiều câu trong dẫn chứng nhất)
                            var bestMatches = chunkMatches
                                .OrderByDescending(cm => cm.MatchCount)
                                .Select(cm => cm.Index)
                                .Take(3)
                                .ToList();

                            matchedByQuote.AddRange(bestMatches);
                        }
                    }

                    // Tối ưu hóa minh chứng: Ưu tiên phân đoạn khớp với trích dẫn thực tế thay vì mảng quá rộng hoặc lười biếng từ AI
                    if (matchedByQuote.Count > 0)
                    {
                        evidenceIds = matchedByQuote;
                    }
                    else if (evidenceIds.Count == 0 || evidenceIds.Count > 3)
                    {
                        // Fallback: Chỉ lấy đúng 1 phân đoạn tốt nhất từ RAG để tránh bôi đen/hiển thị tràn lan cả chương
                        if (ranked.Count > 0)
                        {
                            evidenceIds = new List<int> { ranked[0].Ordinal };
                        }
                    }

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
                    "characters","chapter_stats","plot_events","consistency_flags","emotion" — các key cũ là mảng (có thể rỗng), riêng "emotion" là một đối tượng JSON biểu diễn nhịp độ và cảm xúc của đoạn truyện.

                    Quy ước phần tử gợi ý:
                    - characters: { "name", "role?", "notes?" }
                    - chapter_stats: { "chapterNumber?", "excerptTheme?", "wordHint?" }
                    - plot_events: { "order", "summary", "chapterHint?" }
                    - consistency_flags: { "code", "detail", "severity?" }
                    - emotion: { "valence", "intensity", "dominantEmotion", "pacingScore", "note" }
                      Trong đó:
                      + valence: số thực từ -1.0 (cực kỳ tiêu cực/u buồn/lo sợ) đến 1.0 (cực kỳ tích cực/vui vẻ).
                      + intensity: số thực từ 0.0 đến 1.0 biểu thị mức độ mạnh mẽ của cảm xúc.
                      + dominantEmotion: một trong các từ tiếng Anh chính xác: "Joy", "Sadness", "Anger", "Fear", "Neutral".
                      + pacingScore: số thực từ 0.0 (rất chậm, suy tư, miêu tả cảnh) đến 100.0 (rất nhanh, dồn dập, hành động kịch tính).
                      + note: ghi chú ngắn gọn bằng tiếng Việt lý giải sắc thái nhịp độ và cảm xúc của đoạn này.

                    Tác phẩm: "{{projectTitle}}".
                    Đây là batch {{b + 1}}/{{totalBatches}} (các đoạn có thể chồng lấp với batch khác — gộp ý, tránh trùng lặp vô ích).

                    Nội dung:
                    {{string.Join("\n\n---\n\n", slice.Select((text, i) => $"[part_{b}_{i}]\n{text}"))}}
                    """;

                var messages = new List<ChatMessage>
                {
                    ChatMessage.CreateSystemMessage(
                        "Chỉ trả về JSON. Tiếng Việt cho string. Không bịa ngoài nội dung batch. " +
                        "Bắt buộc có đầy đủ các key: characters, chapter_stats, plot_events, consistency_flags, emotion. " +
                        "Key emotion phải là một JSON object có cấu trúc chính xác: " +
                        "{\"valence\": 0.0, \"intensity\": 0.0, \"dominantEmotion\": \"Neutral\", \"pacingScore\": 50.0, \"note\": \"\"}"),
                    ChatMessage.CreateUserMessage(userPrompt),
                };

                var completion = await CompleteChatWithGeminiAsync(messages, maxTokens: 3000, temperature: 0.1f, jsonMode: true, cancellationToken: cancellationToken);
                batchTokens += completion.Usage?.TotalTokenCount ?? 0;
                var raw = NormalizeAiText(completion.Content.FirstOrDefault()?.Text ?? string.Empty);
                var extracted = ExtractJsonPayload(raw.Trim());
                if (!string.IsNullOrWhiteSpace(extracted))
                    fragments.Add(extracted);
            }

            if (fragments.Count == 0)
                fragments.Add("""{"characters":[],"chapter_stats":[],"plot_events":[],"consistency_flags":[],"emotion":{"valence":0.0,"intensity":0.0,"dominantEmotion":"Neutral","pacingScore":50.0,"note":""}}""");

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

                Mã warnings hợp lệ: INCOMPLETE, REPETITION, PLAGIARISM_RISK, INCONSISTENCY, SEXUAL_CONTENT, ANTI_STATE, SPELLING_FORMATTING, OTHER.
                Severity: INFO, WARNING, CRITICAL.
                Hướng dẫn severity cho từng code:
                - INCOMPLETE: WARNING nếu dừng giữa chừng không giải quyết, INFO nếu cliffhanger có chủ ý
                - REPETITION: WARNING nếu văn phong lặp lại rõ ràng trong cùng đoạn, KHÔNG báo nếu nhân vật/tình tiết quan trọng xuất hiện nhiều batch (đó là nhất quán)
                - PLAGIARISM_RISK: CRITICAL, chỉ báo khi TỰ TIN cao có sự tương đồng với tác phẩm nổi tiếng
                - INCONSISTENCY: WARNING/CRITICAL nếu có mâu thuẫn RÕ RÀNG (nhân vật chết rồi sống lại không giải thích, timeline đảo lộn...)
                - SEXUAL_CONTENT: WARNING nếu nội dung người lớn explicit, CRITICAL nếu liên quan trẻ em/nhân vật chưa thành niên. KHÔNG báo với cảnh lãng mạn, hôn, ám chỉ tinh tế.
                - ANTI_STATE: CRITICAL nếu có nội dung xuyên tạc lịch sử/chủ quyền Việt Nam, kích động chống phá. KHÔNG báo với phê phán xã hội mang tính văn học thông thường.
                - SPELLING_FORMATTING: WARNING nếu văn bản có các lỗi chính tả tiếng Việt hoặc lỗi đánh máy (vd: 'loi' thay vì 'lỗi', 'đưọc' thay vì 'được'), lỗi khoảng trắng kép, dấu câu đặt không đúng chỗ, hoặc định dạng văn bản bị lỗi. BẮT BUỘC phải chỉ ra các ví dụ cụ thể của từ bị viết sai và định vị rõ chương nào, đoạn nào. Tuyệt đối KHÔNG được nhận xét chung chung mơ hồ như "Có một số lỗi chính tả".
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

            var completion = await CompleteChatWithGeminiAsync(messages, maxTokens: 2500, temperature: 0.2f, jsonMode: true, cancellationToken: cancellationToken);
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

        private static List<string> CleanStringList(List<string>? source)
        {
            return (source ?? new List<string>())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .ToList();
        }

        private static bool TryParseRagJudge(string raw, out RagCriterionJudgeDto dto, out string? error)
        {
            dto = new RagCriterionJudgeDto();
            error = null;
            try
            {
                var normalized = ExtractJsonPayload(raw.Trim());

                // Guard: nếu AI không trả về JSON object hợp lệ (không bắt đầu bằng '{'),
                // trả về false ngay để trigger retry thay vì để deserializer ném lỗi mập mờ.
                if (string.IsNullOrWhiteSpace(normalized))
                {
                    error = "AI trả về chuỗi rỗng sau khi extract JSON.";
                    return false;
                }

                var trimmed = normalized.TrimStart();
                if (!trimmed.StartsWith('{'))
                {
                    var preview = trimmed.Length > 120 ? trimmed[..120] + "..." : trimmed;
                    error = $"AI không trả về JSON object (bắt đầu bằng '{trimmed[0]}'). Preview: {preview}";
                    return false;
                }

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

        private static string GetRubricAuditGuide(string key)
        {
            return key.Trim() switch
            {
                // Nhóm 1: Kỳ vọng
                "1.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 1.1 - THỂ LOẠI]
- Kiểm tra tính nhất quán của tone giọng thể loại (ví dụ: truyện trinh thám nhưng văn phong sến súa ngôn tình, truyện kinh dị nhưng không tạo được cảm giác sợ hãi).
- Phát hiện các tình tiết đi chệch khỏi quy ước/tropes đặc trưng của thể loại (ví dụ: fantasy nhưng thiếu tính nhất quán về phép thuật, kỳ vọng không được đáp ứng).
- Chỉ ra các hạt sạn về nhịp điệu (pacing) sai lệch so với kỳ vọng thể loại (ví dụ: thriller giật gân nhưng tình tiết kéo dài lê thê).",

                "1.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 1.2 - TIỀN ĐỀ]
- Đánh giá xem thế giới và mâu thuẫn trung tâm (tiền đề) có được mở đầu ấn tượng, lôi cuốn ngay lập tức (hook) hay không.
- Phát hiện lỗi mở đầu lê thê, dài dòng, nhồi nhét thông tin (info-dumping) về bối cảnh quá nhiều làm loãng tiền đề.
- Chỉ ra sự thiếu rõ ràng hoặc thiếu kịch tính trong việc thiết lập các xung đột ban đầu (stakes) của câu chuyện.",

                // Nhóm 2: Nhân vật
                "2.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 2.1 - PHÁT TRIỂN NHÂN VẬT]
- Truy quét lỗi 'Mary Sue' hoặc 'Gary Stu': Nhân vật quá hoàn hảo, không có khuyết điểm thực sự, mọi khó khăn đều được giải quyết dễ dàng không cần nỗ lực.
- Lỗi biến chuyển tâm lý đứt gãy: Nhân vật thay đổi tính cách, thái độ hoặc thế giới quan quá nhanh, đột ngột chỉ sau 1-2 sự kiện ngắn mà không có quá trình tích lũy tâm lý hợp lý.
- Lỗi nhân vật thụ động (Passive protagonist): Nhân vật chính chỉ hành động theo sự sắp đặt khiên cưỡng của tác giả để đẩy cốt truyện đi lên, chứ không có động cơ nội tại (desire/motivation) thúc đẩy từ bên trong.",

                "2.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 2.2 - TÍNH CÁCH & SỰ HẤP DẪN]
- Truy quét lỗi nhân vật một chiều, mờ nhạt: Tính cách nhân vật rập khuôn (ví dụ: lạnh lùng, hiền lành...) không có nét đặc trưng riêng biệt, thiếu giọng văn (voice) độc bản hoặc hành vi thiếuBelievability.
- Lỗi thiếu sự đồng cảm (empathy): Nhân vật chính hành xử ích kỷ vô lý hoặc có những hành động khó hiểu khiến người đọc không thể thấu cảm hoặc đầu tư cảm xúc.",

                "2.3" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 2.3 - MỐI QUAN HỆ & TƯƠNG TÁC]
- Truy quét lỗi đối thoại gượng gạo (Unnatural/Passive dialogue): Lời thoại nhân vật quá trang trọng, mang tính giải thích thông tin kịch bản (infodump qua thoại), hoặc tất cả nhân vật đều có chung một cách nói chuyện giống hệt nhau.
- Lỗi thiếu chất xúc tác (Chemistry): Mối quan hệ phát triển khiên cưỡng, ví dụ: tình yêu 'sét đánh' thiếu sự gắn kết tâm hồn sâu sắc, hoặc xung đột tình cảm khiên cưỡng, trẻ con.",

                "2.4" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 2.4 - SỰ ĐA DẠNG NHÂN VẬT]
- Truy quét lỗi tuyến nhân vật phụ rập khuôn, làm nền (One-dimensional side characters): Các nhân vật phụ xuất hiện chỉ để làm công cụ tung hứng cho nhân vật chính mà không có cuộc sống, động cơ hay tính cách riêng.
- Lỗi đối thủ yếu ớt hoặc phản diện sáo rỗng (Flat antagonist): Nhân vật phản diện ác độc một cách vô lý, thiếu chiều sâu động cơ hoặc quá dễ dàng bị đánh bại.",

                // Nhóm 3: Cốt truyện & Cấu trúc
                "3.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 3.1 - DIỄN BIẾN CỐT TRUYỆN]
- Truy quét lỗi giải quyết xung đột khiên cưỡng (Deus Ex Machina): Giải quyết mâu thuẫn lớn bằng sự may mắn đột ngột hoặc nhân vật phụ thần bí tự dưng xuất hiện gánh team.
- Lỗi cảnh thừa (Filler Scenes): Các phân đoạn viết ra chỉ để kéo dài chữ, không giúp thúc đẩy cốt truyện tiến triển và không có giá trị phát triển nhân vật.
- Lỗi trôi nổi cốt truyện (Plot drift): Cốt truyện bị phân tán vào các nhánh phụ rườm rà làm loãng mạch truyện chính.",

                "3.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 3.2 - CẤU TRÚC & TỔ CHỨC]
- Truy quét lỗi cấu trúc chương lộn xộn: Sự chuyển tiếp giữa các chương/cảnh bị đứt gãy đột ngột, thiếu sự liên kết nhân quả (cause and effect).
- Lỗi sắp đặt chi tiết đệm yếu (Weak foreshadowing): Các tình tiết cao trào nổ ra quá bất ngờ mà không có sự cài cắm chi tiết ẩn ý trước đó, khiến người đọc cảm thấy bị lừa hoặc khiên cưỡng.",

                "3.3" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 3.3 - KẾT THÚC]
- Truy quét lỗi kết thúc vội vã (Rushed ending): Các mâu thuẫn tích lũy cả chương được giải quyết quá nhanh, chớp nhoáng chỉ trong vài câu văn khiến độc giả bị hụt hẫng.
- Lỗi kết thúc không thỏa mãn (Unsatisfying payoff): Thiếu sự đóng lại của các tuyến nhân vật, hoặc kết thúc để lại quá nhiều câu hỏi logic cốt lõi chưa được làm rõ một cách vô lý.",

                // Nhóm 4: Ngôn ngữ & Văn phong
                "4.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 4.1 - PHONG CÁCH & GIỌNG VĂN]
- Truy quét lỗi 'Kể thay vì tả' (Tell, don't show): Chỉ đơn thuần thông báo cảm xúc hoặc bối cảnh (""Anh ấy vô cùng giận dữ"", ""Căn phòng rất đẹp"") thay vì dùng hình ảnh ẩn dụ, chi tiết giác quan hoặc ngôn ngữ cơ thể để diễn tả.
- Lỗi lạm dụng từ ngữ ước lệ, sáo rỗng (Cliches): Sử dụng các mô tả rập khuôn đã quá mòn cũ trong văn học mạng.",

                "4.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 4.2 - NGỮ PHÁP & SỰ TRÔI CHẢY]
- Truy quét các lỗi diễn đạt lủng củng, câu văn dài dòng tối nghĩa, lạm dụng hư từ (thì, mà, là, bị, được) làm loãng nhịp câu.
- Phát hiện lỗi lặp từ vựng nghiêm trọng trong cùng một đoạn văn ngắn.",

                "4.3" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 4.3 - TÍNH DỄ ĐỌC]
- Truy quét lỗi viết câu phức tạp thái quá: Các câu văn quá nhiều vế phụ gây khó hiểu, tối nghĩa hoặc cách xuống dòng vô lý phá vỡ dòng chảy đọc.
- Phát hiện lỗi dùng từ Hán Việt hoặc biệt ngữ tối nghĩa, không phù hợp với ngữ cảnh câu chuyện.",

                // Nhóm 5: Sự hấp dẫn
                "5.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 5.1 - MỨC ĐỘ THÚ VỊ]
- Truy quét lỗi cảnh nhàm chán, đều đều: Câu chuyện trôi qua êm đềm quá lâu mà không có các yếu tố khơi gợi sự tò mò, thiếu đi các xung đột vi mô giữ chân độc giả.",

                "5.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 5.2 - MỨC ĐỘ CUỐN HÚT]
- Truy quét lỗi kết thúc chương/phân đoạn mờ nhạt: Thiếu đi các điểm treo (cliffhangers) hay những nút thắt kịch tính thôi thúc độc giả lật trang đọc chương tiếp theo.",

                // Nhóm 6: Tác động cảm xúc
                "6.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 6.1 - SỰ ĐỒNG CẢM]
- Truy quét lỗi cảm xúc hời hợt: Miêu tả nỗi đau hay niềm vui quá chớp nhoáng, hời hợt khiến độc giả chỉ đóng vai trò người xem đứng ngoài chứ không thể rung động cùng nhân vật.",

                "6.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 6.2 - CHIỀU SÂU CẢM XÚC]
- Truy quét lỗi bi kịch hóa thái quá (Melodrama): Cố tình khóc lóc gượng ép, cường điệu hóa cảm xúc đau đớn một cách sến súa mà không có nền tảng hoàn cảnh hợp lý.",

                // Nhóm 7: Chủ đề
                "7.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 7.1 - KHÁM PHÁ CHỦ ĐỀ]
- Truy quét lỗi giáo điều, lên lớp (Preachy writing): Tác giả cố tình nhồi nhét triết lý sống trực tiếp qua lời thoại hoặc lời kể, thay vì để chủ đề tự toát ra từ hành động và lựa chọn của nhân vật.",

                "7.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 7.2 - CHIỀU SÂU CHỦ ĐỀ]
- Truy quét lỗi chủ đề nông cạn, hời hợt: Câu chuyện giải quyết mâu thuẫn đạo đức một cách trắng đen rõ ràng, thiếu đi những vùng xám đạo đức đầy tính suy ngẫm.",

                // Nhóm 8: Xây dựng thế giới
                "8.1" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 8.1 - XÂY DỰNG THẾ GIỚI]
- Truy quét lỗi mâu thuẫn thiết lập thế giới (Worldbuilding inconsistencies): Chương trước quy định quy tắc A, chương sau lại vi phạm quy tắc đó mà không có giải thích.
- Lỗi thiếu chiều sâu thiết lập: Thế giới được xây dựng hời hợt, chỉ như một cái nền phẳng lì thiếu đi lịch sử, văn hóa hay luật lệ vận hành chân thực.",

                "8.2" => @"[CẨM NANG TRUY QUÉT SẠN VĂN HỌC CHO TIÊU CHÍ 8.2 - BỐI CẢNH]
- Truy quét lỗi bối cảnh rỗng (White room syndrome): Nhân vật trò chuyện hoặc hành động trong một không gian mờ nhạt, tác giả hoàn toàn quên miêu tả âm thanh, ánh sáng, nhiệt độ hoặc chi tiết giác quan xung quanh.",

                _ => ""
            };
        }

        private static string NormalizeForMatching(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            var normalized = text.ToLowerInvariant();
            normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"[“”""'’«».,!?;:()\[\]\-\r\n\t]", " ");
            normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"\s+", " ").Trim();
            return normalized;
        }
    }
}
