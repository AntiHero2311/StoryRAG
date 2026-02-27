using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/subscription")]
    [ApiController]
    public class SubscriptionController : ControllerBase
    {
        private readonly ISubscriptionService _subscriptionService;

        public SubscriptionController(ISubscriptionService subscriptionService)
        {
            _subscriptionService = subscriptionService;
        }

        // ── Plans (public / admin) ────────────────────────────────────────────

        /// <summary>Lấy tất cả plan đang active. Admin có thể xem cả inactive.</summary>
        [HttpGet("plans")]
        [Authorize]
        public async Task<IActionResult> GetAllPlans([FromQuery] bool includeInactive = false)
        {
            var isAdmin = User.IsInRole("Admin");
            if (includeInactive && !isAdmin)
                return Forbid();

            var plans = await _subscriptionService.GetAllPlansAsync(includeInactive);
            return Ok(plans);
        }

        /// <summary>Chi tiết một plan.</summary>
        [HttpGet("plans/{id:int}")]
        [Authorize]
        public async Task<IActionResult> GetPlanById(int id)
        {
            try
            {
                var plan = await _subscriptionService.GetPlanByIdAsync(id);
                return Ok(plan);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
        }

        /// <summary>Tạo plan mới — chỉ Admin.</summary>
        [HttpPost("plans")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreatePlan([FromBody] CreatePlanRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var plan = await _subscriptionService.CreatePlanAsync(request);
                return CreatedAtAction(nameof(GetPlanById), new { id = plan.Id }, plan);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>Cập nhật plan — chỉ Admin.</summary>
        [HttpPut("plans/{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdatePlan(int id, [FromBody] UpdatePlanRequest request)
        {
            try
            {
                var plan = await _subscriptionService.UpdatePlanAsync(id, request);
                return Ok(plan);
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

        /// <summary>Deactivate plan — chỉ Admin.</summary>
        [HttpDelete("plans/{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeletePlan(int id)
        {
            try
            {
                await _subscriptionService.DeletePlanAsync(id);
                return Ok(new { Message = "Plan đã được deactivate." });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
        }

        // ── My Subscription ────────────────────────────────────────────────────

        /// <summary>Đăng ký một plan. Nếu là Free plan (Price=0) sẽ tự động Active.</summary>
        [HttpPost("subscribe")]
        [Authorize]
        public async Task<IActionResult> Subscribe([FromBody] SubscribePlanRequest request)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            try
            {
                var sub = await _subscriptionService.SubscribeToPlanAsync(userId.Value, request.PlanId);
                return Ok(sub);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>Xem subscription hiện tại của user đang đăng nhập.</summary>
        [HttpGet("my")]
        [Authorize]
        public async Task<IActionResult> GetMySubscription()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var sub = await _subscriptionService.GetMySubscriptionAsync(userId.Value);
            if (sub == null)
                return Ok(new { Message = "Bạn chưa có gói đăng ký nào đang hoạt động.", Subscription = (object?)null });

            return Ok(sub);
        }

        // ── Helper ────────────────────────────────────────────────────────────

        private Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }
}
