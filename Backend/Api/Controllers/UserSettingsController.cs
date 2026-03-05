using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/settings")]
    [ApiController]
    [Authorize]
    public class UserSettingsController : ControllerBase
    {
        private readonly IUserSettingsService _service;

        public UserSettingsController(IUserSettingsService service)
        {
            _service = service;
        }

        /// <summary>Lấy cài đặt editor của người dùng hiện tại.</summary>
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            var result = await _service.GetAsync(userId.Value);
            return Ok(result);
        }

        /// <summary>Cập nhật cài đặt editor.</summary>
        [HttpPut]
        public async Task<IActionResult> Update([FromBody] UpdateEditorSettingsRequest request)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            var result = await _service.UpdateAsync(userId.Value, request);
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
