using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class PaymentService : IPaymentService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<PaymentService> _logger;

        public PaymentService(AppDbContext context, ILogger<PaymentService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<PaymentResponse> CreatePaymentAsync(Guid userId, CreatePaymentRequest request)
        {
            // Verify user exists
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception($"User {userId} not found");

            // Verify subscription plan exists
            var plan = await _context.SubscriptionPlans.FindAsync(request.PlanId);
            if (plan == null)
                throw new Exception($"Subscription Plan {request.PlanId} not found");

            var payment = new Payment
            {
                UserId = userId,
                PlanId = request.PlanId,
                Amount = request.Amount,
                PaymentMethod = request.PaymentMethod,
                Status = "Pending",
                TransactionId = request.TransactionId,
                Description = request.Description,
                CreatedAt = DateTime.UtcNow
            };

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Payment created: {payment.Id} for user {userId}");

            return MapToResponse(payment, plan.PlanName);
        }

        public async Task<PaymentResponse> UpdatePaymentStatusAsync(Guid paymentId, Guid userId, UpdatePaymentStatusRequest request)
        {
            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);

            if (payment == null)
                throw new Exception($"Payment {paymentId} not found");

            payment.Status = request.Status;
            payment.UpdatedAt = DateTime.UtcNow;

            if (request.Status == "Completed")
                payment.PaidAt = DateTime.UtcNow;
            else if (request.Status == "Refunded")
                payment.RefundedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Payment {paymentId} status updated to {request.Status}");

            return MapToResponse(payment, payment.Plan.PlanName);
        }

        public async Task<PaymentHistoryResponse> GetPaymentHistoryAsync(Guid userId, int page = 1, int pageSize = 20)
        {
            var query = _context.Payments
                .Include(p => p.Plan)
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.CreatedAt);

            var totalCount = await query.CountAsync();
            var payments = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var totalSpent = await _context.Payments
                .Where(p => p.UserId == userId && p.Status == "Completed")
                .SumAsync(p => p.Amount);

            var statusSummary = await _context.Payments
                .Where(p => p.UserId == userId)
                .GroupBy(p => p.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Status, g => g.Count);

            return new PaymentHistoryResponse
            {
                Payments = payments.Select(p => MapToResponse(p, p.Plan.PlanName)).ToList(),
                TotalCount = totalCount,
                TotalSpent = totalSpent,
                StatusSummary = statusSummary
            };
        }

        public async Task<PaymentResponse> GetPaymentByIdAsync(Guid paymentId, Guid userId)
        {
            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);

            if (payment == null)
                throw new Exception($"Payment {paymentId} not found");

            return MapToResponse(payment, payment.Plan.PlanName);
        }

        public async Task<PaymentResponse?> GetPaymentByTransactionIdAsync(string transactionId)
        {
            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.TransactionId == transactionId);

            return payment == null ? null : MapToResponse(payment, payment.Plan.PlanName);
        }

        public async Task<PaymentResponse> MarkAsCompletedAsync(Guid paymentId, string? transactionId = null)
        {
            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.Id == paymentId);

            if (payment == null)
                throw new Exception($"Payment {paymentId} not found");

            payment.Status = "Completed";
            payment.PaidAt = DateTime.UtcNow;
            payment.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(transactionId))
                payment.TransactionId = transactionId;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Payment {paymentId} marked as completed");

            return MapToResponse(payment, payment.Plan.PlanName);
        }

        public async Task<PaymentResponse> RefundPaymentAsync(Guid paymentId, Guid userId)
        {
            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);

            if (payment == null)
                throw new Exception($"Payment {paymentId} not found");

            if (payment.Status != "Completed")
                throw new Exception($"Can only refund completed payments. Current status: {payment.Status}");

            payment.Status = "Refunded";
            payment.RefundedAt = DateTime.UtcNow;
            payment.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Payment {paymentId} refunded");

            return MapToResponse(payment, payment.Plan.PlanName);
        }

        private PaymentResponse MapToResponse(Payment payment, string? planName = null)
        {
            return new PaymentResponse
            {
                Id = payment.Id,
                UserId = payment.UserId,
                SubscriptionId = payment.SubscriptionId,
                PlanId = payment.PlanId,
                PlanName = planName,
                Amount = payment.Amount,
                Currency = payment.Currency,
                PaymentMethod = payment.PaymentMethod,
                Status = payment.Status,
                TransactionId = payment.TransactionId,
                Description = payment.Description,
                PaidAt = payment.PaidAt,
                RefundedAt = payment.RefundedAt,
                CreatedAt = payment.CreatedAt,
                UpdatedAt = payment.UpdatedAt
            };
        }
    }
}
