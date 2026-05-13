using Repository.Entities;

namespace Service.Helpers
{
    public static class AnalysisJobPriorityHelper
    {
        public static int CalculatePriority(UserSubscription? subscription)
        {
            if (subscription?.Plan == null)
                return 10;

            var planName = subscription.Plan.PlanName?.Trim().ToLowerInvariant() ?? string.Empty;
            var tierBase = planName switch
            {
                "enterprise" => 400,
                "pro" => 300,
                "basic" => 200,
                "free" => 100,
                _ => 100,
            };

            var priceBoost = (int)Math.Clamp(subscription.Plan.Price / 100_000m, 0, 50);
            var analysisBoost = Math.Clamp(subscription.Plan.MaxAnalysisCount / 5, 0, 20);
            var tokenBoost = (int)Math.Clamp(subscription.Plan.MaxTokenLimit / 50_000, 0, 20);

            return tierBase + priceBoost + analysisBoost + tokenBoost;
        }
    }
}
