using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Service.Interfaces;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/ai")]
    [ApiController]
    [Authorize]
    public class AiController : ControllerBase
    {
        private readonly IEmbeddingService _embeddingService;
        private readonly IAiChatService _aiChatService;
        private readonly IProjectReportService _reportService;
        private readonly IAiRewriteService _rewriteService;
        private readonly IAiWritingService _writingService;
        private readonly IAiAnalysisHistoryService _historyService;

        public AiController(IEmbeddingService embeddingService, IAiChatService aiChatService, IProjectReportService reportService, IAiRewriteService rewriteService, IAiWritingService writingService, IAiAnalysisHistoryService historyService)
        {
            _embeddingService = embeddingService;
            _aiChatService = aiChatService;
            _reportService = reportService;
            _rewriteService = rewriteService;
            _writingService = writingService;
            _historyService = historyService;
        }

        /// <summary>Embed tất cả chunks của current version của một chương.</summary>
        [HttpPost("chapters/{chapterId:guid}/embed")]
        [EnableRateLimiting("AiEmbed")]
        public async Task<IActionResult> EmbedChapter(Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                await _embeddingService.EmbedChapterAsync(chapterId, userId.Value);
                return Ok(new { Message = "Embedding hoàn tất." });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>AI Chat — hỏi đáp về nội dung dự án truyện.</summary>
        [HttpPost("{projectId:guid}/chat")]
        [EnableRateLimiting("AiChat")]
        public async Task<IActionResult> Chat(Guid projectId, [FromBody] ChatRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _aiChatService.ChatAsync(projectId, request.Question, userId.Value);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>Lấy lịch sử chat của user trong một dự án.</summary>
        [HttpGet("{projectId:guid}/chat/history")]
        public async Task<IActionResult> GetChatHistory(Guid projectId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                pageSize = Math.Clamp(pageSize, 1, 100);
                var result = await _aiChatService.GetChatHistoryAsync(projectId, userId.Value, page, pageSize);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }

        // ── Project Report endpoints ───────────────────────────────────────────────

        /// <summary>Phân tích bộ truyện theo rubric 100 điểm và lưu kết quả.</summary>
        [HttpPost("{projectId:guid}/analyze")]
        [EnableRateLimiting("AiAnalyze")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> Analyze(Guid projectId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _reportService.AnalyzeAsync(projectId, userId.Value);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>Lấy report phân tích mới nhất của dự án.</summary>
        [HttpGet("{projectId:guid}/reports/latest")]
        public async Task<IActionResult> GetLatestReport(Guid projectId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _reportService.GetLatestAsync(projectId, userId.Value);
                if (result == null) return NotFound(new { Message = "Chưa có báo cáo nào cho dự án này." });
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>Lấy lịch sử tất cả report của dự án.</summary>
        [HttpGet("{projectId:guid}/reports")]
        public async Task<IActionResult> GetReports(Guid projectId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _reportService.GetAllAsync(projectId, userId.Value);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>Lấy report theo ID.</summary>
        [HttpGet("{projectId:guid}/reports/{reportId:guid}")]
        public async Task<IActionResult> GetReportById(Guid projectId, Guid reportId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _reportService.GetByIdAsync(reportId, projectId, userId.Value);
                if (result == null) return NotFound(new { Message = "Không tìm thấy báo cáo." });
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        // ── Rewrite endpoints ─────────────────────────────────────────────────────

        /// <summary>Viết lại một đoạn văn bằng AI, lưu lịch sử.</summary>
        [HttpPost("{projectId:guid}/rewrite")]
        [EnableRateLimiting("AiRewrite")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> Rewrite(Guid projectId, [FromBody] RewriteRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _rewriteService.RewriteAsync(
                    projectId, request.ChapterId, request.OriginalText, request.Instruction ?? string.Empty, userId.Value);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>Lấy lịch sử viết lại của user trong một dự án.</summary>
        [HttpGet("{projectId:guid}/rewrite/history")]
        public async Task<IActionResult> GetRewriteHistory(
            Guid projectId,
            [FromQuery] Guid? chapterId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                pageSize = Math.Clamp(pageSize, 1, 100);
                var result = await _rewriteService.GetHistoryAsync(projectId, userId.Value, chapterId, page, pageSize);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }
        // ── Writing endpoints ─────────────────────────────────────────────────────

        [HttpPost("{projectId:guid}/write")]
        [EnableRateLimiting("AiRewrite")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> WriteNew(Guid projectId, [FromBody] AiWriteRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _writingService.WriteNewAsync(projectId, request.Instruction, userId.Value);
                return Ok(result);
            }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        [HttpPost("{projectId:guid}/continue")]
        [EnableRateLimiting("AiRewrite")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> ContinueWriting(Guid projectId, [FromBody] AiContinueRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _writingService.ContinueWritingAsync(projectId, request.PreviousText, request.Instruction, userId.Value);
                return Ok(result);
            }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        [HttpPost("{projectId:guid}/polish")]
        [EnableRateLimiting("AiRewrite")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> Polish(Guid projectId, [FromBody] AiPolishRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _writingService.PolishAsync(projectId, request.OriginalText, request.Instruction, userId.Value);
                return Ok(result);
            }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        [HttpPost("{projectId:guid}/suggest")]
        [EnableRateLimiting("AiRewrite")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> Suggest(Guid projectId, [FromBody] AiSuggestRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _writingService.SuggestAsync(projectId, request.Context, request.TargetType, userId.Value);
                return Ok(result);
            }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>Phân rã nội dung chương thành danh sách Cảnh bằng AI.</summary>
        [HttpPost("{projectId:guid}/scenes")]
        [EnableRateLimiting("AiRewrite")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> AnalyzeScenes(Guid projectId, [FromBody] AiAnalyzeContentRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _writingService.AnalyzeScenesAsync(projectId, request.Content, userId.Value);
                
                // Save history
                var json = System.Text.Json.JsonSerializer.Serialize(result);
                await _historyService.SaveHistoryAsync(projectId, request.ChapterId, userId.Value, "Scenes", json, result.TotalTokens);

                return Ok(result);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        /// <summary>Phân tích cấu trúc 3 hồi và phát hiện Cliffhanger của chương.</summary>
        [HttpPost("{projectId:guid}/cliffhanger")]
        [EnableRateLimiting("AiRewrite")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongRunning")]
        public async Task<IActionResult> AnalyzeCliffhanger(Guid projectId, [FromBody] AiAnalyzeContentRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var result = await _writingService.AnalyzeCliffhangerAsync(projectId, request.Content, userId.Value);
                
                // Save history
                var json = System.Text.Json.JsonSerializer.Serialize(result);
                await _historyService.SaveHistoryAsync(projectId, request.ChapterId, userId.Value, "Cliffhanger", json, result.TotalTokens);

                return Ok(result);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }
        /// <summary>Lấy lịch sử phân tích cảnh và hạ hồi phân giải.</summary>
        [HttpGet("{projectId:guid}/analysis/history")]
        public async Task<IActionResult> GetAnalysisHistory(
            Guid projectId,
            [FromQuery] string type,
            [FromQuery] Guid? chapterId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                pageSize = Math.Clamp(pageSize, 1, 100);
                var result = await _historyService.GetHistoryAsync(projectId, userId.Value, type, chapterId, page, pageSize);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }
    }

    public class ChatRequest
    {
        [Required]
        [MinLength(1)]
        [MaxLength(2000)]
        public string Question { get; set; } = string.Empty;
    }

    public class RewriteRequest
    {
        [Required]
        [MinLength(1)]
        [MaxLength(50_000)]
        public string OriginalText { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Instruction { get; set; }

        public Guid? ChapterId { get; set; }
    }

    public class AiWriteRequest
    {
        [Required]
        [MaxLength(5000)]
        public string Instruction { get; set; } = string.Empty;
    }

    public class AiContinueRequest
    {
        [Required]
        public string PreviousText { get; set; } = string.Empty;

        [MaxLength(5000)]
        public string Instruction { get; set; } = string.Empty;
    }

    public class AiPolishRequest
    {
        [Required]
        public string OriginalText { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string Instruction { get; set; } = string.Empty;
    }

    public class AiSuggestRequest
    {
        [Required]
        public string Context { get; set; } = string.Empty;
        
        [Required]
        public string TargetType { get; set; } = string.Empty;
    }

    public class AiAnalyzeContentRequest
    {
        /// <summary>Nội dung chương/đoạn văn cần phân tích (tối đa ~15.000 ký tự sẽ được đọc)</summary>
        [Required]
        [MinLength(50, ErrorMessage = "Nội dung phải có ít nhất 50 ký tự để phân tích.")]
        public string Content { get; set; } = string.Empty;

        public Guid? ChapterId { get; set; }
    }
}
