using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/staff")]
    [ApiController]
    [Authorize(Roles = "Staff,Admin")]
    public class StaffController : ControllerBase
    {
        private readonly IStaffService _staffService;

        public StaffController(IStaffService staffService)
        {
            _staffService = staffService;
        }

        [HttpGet("manuscripts/flagged")]
        public async Task<IActionResult> GetFlaggedManuscripts([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _staffService.GetFlaggedManuscriptsAsync(page, pageSize);
            return Ok(result);
        }

        [HttpGet("feedback")]
        public async Task<IActionResult> GetFeedbacks([FromQuery] Guid? projectId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _staffService.GetFeedbacksAsync(projectId, page, pageSize);
            return Ok(result);
        }

        [HttpPost("feedback")]
        public async Task<IActionResult> CreateFeedback([FromBody] StaffFeedbackRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var result = await _staffService.CreateFeedbackAsync(staffId.Value, request);
            return Ok(result);
        }

        [HttpPut("feedback/{feedbackId:guid}")]
        public async Task<IActionResult> UpdateFeedback(Guid feedbackId, [FromBody] StaffFeedbackRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var result = await _staffService.UpdateFeedbackAsync(feedbackId, staffId.Value, request);
            return Ok(result);
        }

        [HttpDelete("feedback/{feedbackId:guid}")]
        public async Task<IActionResult> DeleteFeedback(Guid feedbackId)
        {
            await _staffService.DeleteFeedbackAsync(feedbackId);
            return NoContent();
        }

        [HttpGet("knowledge-base")]
        public async Task<IActionResult> GetKnowledgeBase([FromQuery] string? type, [FromQuery] bool? isPublished, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _staffService.GetKnowledgeBaseAsync(type, isPublished, page, pageSize);
            return Ok(result);
        }

        [HttpPost("knowledge-base")]
        public async Task<IActionResult> CreateKnowledgeBase([FromBody] StaffContentRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var result = await _staffService.CreateKnowledgeBaseItemAsync(staffId.Value, request);
            return Ok(result);
        }

        [HttpPut("knowledge-base/{id:guid}")]
        public async Task<IActionResult> UpdateKnowledgeBase(Guid id, [FromBody] StaffContentRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var result = await _staffService.UpdateKnowledgeBaseItemAsync(id, staffId.Value, request);
            return Ok(result);
        }

        [HttpDelete("knowledge-base/{id:guid}")]
        public async Task<IActionResult> DeleteKnowledgeBase(Guid id)
        {
            await _staffService.DeleteKnowledgeBaseItemAsync(id);
            return NoContent();
        }

        [HttpGet("analyses/reviews")]
        public async Task<IActionResult> GetAnalysisReviews([FromQuery] Guid? projectId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _staffService.GetAnalysisReviewsAsync(projectId, page, pageSize);
            return Ok(result);
        }

        [HttpPost("analyses/{reportId:guid}/review")]
        public async Task<IActionResult> ReviewAnalysis(Guid reportId, [FromBody] ReviewAnalysisRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var result = await _staffService.ReviewAnalysisAsync(reportId, staffId.Value, request);
            return Ok(result);
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }
}
