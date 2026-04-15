using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Service.DTOs
{
    // ── Payment Requests ───────────────────────────────────────────────────

    public class CreatePaymentRequest
    {
        [Required]
        public int PlanId { get; set; }

        [Required]
        [Range(1, long.MaxValue)]
        public decimal Amount { get; set; }

        [Required]
        [MaxLength(50)]
        public string PaymentMethod { get; set; } = "Card";

        [MaxLength(255)]
        public string? TransactionId { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }
    }

    public class UpdatePaymentStatusRequest
    {
        [Required]
        [RegularExpression("^(Pending|Completed|Failed|Refunded|Cancelled)$")]
        public string Status { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Notes { get; set; }
    }

    public class CreatePayOsPaymentLinkRequest
    {
        [Required]
        public int PlanId { get; set; }
    }

    public class CreatePayOsPaymentLinkResponse
    {
        public Guid PaymentId { get; set; }
        public long OrderCode { get; set; }
        public string CheckoutUrl { get; set; } = string.Empty;
        public string? QrCode { get; set; }
        public decimal Amount { get; set; }
        public string Description { get; set; } = string.Empty;
    }

    public class PayOsOrderStatusResponse
    {
        public long OrderCode { get; set; }
        public string Status { get; set; } = "Pending";
        public PaymentResponse Payment { get; set; } = new();
    }

    public class PayOsWebhookProcessResponse
    {
        public bool Processed { get; set; }
        public bool IsSuccess { get; set; }
        public string Status { get; set; } = string.Empty;
        public long OrderCode { get; set; }
        public Guid PaymentId { get; set; }
    }

    public class PayOsWebhookPayload
    {
        public string Code { get; set; } = string.Empty;
        public string? Desc { get; set; }
        public bool Success { get; set; }
        public JsonElement Data { get; set; }
        public string Signature { get; set; } = string.Empty;
    }

    // ── Payment Responses ──────────────────────────────────────────────────

    public class PaymentResponse
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public int? SubscriptionId { get; set; }
        public int PlanId { get; set; }
        public string? PlanName { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "VND";
        public string PaymentMethod { get; set; } = "Card";
        public string Status { get; set; } = "Pending";
        public string? TransactionId { get; set; }
        public string? Description { get; set; }
        public DateTime? PaidAt { get; set; }
        public DateTime? RefundedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class PaymentHistoryResponse
    {
        public List<PaymentResponse> Payments { get; set; } = new();
        public int TotalCount { get; set; }
        public decimal TotalSpent { get; set; }
        public Dictionary<string, int> StatusSummary { get; set; } = new();
    }
}
