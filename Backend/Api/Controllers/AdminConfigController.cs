using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.Interfaces;
using System.Security.Claims;
using System.Text.Json.Serialization;

namespace Api.Controllers
{
    [Route("api/admin/rag-config")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminConfigController : AppControllerBase
    {
        private readonly ISystemConfigService _sysConfig;
        private readonly ISystemAuditLogService _auditLog;

        // Config keys
        internal const string KeyChunkSize = "rag.chunk_size";
        internal const string KeyChunkOverlap = "rag.chunk_overlap";
        internal const string KeyTopKChat = "rag.top_k_chat";
        internal const string KeyTopKReport = "rag.top_k_report";
        internal const string KeySplitter = "rag.splitter";

        internal const string KeyStage1BatchChunks = "rag.stage1_batch_chunks";
        internal const string KeyStage1MaxChunkChars = "rag.stage1_max_chunk_chars";
        internal const string KeyFactsJsonMaxChars = "rag.facts_json_max_chars";
        internal const string KeyBibleMaxChars = "rag.bible_max_chars";
        internal const string KeyStoryBibleMaxChars = "rag.story_bible_max_chars";
        internal const string KeyEstimatedTokensPerQueryEmbed = "rag.estimated_tokens_per_query_embed";
        internal const string KeyRubricBatchSize = "rag.rubric_batch_size";
        internal const string KeyAnalyzeRpmLimit = "gemini.analyze_rpm_limit";

        // Defaults — mirrors those used in EmbeddingService / ProjectReportService
        private const int DefaultChunkSize = 800;
        private const int DefaultChunkOverlap = 100;
        private const int DefaultTopKChat = 5;
        private const int DefaultTopKReport = 15;
        private const string DefaultSplitter = "paragraph";

        private const int DefaultStage1BatchChunks = 8;
        private const int DefaultStage1MaxChunkChars = 900;
        private const int DefaultFactsJsonMaxChars = 12000;
        private const int DefaultBibleMaxChars = 4000;
        private const int DefaultStoryBibleMaxChars = 120000;
        private const int DefaultEstimatedTokensPerQueryEmbed = 200;
        private const int DefaultRubricBatchSize = 5;
        private const int DefaultAnalyzeRpmLimit = 120;

        public AdminConfigController(ISystemConfigService sysConfig, ISystemAuditLogService auditLog)
        {
            _sysConfig = sysConfig;
            _auditLog = auditLog;
        }

        /// <summary>Lấy cấu hình RAG hiện tại.</summary>
        [HttpGet]
        public async Task<IActionResult> GetRagConfig()
        {
            var chunkSize    = await _sysConfig.GetAsync(KeyChunkSize, DefaultChunkSize);
            var chunkOverlap = await _sysConfig.GetAsync(KeyChunkOverlap, DefaultChunkOverlap);
            var topKChat     = await _sysConfig.GetAsync(KeyTopKChat, DefaultTopKChat);
            var topKReport   = await _sysConfig.GetAsync(KeyTopKReport, DefaultTopKReport);
            var splitter     = await _sysConfig.GetAsync(KeySplitter, DefaultSplitter);

            var stage1BatchChunks = await _sysConfig.GetAsync(KeyStage1BatchChunks, DefaultStage1BatchChunks);
            var stage1MaxChunkChars = await _sysConfig.GetAsync(KeyStage1MaxChunkChars, DefaultStage1MaxChunkChars);
            var factsJsonMaxChars = await _sysConfig.GetAsync(KeyFactsJsonMaxChars, DefaultFactsJsonMaxChars);
            var bibleMaxChars = await _sysConfig.GetAsync(KeyBibleMaxChars, DefaultBibleMaxChars);
            var storyBibleMaxChars = await _sysConfig.GetAsync(KeyStoryBibleMaxChars, DefaultStoryBibleMaxChars);
            var estimatedTokensPerQueryEmbed = await _sysConfig.GetAsync(KeyEstimatedTokensPerQueryEmbed, DefaultEstimatedTokensPerQueryEmbed);
            var rubricBatchSize = await _sysConfig.GetAsync(KeyRubricBatchSize, DefaultRubricBatchSize);
            var analyzeRpmLimit = await _sysConfig.GetAsync(KeyAnalyzeRpmLimit, DefaultAnalyzeRpmLimit);

            return Ok(new RagConfigResponse
            {
                ChunkSize    = chunkSize,
                ChunkOverlap = chunkOverlap,
                TopKChat     = topKChat,
                TopKReport   = topKReport,
                Splitter     = splitter,

                Stage1BatchChunks = stage1BatchChunks,
                Stage1MaxChunkChars = stage1MaxChunkChars,
                FactsJsonMaxChars = factsJsonMaxChars,
                BibleMaxChars = bibleMaxChars,
                StoryBibleMaxChars = storyBibleMaxChars,
                EstimatedTokensPerQueryEmbed = estimatedTokensPerQueryEmbed,
                RubricBatchSize = rubricBatchSize,
                AnalyzeRpmLimit = analyzeRpmLimit
            });
        }

        /// <summary>Cập nhật cấu hình RAG. Chỉ Admin.</summary>
        [HttpPut]
        public async Task<IActionResult> PutRagConfig([FromBody] RagConfigRequest req)
        {
            // Validation
            var errors = new List<string>();

            if (req.ChunkSize < 100 || req.ChunkSize > 4000)
                errors.Add("chunk_size phải trong khoảng 100–4000.");

            if (req.ChunkOverlap < 0 || req.ChunkOverlap > 500)
                errors.Add("chunk_overlap phải trong khoảng 0–500.");

            if (req.ChunkOverlap >= req.ChunkSize)
                errors.Add("chunk_overlap phải nhỏ hơn chunk_size.");

            if (req.TopKChat < 1 || req.TopKChat > 20)
                errors.Add("top_k_chat phải trong khoảng 1–20.");

            if (req.TopKReport < 1 || req.TopKReport > 20)
                errors.Add("top_k_report phải trong khoảng 1–20.");

            var validSplitters = new[] { "paragraph", "sentence", "fixed" };
            if (!validSplitters.Contains(req.Splitter?.ToLower()))
                errors.Add($"splitter phải là một trong: {string.Join(", ", validSplitters)}.");

            // Dynamic validations
            if (req.Stage1BatchChunks < 1 || req.Stage1BatchChunks > 20)
                errors.Add("stage1_batch_chunks phải trong khoảng 1–20.");

            if (req.Stage1MaxChunkChars < 200 || req.Stage1MaxChunkChars > 4000)
                errors.Add("stage1_max_chunk_chars phải trong khoảng 200–4000.");

            if (req.FactsJsonMaxChars < 2000 || req.FactsJsonMaxChars > 50000)
                errors.Add("facts_json_max_chars phải trong khoảng 2000–50000.");

            if (req.BibleMaxChars < 500 || req.BibleMaxChars > 20000)
                errors.Add("bible_max_chars phải trong khoảng 500–20000.");

            if (req.StoryBibleMaxChars < 20000 || req.StoryBibleMaxChars > 500000)
                errors.Add("story_bible_max_chars phải trong khoảng 20000–500000.");

            if (req.EstimatedTokensPerQueryEmbed < 0 || req.EstimatedTokensPerQueryEmbed > 2000)
                errors.Add("estimated_tokens_per_query_embed phải trong khoảng 0–2000.");

            if (req.RubricBatchSize < 1 || req.RubricBatchSize > 20)
                errors.Add("rubric_batch_size phải trong khoảng 1–20.");

            if (req.AnalyzeRpmLimit < 1 || req.AnalyzeRpmLimit > 1200)
                errors.Add("analyze_rpm_limit phải trong khoảng 1–1200.");

            if (errors.Count > 0)
                return BadRequest(new { Message = "Validation thất bại.", Errors = errors });

            // Parse admin identity
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không xác định được danh tính admin." });

            // Get old config values for metadata logging
            var oldConfig = new System.Collections.Generic.Dictionary<string, object>
            {
                [KeyChunkSize] = await _sysConfig.GetAsync(KeyChunkSize, DefaultChunkSize),
                [KeyChunkOverlap] = await _sysConfig.GetAsync(KeyChunkOverlap, DefaultChunkOverlap),
                [KeyTopKChat] = await _sysConfig.GetAsync(KeyTopKChat, DefaultTopKChat),
                [KeyTopKReport] = await _sysConfig.GetAsync(KeyTopKReport, DefaultTopKReport),
                [KeySplitter] = await _sysConfig.GetAsync(KeySplitter, DefaultSplitter),
                [KeyStage1BatchChunks] = await _sysConfig.GetAsync(KeyStage1BatchChunks, DefaultStage1BatchChunks),
                [KeyStage1MaxChunkChars] = await _sysConfig.GetAsync(KeyStage1MaxChunkChars, DefaultStage1MaxChunkChars),
                [KeyFactsJsonMaxChars] = await _sysConfig.GetAsync(KeyFactsJsonMaxChars, DefaultFactsJsonMaxChars),
                [KeyBibleMaxChars] = await _sysConfig.GetAsync(KeyBibleMaxChars, DefaultBibleMaxChars),
                [KeyStoryBibleMaxChars] = await _sysConfig.GetAsync(KeyStoryBibleMaxChars, DefaultStoryBibleMaxChars),
                [KeyEstimatedTokensPerQueryEmbed] = await _sysConfig.GetAsync(KeyEstimatedTokensPerQueryEmbed, DefaultEstimatedTokensPerQueryEmbed),
                [KeyRubricBatchSize] = await _sysConfig.GetAsync(KeyRubricBatchSize, DefaultRubricBatchSize),
                [KeyAnalyzeRpmLimit] = await _sysConfig.GetAsync(KeyAnalyzeRpmLimit, DefaultAnalyzeRpmLimit)
            };

            await _sysConfig.SetAsync(KeyChunkSize,    req.ChunkSize,    userId.Value);
            await _sysConfig.SetAsync(KeyChunkOverlap, req.ChunkOverlap, userId.Value);
            await _sysConfig.SetAsync(KeyTopKChat,     req.TopKChat,     userId.Value);
            await _sysConfig.SetAsync(KeyTopKReport,   req.TopKReport,   userId.Value);
            await _sysConfig.SetAsync(KeySplitter,     req.Splitter!.ToLower(), userId.Value);

            await _sysConfig.SetAsync(KeyStage1BatchChunks, req.Stage1BatchChunks, userId.Value);
            await _sysConfig.SetAsync(KeyStage1MaxChunkChars, req.Stage1MaxChunkChars, userId.Value);
            await _sysConfig.SetAsync(KeyFactsJsonMaxChars, req.FactsJsonMaxChars, userId.Value);
            await _sysConfig.SetAsync(KeyBibleMaxChars, req.BibleMaxChars, userId.Value);
            await _sysConfig.SetAsync(KeyStoryBibleMaxChars, req.StoryBibleMaxChars, userId.Value);
            await _sysConfig.SetAsync(KeyEstimatedTokensPerQueryEmbed, req.EstimatedTokensPerQueryEmbed, userId.Value);
            await _sysConfig.SetAsync(KeyRubricBatchSize, req.RubricBatchSize, userId.Value);
            await _sysConfig.SetAsync(KeyAnalyzeRpmLimit, req.AnalyzeRpmLimit, userId.Value);

            var newConfig = new System.Collections.Generic.Dictionary<string, object>
            {
                [KeyChunkSize] = req.ChunkSize,
                [KeyChunkOverlap] = req.ChunkOverlap,
                [KeyTopKChat] = req.TopKChat,
                [KeyTopKReport] = req.TopKReport,
                [KeySplitter] = req.Splitter!.ToLower(),
                [KeyStage1BatchChunks] = req.Stage1BatchChunks,
                [KeyStage1MaxChunkChars] = req.Stage1MaxChunkChars,
                [KeyFactsJsonMaxChars] = req.FactsJsonMaxChars,
                [KeyBibleMaxChars] = req.BibleMaxChars,
                [KeyStoryBibleMaxChars] = req.StoryBibleMaxChars,
                [KeyEstimatedTokensPerQueryEmbed] = req.EstimatedTokensPerQueryEmbed,
                [KeyRubricBatchSize] = req.RubricBatchSize,
                [KeyAnalyzeRpmLimit] = req.AnalyzeRpmLimit
            };

            var metadataJson = System.Text.Json.JsonSerializer.Serialize(new { old = oldConfig, @new = newConfig });
            await _auditLog.LogAsync("Config", "RAG", "Cập nhật cấu hình RAG và hiệu năng hệ thống nâng cao", userId.Value, "Info", metadataJson);

            return Ok(new { Message = "Cấu hình RAG đã được cập nhật thành công." });
        }
    }

    public class RagConfigResponse
    {
        [JsonPropertyName("chunk_size")]    public int ChunkSize    { get; set; }
        [JsonPropertyName("chunk_overlap")] public int ChunkOverlap { get; set; }
        [JsonPropertyName("top_k_chat")]    public int TopKChat     { get; set; }
        [JsonPropertyName("top_k_report")]  public int TopKReport   { get; set; }
        [JsonPropertyName("splitter")]      public string Splitter  { get; set; } = "paragraph";

        [JsonPropertyName("stage1_batch_chunks")] public int Stage1BatchChunks { get; set; }
        [JsonPropertyName("stage1_max_chunk_chars")] public int Stage1MaxChunkChars { get; set; }
        [JsonPropertyName("facts_json_max_chars")] public int FactsJsonMaxChars { get; set; }
        [JsonPropertyName("bible_max_chars")] public int BibleMaxChars { get; set; }
        [JsonPropertyName("story_bible_max_chars")] public int StoryBibleMaxChars { get; set; }
        [JsonPropertyName("estimated_tokens_per_query_embed")] public int EstimatedTokensPerQueryEmbed { get; set; }
        [JsonPropertyName("rubric_batch_size")] public int RubricBatchSize { get; set; }
        [JsonPropertyName("analyze_rpm_limit")] public int AnalyzeRpmLimit { get; set; }
    }

    public class RagConfigRequest
    {
        [JsonPropertyName("chunk_size")]    public int ChunkSize    { get; set; }
        [JsonPropertyName("chunk_overlap")] public int ChunkOverlap { get; set; }
        [JsonPropertyName("top_k_chat")]    public int TopKChat     { get; set; }
        [JsonPropertyName("top_k_report")]  public int TopKReport   { get; set; }
        [JsonPropertyName("splitter")]      public string? Splitter { get; set; }

        [JsonPropertyName("stage1_batch_chunks")] public int Stage1BatchChunks { get; set; }
        [JsonPropertyName("stage1_max_chunk_chars")] public int Stage1MaxChunkChars { get; set; }
        [JsonPropertyName("facts_json_max_chars")] public int FactsJsonMaxChars { get; set; }
        [JsonPropertyName("bible_max_chars")] public int BibleMaxChars { get; set; }
        [JsonPropertyName("story_bible_max_chars")] public int StoryBibleMaxChars { get; set; }
        [JsonPropertyName("estimated_tokens_per_query_embed")] public int EstimatedTokensPerQueryEmbed { get; set; }
        [JsonPropertyName("rubric_batch_size")] public int RubricBatchSize { get; set; }
        [JsonPropertyName("analyze_rpm_limit")] public int AnalyzeRpmLimit { get; set; }
    }
}
