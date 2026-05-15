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
    public class StaffController : AppControllerBase
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

        [HttpGet("flagged-projects")]
        public async Task<IActionResult> GetFlaggedProjects(
            [FromQuery] int page = 1,
            [FromQuery(Name = "page_size")] int pageSize = 20)
        {
            var result = await _staffService.GetFlaggedProjectsAsync(page, pageSize);
            return Ok(result);
        }

        [HttpGet("feedback")]
        public async Task<IActionResult> GetFeedbacks([FromQuery] Guid? projectId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _staffService.GetFeedbacksAsync(projectId, page, pageSize);
            return Ok(result);
        }

        [HttpPost("feedback")]
        public async Task<IActionResult> CreateFeedback([FromBody] StaffFeedbackCreateRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            try
            {
                var result = await _staffService.CreateFeedbackAsync(staffId.Value, request);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
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

        [HttpGet("analyses/pending")]
        public async Task<IActionResult> GetPendingReports([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _staffService.GetPendingReportsAsync(page, pageSize);
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

        [HttpGet("analyses/{reportId:guid}/review")]
        public async Task<IActionResult> GetAnalysisReviewSingle(Guid reportId)
        {
            var result = await _staffService.GetAnalysisReviewsAsync(reportId, 1, 1);
            return Ok(result);
        }

        /// <summary>Staff lấy chi tiết một report phân tích để xem/chỉnh sửa (bao gồm CriteriaJson gốc AI).</summary>
        [HttpGet("analyses/{reportId:guid}")]
        public async Task<IActionResult> GetReportDetail(Guid reportId)
        {
            try
            {
                var result = await _staffService.GetReportDetailAsync(reportId);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Staff chỉnh sửa nội dung text của các tiêu chí trong report (không thay đổi điểm số AI).
        /// Sau khi chỉnh sửa, có thể phát hành (Release) cho user xem ngay.
        /// </summary>
        [HttpPatch("analyses/{reportId:guid}/edit")]
        public async Task<IActionResult> EditReport(Guid reportId, [FromBody] StaffEditReportRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            try
            {
                var result = await _staffService.EditReportAsync(reportId, staffId.Value, request);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Message = ex.Message });
            }
        }

        // GET /api/staff/analysis-jobs?status=failed,stale
        [HttpGet("analysis-jobs")]
        public async Task<IActionResult> GetAnalysisJobs([FromQuery] string? status)
        {
            var result = await _staffService.GetAnalysisJobsAsync(status);
            return Ok(result);
        }

        // POST /api/staff/analysis-jobs/{id}/rerun
        [HttpPost("analysis-jobs/{id:guid}/rerun")]
        public async Task<IActionResult> RerunAnalysisJob(Guid id)
        {
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            try
            {
                var result = await _staffService.RerunAnalysisJobAsync(id, staffId.Value);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
        }

    }
}
