using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _adminService;
        private readonly ISystemAuditLogService _auditLog;

        public AdminController(IAdminService adminService, ISystemAuditLogService auditLog)
        {
            _adminService = adminService;
            _auditLog = auditLog;
        }

        private Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }

        [HttpGet("stats/overview")]
        public async Task<IActionResult> GetOverviewStats()
        {
            try
            {
                var stats = await _adminService.GetOverviewStatsAsync();
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Lấy thống kê người dùng</summary>
        [HttpGet("users/stats")]
        public async Task<IActionResult> GetUserStats()
        {
            try
            {
                var stats = await _adminService.GetUserStatsAsync();
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpGet("users/{id:guid}")]
        public async Task<IActionResult> GetUser(Guid id)
        {
            try
            {
                return Ok(await _adminService.GetUserByIdAsync(id));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] AdminCreateUserRequest request)
        {
            try
            {
                var user = await _adminService.CreateUserAsync(request);
                return Ok(user);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPut("users/{id:guid}")]
        public async Task<IActionResult> UpdateUser(Guid id, [FromBody] AdminUpdateUserRequest request)
        {
            var adminId = GetUserId();
            if (adminId == null) return Unauthorized();

            try
            {
                var user = await _adminService.UpdateUserAsync(id, request, adminId.Value);
                return Ok(user);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpGet("logs")]
        public async Task<IActionResult> GetLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 30, [FromQuery] string? category = null, [FromQuery] string? level = null)
        {
            try
            {
                return Ok(await _auditLog.GetLogsAsync(page, pageSize, category, level));
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpGet("system/limits")]
        public async Task<IActionResult> GetSystemLimits()
        {
            try
            {
                return Ok(await _adminService.GetSystemLimitsAsync());
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPut("system/limits")]
        public async Task<IActionResult> UpdateSystemLimits([FromBody] SystemLimitsRequest request)
        {
            var adminId = GetUserId();
            if (adminId == null) return Unauthorized();

            try
            {
                return Ok(await _adminService.UpdateSystemLimitsAsync(request, adminId.Value));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpGet("revenue/dashboard")]
        public async Task<IActionResult> GetRevenueDashboard([FromQuery] int? year, [FromQuery] int? month, [FromQuery] int? planId)
        {
            var now = DateTime.UtcNow;
            var y = year ?? now.Year;
            var m = month ?? now.Month;

            try
            {
                var data = await _adminService.GetRevenueDashboardAsync(y, m, planId);
                return Ok(data);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPatch("users/{id:guid}/active")]
        public async Task<IActionResult> SetUserActive(Guid id, [FromBody] SetUserActiveRequest request)
        {
            var adminId = GetUserId();
            if (adminId == null) return Unauthorized();

            try
            {
                var user = await _adminService.SetUserActiveAsync(id, request.IsActive, adminId.Value);
                return Ok(user);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpDelete("users/{id:guid}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            var adminId = GetUserId();
            if (adminId == null) return Unauthorized();

            try
            {
                await _adminService.DeleteUserAsync(id, adminId.Value);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }
    }
}
