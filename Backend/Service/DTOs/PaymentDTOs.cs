using System.ComponentModel.DataAnnotations;

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
