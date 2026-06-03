using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
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
        private readonly ISystemConfigService _sysConfig;
        private readonly VnPayOptions _vnPayOptions;

        public PaymentService(
            AppDbContext context,
            ILogger<PaymentService> logger,
            ISubscriptionService subscriptionService,
            IOptions<VnPayOptions> vnPayOptions,
            ISystemConfigService sysConfig)
        {
            _context = context;
            _logger = logger;
            _subscriptionService = subscriptionService;
            _vnPayOptions = vnPayOptions.Value;
            _sysConfig = sysConfig;
        }

        private async Task<VnPayOptions> GetDynamicVnPayOptionsAsync()
        {
            return new VnPayOptions
            {
                Version = _vnPayOptions.Version,
                Command = _vnPayOptions.Command,
                TmnCode = await _sysConfig.GetAsync("vnpay.tmn_code", _vnPayOptions.TmnCode),
                HashSecret = await _sysConfig.GetAsync("vnpay.hash_secret", _vnPayOptions.HashSecret),
                PaymentUrl = await _sysConfig.GetAsync("vnpay.payment_url", _vnPayOptions.PaymentUrl),
                ReturnUrl = await _sysConfig.GetAsync("vnpay.return_url", _vnPayOptions.ReturnUrl),
                Locale = _vnPayOptions.Locale,
                CurrCode = _vnPayOptions.CurrCode,
                OrderType = _vnPayOptions.OrderType,
                DefaultIpAddress = _vnPayOptions.DefaultIpAddress,
                TimeZoneId = _vnPayOptions.TimeZoneId,
                ExpireMinutes = _vnPayOptions.ExpireMinutes
            };
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

        public async Task<CreateVnPayPaymentUrlResponse> CreateVnPayPaymentUrlAsync(Guid userId, CreateVnPayPaymentUrlRequest request)
        {
            var opts = await GetDynamicVnPayOptionsAsync();
            await EnsureVnPayConfiguredAsync(opts);

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception($"User {userId} not found");

            var plan = await _context.SubscriptionPlans.FindAsync(request.PlanId);
            if (plan == null)
                throw new Exception($"Subscription Plan {request.PlanId} not found");

            if (!plan.IsActive)
                throw new Exception("Plan này hiện không khả dụng.");

            if (plan.Price <= 0)
                throw new Exception("Gói miễn phí không cần thanh toán VNPay.");

            if (plan.Price != decimal.Truncate(plan.Price))
                throw new Exception("Số tiền thanh toán phải là số nguyên VND.");

            var txnRef = await GenerateUniqueTxnRefAsync();
            var amount = (long)plan.Price;
            var orderInfo = BuildVnPayOrderInfo(request.PlanId, userId);
            var nowVn = ConvertUtcToVnTime(DateTime.UtcNow, opts);
            var expireVn = nowVn.AddMinutes(Math.Max(1, opts.ExpireMinutes));

            var payment = new Payment
            {
                UserId = userId,
                PlanId = request.PlanId,
                Amount = plan.Price,
                Currency = "VND",
                PaymentMethod = "VNPay",
                Status = "Pending",
                TransactionId = txnRef,
                Description = $"VNPay order {txnRef}",
                CreatedAt = DateTime.UtcNow
            };

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();

            var payload = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["vnp_Version"] = opts.Version,
                ["vnp_Command"] = opts.Command,
                ["vnp_TmnCode"] = opts.TmnCode,
                ["vnp_Amount"] = (amount * 100).ToString(CultureInfo.InvariantCulture),
                ["vnp_CreateDate"] = nowVn.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
                ["vnp_CurrCode"] = opts.CurrCode,
                ["vnp_IpAddr"] = string.IsNullOrWhiteSpace(opts.DefaultIpAddress) ? "127.0.0.1" : opts.DefaultIpAddress,
                ["vnp_Locale"] = opts.Locale,
                ["vnp_OrderInfo"] = orderInfo,
                ["vnp_OrderType"] = opts.OrderType,
                ["vnp_ReturnUrl"] = opts.ReturnUrl,
                ["vnp_TxnRef"] = txnRef,
                ["vnp_ExpireDate"] = expireVn.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture)
            };

            var hashData = BuildVnPayDataString(payload);
            var secureHash = ComputeHmacSha512(opts.HashSecret, hashData);
            var checkoutUrl = $"{opts.PaymentUrl}?{hashData}&vnp_SecureHashType=HmacSHA512&vnp_SecureHash={WebUtility.UrlEncode(secureHash)}";

            _logger.LogInformation("Created VNPay URL for payment {PaymentId}, txnRef {TxnRef}", payment.Id, txnRef);

            return new CreateVnPayPaymentUrlResponse
            {
                PaymentId = payment.Id,
                TxnRef = txnRef,
                CheckoutUrl = checkoutUrl,
                Amount = payment.Amount,
                Description = orderInfo
            };
        }

        public async Task<VnPayIpnProcessResponse> HandleVnPayIpnAsync(IReadOnlyDictionary<string, string?> queryParameters)
        {
            var opts = await GetDynamicVnPayOptionsAsync();
            await EnsureVnPayConfiguredAsync(opts);

            if (!queryParameters.TryGetValue("vnp_SecureHash", out var secureHash) || string.IsNullOrWhiteSpace(secureHash))
                throw new Exception("Thiếu chữ ký VNPay.");

            var signedParams = queryParameters
                .Where(kvp => kvp.Key.StartsWith("vnp_", StringComparison.Ordinal))
                .Where(kvp => !string.Equals(kvp.Key, "vnp_SecureHash", StringComparison.OrdinalIgnoreCase)
                           && !string.Equals(kvp.Key, "vnp_SecureHashType", StringComparison.OrdinalIgnoreCase))
                .Where(kvp => !string.IsNullOrWhiteSpace(kvp.Value))
                .ToDictionary(kvp => kvp.Key, kvp => kvp.Value!, StringComparer.Ordinal);

            var hashData = BuildVnPayDataString(signedParams);
            var expectedHash = ComputeHmacSha512(opts.HashSecret, hashData);
            if (!string.Equals(expectedHash, secureHash, StringComparison.OrdinalIgnoreCase))
                throw new Exception("VNPay IPN signature không hợp lệ.");

            if (!queryParameters.TryGetValue("vnp_TxnRef", out var txnRef) || string.IsNullOrWhiteSpace(txnRef))
                throw new Exception("IPN thiếu vnp_TxnRef.");

            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.TransactionId == txnRef);

            if (payment == null)
                throw new Exception($"Không tìm thấy payment cho txnRef {txnRef}.");

            if (payment.Status == "Completed")
            {
                return new VnPayIpnProcessResponse
                {
                    Processed = true,
                    IsSuccess = true,
                    Status = payment.Status,
                    TxnRef = txnRef,
                    PaymentId = payment.Id
                };
            }

            if (!queryParameters.TryGetValue("vnp_Amount", out var amountText) || !long.TryParse(amountText, out var amountRaw))
                throw new Exception("IPN thiếu hoặc sai vnp_Amount.");

            var paidAmount = amountRaw / 100m;
            if (payment.Amount != paidAmount)
                throw new Exception($"Sai số tiền VNPay IPN. Local={payment.Amount}, ipn={paidAmount}.");

            queryParameters.TryGetValue("vnp_ResponseCode", out var responseCode);
            queryParameters.TryGetValue("vnp_TransactionStatus", out var transactionStatus);
            var isSuccess = string.Equals(responseCode, "00", StringComparison.Ordinal)
                && (string.IsNullOrWhiteSpace(transactionStatus) || string.Equals(transactionStatus, "00", StringComparison.Ordinal));

            payment.UpdatedAt = DateTime.UtcNow;
            if (isSuccess)
            {
                payment.Status = "Completed";
                payment.PaidAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                await _subscriptionService.ActivatePaidSubscriptionAsync(payment.UserId, payment.PlanId, payment.Id);

                _logger.LogInformation("VNPay IPN completed payment {PaymentId} (txnRef={TxnRef})", payment.Id, txnRef);
                return new VnPayIpnProcessResponse
                {
                    Processed = true,
                    IsSuccess = true,
                    Status = payment.Status,
                    TxnRef = txnRef,
                    PaymentId = payment.Id
                };
            }

            payment.Status = string.Equals(responseCode, "24", StringComparison.Ordinal)
                ? "Cancelled"
                : "Failed";
            await _context.SaveChangesAsync();

            _logger.LogInformation("VNPay IPN set payment {PaymentId} to {Status} (txnRef={TxnRef})", payment.Id, payment.Status, txnRef);
            return new VnPayIpnProcessResponse
            {
                Processed = true,
                IsSuccess = false,
                Status = payment.Status,
                TxnRef = txnRef,
                PaymentId = payment.Id
            };
        }

        public async Task<VnPayOrderStatusResponse> GetVnPayOrderStatusAsync(Guid userId, string txnRef)
        {
            var normalizedTxnRef = txnRef?.Trim();
            if (string.IsNullOrWhiteSpace(normalizedTxnRef))
                throw new Exception("txnRef không hợp lệ.");

            var payment = await _context.Payments
                .Include(p => p.Plan)
                .FirstOrDefaultAsync(p => p.UserId == userId && p.TransactionId == normalizedTxnRef);

            if (payment == null)
                throw new Exception($"Không tìm thấy payment cho txnRef {normalizedTxnRef}.");

            return new VnPayOrderStatusResponse
            {
                TxnRef = normalizedTxnRef,
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

        private async Task EnsureVnPayConfiguredAsync(VnPayOptions opts)
        {
            if (string.IsNullOrWhiteSpace(opts.PaymentUrl)
                || string.IsNullOrWhiteSpace(opts.TmnCode)
                || string.IsNullOrWhiteSpace(opts.HashSecret)
                || string.IsNullOrWhiteSpace(opts.ReturnUrl))
            {
                throw new Exception("Thiếu cấu hình VNPay (PaymentUrl/TmnCode/HashSecret/ReturnUrl).");
            }
        }

        private async Task<string> GenerateUniqueTxnRefAsync()
        {
            for (var i = 0; i < 10; i++)
            {
                var candidate = (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + Random.Shared.Next(100, 999))
                    .ToString(CultureInfo.InvariantCulture);
                var exists = await _context.Payments.AnyAsync(p => p.TransactionId == candidate);
                if (!exists)
                    return candidate;
            }

            throw new Exception("Không tạo được txnRef duy nhất.");
        }

        private static string BuildVnPayOrderInfo(int planId, Guid userId)
        {
            var suffix = userId.ToString("N")[..8].ToUpperInvariant();
            var info = $"PLAN{planId}-{suffix}";
            return info.Length <= 255 ? info : info[..255];
        }

        private static string BuildVnPayDataString(IReadOnlyDictionary<string, string> parameters)
        {
            var pairs = parameters
                .OrderBy(kvp => kvp.Key, StringComparer.Ordinal)
                .Select(kvp => $"{WebUtility.UrlEncode(kvp.Key)}={WebUtility.UrlEncode(kvp.Value)}");
            return string.Join("&", pairs);
        }

        private static string ComputeHmacSha512(string key, string data)
        {
            var keyBytes = Encoding.UTF8.GetBytes(key);
            var dataBytes = Encoding.UTF8.GetBytes(data);
            using var hmac = new HMACSHA512(keyBytes);
            var hash = hmac.ComputeHash(dataBytes);
            return Convert.ToHexString(hash).ToUpperInvariant();
        }

        private DateTime ConvertUtcToVnTime(DateTime utcTime, VnPayOptions opts)
        {
            try
            {
                var timeZone = TimeZoneInfo.FindSystemTimeZoneById(opts.TimeZoneId);
                return TimeZoneInfo.ConvertTimeFromUtc(utcTime, timeZone);
            }
            catch (TimeZoneNotFoundException)
            {
                return utcTime.AddHours(7);
            }
            catch (InvalidTimeZoneException)
            {
                return utcTime.AddHours(7);
            }
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
