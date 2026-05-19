using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Linq;
using System.Security.Claims;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    public class PaymentController : AppControllerBase
    {
        private readonly IPaymentService _paymentService;
        private readonly ILogger<PaymentController> _logger;

        public PaymentController(IPaymentService paymentService, ILogger<PaymentController> logger)
        {
            _paymentService = paymentService;
            _logger = logger;
        }


        /// <summary>Tạo payment record mới</summary>
        [HttpPost("create")]
        public async Task<IActionResult> CreatePayment([FromBody] CreatePaymentRequest request)
        {
            try
            {
                var userId = GetRequiredUserId();
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
                var userId = GetRequiredUserId();
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
                var userId = GetRequiredUserId();
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
                var userId = GetRequiredUserId();
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
            [FromQuery] string? transactionId = null)
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
                var userId = GetRequiredUserId();
                var payment = await _paymentService.RefundPaymentAsync(paymentId, userId);
                return Ok(new { success = true, data = payment });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error refunding payment: {ex.Message}");
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        /// <summary>Tạo URL checkout VNPay cho gói trả phí</summary>
        [HttpPost("vnpay/create-url")]
        public async Task<IActionResult> CreateVnPayUrl([FromBody] CreateVnPayPaymentUrlRequest request)
        {
            try
            {
                var userId = GetRequiredUserId();
                var result = await _paymentService.CreateVnPayPaymentUrlAsync(userId, request);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError("Error creating VNPay URL: {Message}", ex.Message);
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        /// <summary>IPN callback từ VNPay</summary>
        [AllowAnonymous]
        [HttpGet("vnpay/ipn")]
        public async Task<IActionResult> ReceiveVnPayIpn()
        {
            try
            {
                var query = Request.Query.ToDictionary(kvp => kvp.Key, kvp => (string?)kvp.Value.ToString(), StringComparer.Ordinal);
                await _paymentService.HandleVnPayIpnAsync(query);
                return Ok(new { RspCode = "00", Message = "Confirm Success" });
            }
            catch (Exception ex)
            {
                _logger.LogError("Error processing VNPay IPN: {Message}", ex.Message);
                return Ok(new { RspCode = "99", Message = ex.Message });
            }
        }

        /// <summary>Lấy trạng thái đơn VNPay theo txnRef</summary>
        [HttpGet("vnpay/order/{txnRef}")]
        public async Task<IActionResult> GetVnPayOrderStatus([FromRoute] string txnRef)
        {
            try
            {
                var userId = GetRequiredUserId();
                var result = await _paymentService.GetVnPayOrderStatusAsync(userId, txnRef);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError("Error getting VNPay order status: {Message}", ex.Message);
                return NotFound(new { success = false, error = ex.Message });
            }
        }
    }
}
