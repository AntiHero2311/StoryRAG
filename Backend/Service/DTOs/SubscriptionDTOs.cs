namespace Service.DTOs
{
    // ── Responses ──────────────────────────────────────────────────────────────

    public class SubscriptionPlanResponse
    {
        public int Id { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int MaxAnalysisCount { get; set; }
        public long MaxTokenLimit { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }
    }

    public class UserSubscriptionResponse
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int MaxAnalysisCount { get; set; }
        public long MaxTokenLimit { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public int UsedAnalysisCount { get; set; }
        public long UsedTokens { get; set; }
    }

    // ── Requests ───────────────────────────────────────────────────────────────

    public class SubscribePlanRequest
    {
        /// <summary>ID của plan muốn đăng ký</summary>
        public int PlanId { get; set; }
    }

    public class CreatePlanRequest
    {
        public string PlanName { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int MaxAnalysisCount { get; set; } = 10;
        public long MaxTokenLimit { get; set; } = 50000;
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class UpdatePlanRequest
    {
        public string? PlanName { get; set; }
        public decimal? Price { get; set; }
        public int? MaxAnalysisCount { get; set; }
        public long? MaxTokenLimit { get; set; }
        public string? Description { get; set; }
        public bool? IsActive { get; set; }
    }
}
