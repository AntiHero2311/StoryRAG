namespace Repository.Entities
{
    public class SubscriptionPlan
    {
        public int Id { get; set; }

        /// <summary>Free | Basic | Pro | Enterprise</summary>
        public string PlanName { get; set; } = string.Empty;

        /// <summary>Giá VNĐ / tháng</summary>
        public decimal Price { get; set; } = 0;

        /// <summary>Số lần phân tích cả bộ truyện được phép trong kỳ</summary>
        public int MaxAnalysisCount { get; set; } = 10;

        /// <summary>Tổng token AI (cho chat Q&A) được phép dùng trong kỳ</summary>
        public long MaxTokenLimit { get; set; } = 50000;

        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;

        // Navigation
        public ICollection<UserSubscription> UserSubscriptions { get; set; } = [];
    }
}
