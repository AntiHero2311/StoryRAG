namespace Repository.Entities
{
    public class Payment
    {
        public Guid Id { get; set; }

        /// <summary>FK → Users.Id</summary>
        public Guid UserId { get; set; }

        /// <summary>FK → UserSubscriptions.Id (tùy chọn, liên kết với đơn hàng cụ thể)</summary>
        public int? SubscriptionId { get; set; }

        /// <summary>FK → SubscriptionPlans.Id (mua gói nào)</summary>
        public int PlanId { get; set; }

        /// <summary>Số tiền thanh toán (VND)</summary>
        public decimal Amount { get; set; }

        /// <summary>Đơn vị tiền tệ (VND, USD, ...)</summary>
        public string Currency { get; set; } = "VND";

        /// <summary>Phương thức thanh toán: Card, BankTransfer, MoMo, ZaloPay, Manual</summary>
        public string PaymentMethod { get; set; } = "Card";

        /// <summary>Trạng thái: Pending, Completed, Failed, Refunded, Cancelled</summary>
        public string Status { get; set; } = "Pending";

        /// <summary>Mã giao dịch từ payment gateway (Stripe, PayPal, VNPay, ...)</summary>
        public string? TransactionId { get; set; }

        /// <summary>Mô tả hoặc ghi chú từ payment gateway</summary>
        public string? Description { get; set; }

        /// <summary>Thời điểm thanh toán thành công (nếu có)</summary>
        public DateTime? PaidAt { get; set; }

        /// <summary>Thời điểm hết hạn hoàn tiền (nếu refunded)</summary>
        public DateTime? RefundedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public User User { get; set; } = null!;
        public SubscriptionPlan Plan { get; set; } = null!;
        public UserSubscription? Subscription { get; set; }
    }
}
