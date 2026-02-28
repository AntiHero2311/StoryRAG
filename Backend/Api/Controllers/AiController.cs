using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

        public AiController(IEmbeddingService embeddingService, IAiChatService aiChatService)
        {
            _embeddingService = embeddingService;
            _aiChatService = aiChatService;
        }

        /// <summary>Embed tất cả chunks của current version của một chương.</summary>
        [HttpPost("chapters/{chapterId:guid}/embed")]
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

        private Guid? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }

    public class ChatRequest
    {
        [Required]
        [MinLength(1)]
        public string Question { get; set; } = string.Empty;
    }
}
