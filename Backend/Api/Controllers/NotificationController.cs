using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/notifications")]
    [ApiController]
    [Authorize(Roles = "Author,Staff,Admin")]
    public class NotificationController : AppControllerBase
    {
        private readonly INotificationService _notificationService;

        public NotificationController(INotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        [HttpGet]
        public async Task<IActionResult> GetMine([FromQuery] int limit = 50)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var result = await _notificationService.GetMyAsync(userId.Value, limit, HttpContext.RequestAborted);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] NotificationCreateRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            try
            {
                var result = await _notificationService.CreateAsync(userId.Value, request, HttpContext.RequestAborted);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPost("{id:guid}/mark-read")]
        public async Task<IActionResult> MarkRead(Guid id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var result = await _notificationService.MarkReadAsync(userId.Value, id, HttpContext.RequestAborted);
            if (result == null) return NotFound(new { Message = "Không tìm thấy thông báo." });
            return Ok(result);
        }

        [HttpPost("mark-all-read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var count = await _notificationService.MarkAllReadAsync(userId.Value, HttpContext.RequestAborted);
            return Ok(new { ReadCount = count });
        }

    }
}
