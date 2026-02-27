namespace Repository.Entities
{
    public class UserSubscription
    {
        public int Id { get; set; }

        /// <summary>FK → Users.Id (uuid)</summary>
        public Guid UserId { get; set; }

        /// <summary>FK → SubscriptionPlans.Id</summary>
        public int PlanId { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        /// <summary>Active | Expired | Cancelled</summary>
        public string Status { get; set; } = "Active";

        /// <summary>Số lần đã phân tích bộ truyện trong kỳ</summary>
        public int UsedAnalysisCount { get; set; } = 0;

        /// <summary>Số token AI đã tiêu thụ trong kỳ</summary>
        public long UsedTokens { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public User User { get; set; } = null!;
        public SubscriptionPlan Plan { get; set; } = null!;
    }
}
