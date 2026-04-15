using System.Globalization;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Repository.Data;
using Repository.Entities;
using Service.Configuration;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class PaymentService : IPaymentService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<PaymentService> _logger;
        private readonly ISubscriptionService _subscriptionService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly PayOsOptions _payOsOptions;
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public PaymentService(
            AppDbContext context,
            ILogger<PaymentService> logger,
            ISubscriptionService subscriptionService,
            IHttpClientFactory httpClientFactory,
            IOptions<PayOsOptions> payOsOptions)
        {
            _context = context;
            _logger = logger;
            _subscriptionService = subscriptionService;
            _httpClientFactory = httpClientFactory;
            _payOsOptions = payOsOptions.Value;
        }

        public async Task<PaymentResponse> CreatePaymentAsync(Guid userId, CreatePaymentRequest request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception($"User {userId} not found");

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

            _logger.LogInformation("Payment created: {PaymentId} for user {UserId}", payment.Id, userId);
            return MapToResponse(payment, plan.PlanName);
        }

        public async Task<CreatePayOsPaymentLinkResponse> CreatePayOsPaymentLinkAsync(Guid userId, CreatePayOsPaymentLinkRequest request)
        {
            EnsurePayOsConfigured();

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception($"User {userId} not found");

            var plan = await _context.SubscriptionPlans.FindAsync(request.PlanId);
            if (plan == null)
                throw new Exception($"Subscription Plan {request.PlanId} not found");

            if (!plan.IsActive)
                throw new Exception("Plan này hiện không khả dụng.");

            if (plan.Price <= 0)
                throw new Exception("Gói miễn phí không cần thanh toán PayOS.");

            if (plan.Price != decimal.Truncate(plan.Price))
                throw new Exception("Số tiền thanh toán phải là số nguyên VND.");

            var amount = (int)plan.Price;
            var orderCode = await GenerateUniqueOrderCodeAsync();
            var orderCodeText = orderCode.ToString(CultureInfo.InvariantCulture);
            var description = BuildPayOsDescription(request.PlanId, userId);
            var signatureData =
                $"amount={amount}&cancelUrl={_payOsOptions.CancelUrl}&description={description}&orderCode={orderCodeText}&returnUrl={_payOsOptions.ReturnUrl}";
            var signature = ComputeHmacSha256(_payOsOptions.ChecksumKey, signatureData);

            var payment = new Payment
            {
                UserId = userId,
                PlanId = request.PlanId,
                Amount = plan.Price,
                Currency = "VND",
                PaymentMethod = "PayOS",
                Status = "Pending",
                TransactionId = orderCodeText,
                Description = $"PayOS order {orderCodeText}",
                CreatedAt = DateTime.UtcNow
            };

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();

            var payOsRequest = new PayOsCreatePaymentRequest
            {
                OrderCode = orderCode,
                Amount = amount,
                Description = description,
                ReturnUrl = _payOsOptions.ReturnUrl,
                CancelUrl = _payOsOptions.CancelUrl,
                Signature = signature,
                BuyerName = user.FullName,
                BuyerEmail = user.Email,
                Items =
                [
                    new PayOsItem
                    {
                        Name = $"{plan.PlanName} plan",
                        Quantity = 1,
                        Price = amount
                    }
                ]
            };

            var payOsResponse = await CreatePayOsLinkAsync(payOsRequest);
            payment.UpdatedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(payOsResponse.Data.PaymentLinkId))
            {
                payment.Description = $"PayOS order {orderCodeText} | Link {payOsResponse.Data.PaymentLinkId}";
            }
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created PayOS link for payment {PaymentId}, orderCode {OrderCode}", payment.Id, orderCode);

            return new CreatePayOsPaymentLinkResponse
            {
                PaymentId = payment.Id,
                OrderCode = orderCode,
                CheckoutUrl = payOsResponse.Data.CheckoutUrl,
                QrCode = payOsResponse.Data.QrCode,
                Amount = payment.Amount,
                Description = description
            };
        }

        public async Task<PayOsWebhookProcessResponse> HandlePayOsWebhookAsync(PayOsWebhookPayload payload)
        {
            EnsurePayOsConfigured();

            if (string.IsNullOrWhiteSpace(payload.Signature))
                throw new Exception("Thiếu chữ ký webhook.");

            if (payload.Data.ValueKind != JsonValueKind.Object)
                throw new Exception("Webhook data không hợp lệ.");

            var signedData = BuildPayOsSignatureData(payload.Data);
            var expectedSignature = ComputeHmacSha256(_payOsOptions.ChecksumKey, signedData);
            if (!string.Equals(expectedSignature, payload.Signature, StringComparison.OrdinalIgnoreCase))
                throw new Exception("Webhook signature không hợp lệ.");

            if (!payload.Data.TryGetProperty("orderCode", out var orderCodeNode) || !orderCodeNode.TryGetInt64(out var orderCode))
                throw new Exception("Webhook thiếu orderCode.");

            if (!payload.Data.TryGetProperty("amount", out var amountNode) || !amountNode.TryGetDecimal(out var amount))
                throw new Exception("Webhook thiếu amount.");

            var orderCodeText = orderCode.ToString(CultureInfo.InvariantCulture);
            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.TransactionId == orderCodeText);

            if (payment == null)
                throw new Exception($"Không tìm thấy payment cho orderCode {orderCode}.");

            var webhookStatus = payload.Data.TryGetProperty("status", out var statusNode)
                ? statusNode.GetString()
                : null;

            var isSuccessCode = payload.Success && string.Equals(payload.Code, "00", StringComparison.Ordinal);
            var isPaidStatus = string.Equals(webhookStatus, "PAID", StringComparison.OrdinalIgnoreCase)
                || string.Equals(webhookStatus, "COMPLETED", StringComparison.OrdinalIgnoreCase);
            var isSuccessful = isSuccessCode || isPaidStatus;

            if (payment.Status == "Completed")
            {
                return new PayOsWebhookProcessResponse
                {
                    Processed = true,
                    IsSuccess = true,
                    Status = payment.Status,
                    OrderCode = orderCode,
                    PaymentId = payment.Id
                };
            }

            if (payment.Amount != amount)
                throw new Exception($"Sai số tiền webhook. Local={payment.Amount}, webhook={amount}.");

            payment.UpdatedAt = DateTime.UtcNow;

            if (isSuccessful)
            {
                payment.Status = "Completed";
                payment.PaidAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await _subscriptionService.ActivatePaidSubscriptionAsync(payment.UserId, payment.PlanId, payment.Id);

                _logger.LogInformation("PayOS webhook completed payment {PaymentId} (orderCode={OrderCode})", payment.Id, orderCode);

                return new PayOsWebhookProcessResponse
                {
                    Processed = true,
                    IsSuccess = true,
                    Status = payment.Status,
                    OrderCode = orderCode,
                    PaymentId = payment.Id
                };
            }

            payment.Status = string.Equals(webhookStatus, "CANCELLED", StringComparison.OrdinalIgnoreCase)
                ? "Cancelled"
                : "Failed";
            await _context.SaveChangesAsync();

            _logger.LogInformation("PayOS webhook set payment {PaymentId} to {Status} (orderCode={OrderCode})", payment.Id, payment.Status, orderCode);

            return new PayOsWebhookProcessResponse
            {
                Processed = true,
                IsSuccess = false,
                Status = payment.Status,
                OrderCode = orderCode,
                PaymentId = payment.Id
            };
        }

        public async Task<PayOsOrderStatusResponse> GetPayOsOrderStatusAsync(Guid userId, long orderCode)
        {
            var orderCodeText = orderCode.ToString(CultureInfo.InvariantCulture);
            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.UserId == userId && p.TransactionId == orderCodeText);

            if (payment == null)
                throw new Exception($"Không tìm thấy payment cho orderCode {orderCode}.");

            return new PayOsOrderStatusResponse
            {
                OrderCode = orderCode,
                Status = payment.Status,
                Payment = MapToResponse(payment, payment.Plan.PlanName)
            };
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

            _logger.LogInformation("Payment {PaymentId} status updated to {Status}", paymentId, request.Status);
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

            _logger.LogInformation("Payment {PaymentId} marked as completed", paymentId);
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

            _logger.LogInformation("Payment {PaymentId} refunded", paymentId);
            return MapToResponse(payment, payment.Plan.PlanName);
        }

        private void EnsurePayOsConfigured()
        {
            if (string.IsNullOrWhiteSpace(_payOsOptions.ClientId)
                || string.IsNullOrWhiteSpace(_payOsOptions.ApiKey)
                || string.IsNullOrWhiteSpace(_payOsOptions.ChecksumKey)
                || string.IsNullOrWhiteSpace(_payOsOptions.ReturnUrl)
                || string.IsNullOrWhiteSpace(_payOsOptions.CancelUrl))
            {
                throw new Exception("Thiếu cấu hình PayOS (ClientId/ApiKey/ChecksumKey/ReturnUrl/CancelUrl).");
            }
        }

        private async Task<long> GenerateUniqueOrderCodeAsync()
        {
            for (var i = 0; i < 10; i++)
            {
                var baseCode = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var candidate = baseCode + Random.Shared.Next(100, 999);
                var exists = await _context.Payments.AnyAsync(p => p.TransactionId == candidate.ToString(CultureInfo.InvariantCulture));
                if (!exists)
                    return candidate;
            }

            throw new Exception("Không tạo được orderCode duy nhất.");
        }

        private static string BuildPayOsDescription(int planId, Guid userId)
        {
            var suffix = userId.ToString("N")[..8].ToUpperInvariant();
            var description = $"PLAN{planId}-{suffix}";
            return description.Length <= 25 ? description : description[..25];
        }

        private static string ComputeHmacSha256(string key, string data)
        {
            var keyBytes = Encoding.UTF8.GetBytes(key);
            var dataBytes = Encoding.UTF8.GetBytes(data);
            using var hmac = new HMACSHA256(keyBytes);
            var hash = hmac.ComputeHash(dataBytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static string BuildPayOsSignatureData(JsonElement dataNode)
        {
            var pairs = dataNode
                .EnumerateObject()
                .OrderBy(p => p.Name, StringComparer.Ordinal)
                .Select(p => $"{p.Name}={ConvertJsonValue(p.Value)}");
            return string.Join("&", pairs);
        }

        private static string ConvertJsonValue(JsonElement value)
        {
            return value.ValueKind switch
            {
                JsonValueKind.String => value.GetString() ?? string.Empty,
                JsonValueKind.Number => value.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Null => string.Empty,
                _ => value.GetRawText()
            };
        }

        private async Task<PayOsCreatePaymentResponse> CreatePayOsLinkAsync(PayOsCreatePaymentRequest payload)
        {
            var client = _httpClientFactory.CreateClient("PayOS");
            var request = new HttpRequestMessage(HttpMethod.Post, _payOsOptions.CreatePaymentPath)
            {
                Content = JsonContent.Create(payload)
            };

            request.Headers.Add("x-client-id", _payOsOptions.ClientId);
            request.Headers.Add("x-api-key", _payOsOptions.ApiKey);
            if (!string.IsNullOrWhiteSpace(_payOsOptions.PartnerCode))
                request.Headers.Add("x-partner-code", _payOsOptions.PartnerCode);

            var response = await client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                throw new Exception($"PayOS create link failed: {(int)response.StatusCode} - {body}");

            var parsed = JsonSerializer.Deserialize<PayOsCreatePaymentResponse>(body, JsonOptions)
                ?? throw new Exception("Không parse được phản hồi từ PayOS.");

            if (!string.Equals(parsed.Code, "00", StringComparison.Ordinal) || parsed.Data == null)
                throw new Exception($"PayOS từ chối giao dịch: {parsed.Desc ?? "Unknown error"}");

            if (string.IsNullOrWhiteSpace(parsed.Data.CheckoutUrl))
                throw new Exception("PayOS không trả về checkoutUrl.");

            return parsed;
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

        private class PayOsCreatePaymentRequest
        {
            public long OrderCode { get; set; }
            public int Amount { get; set; }
            public string Description { get; set; } = string.Empty;
            public string ReturnUrl { get; set; } = string.Empty;
            public string CancelUrl { get; set; } = string.Empty;
            public string Signature { get; set; } = string.Empty;
            public string? BuyerName { get; set; }
            public string? BuyerEmail { get; set; }
            public List<PayOsItem> Items { get; set; } = [];
        }

        private class PayOsItem
        {
            public string Name { get; set; } = string.Empty;
            public int Quantity { get; set; }
            public int Price { get; set; }
        }

        private class PayOsCreatePaymentResponse
        {
            public string Code { get; set; } = string.Empty;
            public string? Desc { get; set; }
            public PayOsCreatePaymentData? Data { get; set; }
        }

        private class PayOsCreatePaymentData
        {
            public string? PaymentLinkId { get; set; }
            public string CheckoutUrl { get; set; } = string.Empty;
            public string? QrCode { get; set; }
        }
    }
}
