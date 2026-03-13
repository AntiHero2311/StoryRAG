using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    public class PaymentController : ControllerBase
    {
        private readonly IPaymentService _paymentService;
        private readonly ILogger<PaymentController> _logger;

        public PaymentController(IPaymentService paymentService, ILogger<PaymentController> logger)
        {
            _paymentService = paymentService;
            _logger = logger;
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
                throw new UnauthorizedAccessException("Invalid user context");
            return userId;
        }

        /// <summary>Tạo payment record mới</summary>
        [HttpPost("create")]
        public async Task<IActionResult> CreatePayment([FromBody] CreatePaymentRequest request)
        {
            try
            {
                var userId = GetUserId();
                var payment = await _paymentService.CreatePaymentAsync(userId, request);
                return Ok(new { success = true, data = payment });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error creating payment: {ex.Message}");
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        /// <summary>Cập nhật trạng thái payment</summary>
        [HttpPatch("{paymentId}/status")]
        public async Task<IActionResult> UpdatePaymentStatus(
            [FromRoute] Guid paymentId,
            [FromBody] UpdatePaymentStatusRequest request)
        {
            try
            {
                var userId = GetUserId();
                var payment = await _paymentService.UpdatePaymentStatusAsync(paymentId, userId, request);
                return Ok(new { success = true, data = payment });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error updating payment status: {ex.Message}");
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        /// <summary>Lấy lịch sử thanh toán của user</summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetPaymentHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var userId = GetUserId();
                var history = await _paymentService.GetPaymentHistoryAsync(userId, page, pageSize);
                return Ok(new { success = true, data = history });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching payment history: {ex.Message}");
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        /// <summary>Lấy chi tiết payment cụ thể</summary>
        [HttpGet("{paymentId}")]
        public async Task<IActionResult> GetPaymentById([FromRoute] Guid paymentId)
        {
            try
            {
                var userId = GetUserId();
                var payment = await _paymentService.GetPaymentByIdAsync(paymentId, userId);
                return Ok(new { success = true, data = payment });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching payment: {ex.Message}");
                return NotFound(new { success = false, error = ex.Message });
            }
        }

        /// <summary>Đánh dấu payment là "Completed" (khi thanh toán thành công từ gateway)</summary>
        [HttpPut("{paymentId}/mark-completed")]
        public async Task<IActionResult> MarkAsCompleted(
            [FromRoute] Guid paymentId,
            [FromBody] string? transactionId = null)
        {
            try
            {
                var payment = await _paymentService.MarkAsCompletedAsync(paymentId, transactionId);
                return Ok(new { success = true, data = payment });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error marking payment as completed: {ex.Message}");
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        /// <summary>Refund một payment (chỉ có thể refund "Completed" payments)</summary>
        [HttpPost("{paymentId}/refund")]
        public async Task<IActionResult> RefundPayment([FromRoute] Guid paymentId)
        {
            try
            {
                var userId = GetUserId();
                var payment = await _paymentService.RefundPaymentAsync(paymentId, userId);
                return Ok(new { success = true, data = payment });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error refunding payment: {ex.Message}");
                return BadRequest(new { success = false, error = ex.Message });
            }
        }
    }
}
