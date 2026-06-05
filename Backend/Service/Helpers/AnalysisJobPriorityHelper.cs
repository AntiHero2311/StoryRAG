using Repository.Entities;

namespace Service.Helpers
{
    public static class AnalysisJobPriorityHelper
    {
        public static int CalculatePriority(UserSubscription? subscription)
        {
            if (subscription?.Plan == null)
                return 10;

            var price = subscription.Plan.Price;
            var tierBase = 100;
            if (price >= 600000)
                tierBase = 400;
            else if (price >= 200000)
                tierBase = 300;
            else if (price > 0)
                tierBase = 200;

            var priceBoost = (int)Math.Clamp(subscription.Plan.Price / 100_000m, 0, 50);
            var analysisBoost = Math.Clamp(subscription.Plan.MaxAnalysisCount / 5, 0, 20);
            var tokenBoost = (int)Math.Clamp(subscription.Plan.MaxTokenLimit / 50_000, 0, 20);

            return tierBase + priceBoost + analysisBoost + tokenBoost;
        }
    }
}
