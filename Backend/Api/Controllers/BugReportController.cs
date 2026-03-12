using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [Route("api/bug-reports")]
    [ApiController]
    [Authorize]
    public class BugReportController : ControllerBase
    {
        private readonly IBugReportService _service;

        public BugReportController(IBugReportService service)
        {
            _service = service;
        }

        // ── Author endpoints ──────────────────────────────────────────────────────

        /// <summary>Tạo báo cáo lỗi mới (mọi user đã đăng nhập).</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBugReportRequest request)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            try
            {
                var result = await _service.CreateAsync(userId.Value, request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>Xem danh sách báo cáo của chính mình.</summary>
        [HttpGet("my")]
        public async Task<IActionResult> GetMy()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var result = await _service.GetMyReportsAsync(userId.Value);
            return Ok(result);
        }

        // ── Staff / Admin endpoints ───────────────────────────────────────────────

        /// <summary>Xem toàn bộ báo cáo (Staff + Admin).</summary>
        [HttpGet]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null)
        {
            var result = await _service.GetAllAsync(status);
            return Ok(result);
        }

        /// <summary>Thống kê tổng quan (Staff + Admin).</summary>
        [HttpGet("stats")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> GetStats()
        {
            var result = await _service.GetStatsAsync();
            return Ok(result);
        }

        /// <summary>Cập nhật trạng thái + ghi chú của báo cáo (Staff + Admin).</summary>
        [HttpPut("{reportId:guid}")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> UpdateStatus(Guid reportId, [FromBody] UpdateBugReportRequest request)
        {
            var staffId = GetUserId();
            if (staffId == null) return Unauthorized();

            try
            {
                var result = await _service.UpdateStatusAsync(reportId, staffId.Value, request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>Xoá báo cáo (Admin only).</summary>
        [HttpDelete("{reportId:guid}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(Guid reportId)
        {
            try
            {
                await _service.DeleteAsync(reportId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }
}
