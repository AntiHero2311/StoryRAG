using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [Route("api/bug-reports")]
    [ApiController]
    [Authorize]
    public class BugReportController : AppControllerBase
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

        /// <summary>Tải lên ảnh lỗi (mọi user đã đăng nhập, tối đa 5MB).</summary>
        [HttpPost("upload")]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "File tải lên không hợp lệ." });

            // 5MB limit
            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { Message = "Dung lượng ảnh tối đa là 5MB." });

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest(new { Message = "Chỉ chấp nhận các định dạng ảnh: .jpg, .jpeg, .png, .gif, .webp." });

            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "bug-reports");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var uniqueFileName = $"{Guid.NewGuid()}{extension}";
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var imageUrl = $"/uploads/bug-reports/{uniqueFileName}";
                return Ok(new { ImageUrl = imageUrl });
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

    }
}
