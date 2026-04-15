using Service.DTOs;

namespace Service.Interfaces
{
    public interface IPaymentService
    {
        /// <summary>Tạo payment record mới khi user thanh toán</summary>
        Task<PaymentResponse> CreatePaymentAsync(Guid userId, CreatePaymentRequest request);

        /// <summary>Cập nhật trạng thái payment (Pending → Completed, etc.)</summary>
        Task<PaymentResponse> UpdatePaymentStatusAsync(Guid paymentId, Guid userId, UpdatePaymentStatusRequest request);

        /// <summary>Lấy lịch sử thanh toán của user</summary>
        Task<PaymentHistoryResponse> GetPaymentHistoryAsync(Guid userId, int page = 1, int pageSize = 20);

        /// <summary>Lấy chi tiết payment cụ thể</summary>
        Task<PaymentResponse> GetPaymentByIdAsync(Guid paymentId, Guid userId);

        /// <summary>Tìm payment bằng TransactionId (từ payment gateway)</summary>
        Task<PaymentResponse?> GetPaymentByTransactionIdAsync(string transactionId);

        /// <summary>Đánh dấu payment là "Completed" khi thanh toán thành công</summary>
        Task<PaymentResponse> MarkAsCompletedAsync(Guid paymentId, string? transactionId = null);

        /// <summary>Refund một payment</summary>
        Task<PaymentResponse> RefundPaymentAsync(Guid paymentId, Guid userId);

        /// <summary>Tạo link thanh toán PayOS cho gói trả phí</summary>
        Task<CreatePayOsPaymentLinkResponse> CreatePayOsPaymentLinkAsync(Guid userId, CreatePayOsPaymentLinkRequest request);

        /// <summary>Xử lý webhook từ PayOS</summary>
        Task<PayOsWebhookProcessResponse> HandlePayOsWebhookAsync(PayOsWebhookPayload payload);

        /// <summary>Lấy trạng thái đơn hàng PayOS theo orderCode</summary>
        Task<PayOsOrderStatusResponse> GetPayOsOrderStatusAsync(Guid userId, long orderCode);
    }
}
