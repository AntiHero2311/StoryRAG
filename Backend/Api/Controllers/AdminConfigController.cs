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

        // Defaults — mirrors those used in EmbeddingService / ProjectReportService
        private const int DefaultChunkSize = 800;
        private const int DefaultChunkOverlap = 100;
        private const int DefaultTopKChat = 5;
        private const int DefaultTopKReport = 8;
        private const string DefaultSplitter = "paragraph";

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

            return Ok(new RagConfigResponse
            {
                ChunkSize    = chunkSize,
                ChunkOverlap = chunkOverlap,
                TopKChat     = topKChat,
                TopKReport   = topKReport,
                Splitter     = splitter,
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

            if (errors.Count > 0)
                return BadRequest(new { Message = "Validation thất bại.", Errors = errors });

            // Parse admin identity
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không xác định được danh tính admin." });

            await _sysConfig.SetAsync(KeyChunkSize,    req.ChunkSize,    userId);
            await _sysConfig.SetAsync(KeyChunkOverlap, req.ChunkOverlap, userId);
            await _sysConfig.SetAsync(KeyTopKChat,     req.TopKChat,     userId);
            await _sysConfig.SetAsync(KeyTopKReport,   req.TopKReport,   userId);
            await _sysConfig.SetAsync(KeySplitter,     req.Splitter!.ToLower(), userId);
            await _auditLog.LogAsync("Config", "RAG", "Cập nhật cấu hình RAG", userId);

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
    }

    public class RagConfigRequest
    {
        [JsonPropertyName("chunk_size")]    public int ChunkSize    { get; set; }
        [JsonPropertyName("chunk_overlap")] public int ChunkOverlap { get; set; }
        [JsonPropertyName("top_k_chat")]    public int TopKChat     { get; set; }
        [JsonPropertyName("top_k_report")]  public int TopKReport   { get; set; }
        [JsonPropertyName("splitter")]      public string? Splitter { get; set; }
    }
}
