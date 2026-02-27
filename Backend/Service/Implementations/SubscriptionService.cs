using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class SubscriptionService : ISubscriptionService
    {
        private readonly AppDbContext _db;

        public SubscriptionService(AppDbContext db)
        {
            _db = db;
        }

        // ── Plans ─────────────────────────────────────────────────────────────

        public async Task<IEnumerable<SubscriptionPlanResponse>> GetAllPlansAsync(bool includeInactive = false)
        {
            var query = _db.SubscriptionPlans.AsQueryable();
            if (!includeInactive) query = query.Where(p => p.IsActive);
            var plans = await query.OrderBy(p => p.Price).ToListAsync();
            return plans.Select(MapPlan);
        }

        public async Task<SubscriptionPlanResponse> GetPlanByIdAsync(int id)
        {
            var plan = await _db.SubscriptionPlans.FindAsync(id)
                ?? throw new KeyNotFoundException($"Không tìm thấy plan ID={id}.");
            return MapPlan(plan);
        }

        public async Task<SubscriptionPlanResponse> CreatePlanAsync(CreatePlanRequest request)
        {
            var plan = new SubscriptionPlan
            {
                PlanName = request.PlanName.Trim(),
                Price = request.Price,
                MaxAnalysisCount = request.MaxAnalysisCount,
                MaxTokenLimit = request.MaxTokenLimit,
                Description = request.Description?.Trim(),
                IsActive = request.IsActive
            };
            _db.SubscriptionPlans.Add(plan);
            await _db.SaveChangesAsync();
            return MapPlan(plan);
        }

        public async Task<SubscriptionPlanResponse> UpdatePlanAsync(int id, UpdatePlanRequest request)
        {
            var plan = await _db.SubscriptionPlans.FindAsync(id)
                ?? throw new KeyNotFoundException($"Không tìm thấy plan ID={id}.");

            if (request.PlanName != null) plan.PlanName = request.PlanName.Trim();
            if (request.Price.HasValue) plan.Price = request.Price.Value;
            if (request.MaxAnalysisCount.HasValue) plan.MaxAnalysisCount = request.MaxAnalysisCount.Value;
            if (request.MaxTokenLimit.HasValue) plan.MaxTokenLimit = request.MaxTokenLimit.Value;
            if (request.Description != null) plan.Description = request.Description.Trim();
            if (request.IsActive.HasValue) plan.IsActive = request.IsActive.Value;

            await _db.SaveChangesAsync();
            return MapPlan(plan);
        }

        public async Task DeletePlanAsync(int id)
        {
            var plan = await _db.SubscriptionPlans.FindAsync(id)
                ?? throw new KeyNotFoundException($"Không tìm thấy plan ID={id}.");
            plan.IsActive = false;
            await _db.SaveChangesAsync();
        }

        // ── User Subscription ─────────────────────────────────────────────────

        public async Task<UserSubscriptionResponse?> GetMySubscriptionAsync(Guid userId)
        {
            var sub = await _db.UserSubscriptions
                .Include(s => s.Plan)
                .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            if (sub == null) return null;

            return MapSubscription(sub);
        }

        public async Task<UserSubscriptionResponse> SubscribeToPlanAsync(Guid userId, int planId)
        {
            // 1. Kiểm tra plan tồn tại và đang active
            var plan = await _db.SubscriptionPlans.FindAsync(planId)
                ?? throw new KeyNotFoundException($"Không tìm thấy plan ID={planId}.");

            if (!plan.IsActive)
                throw new InvalidOperationException("Plan này hiện không khả dụng.");

            // 2. Kiểm tra xem user đã có subscription active cho đúng plan này chưa
            var existing = await _db.UserSubscriptions
                .Where(s => s.UserId == userId && s.PlanId == planId
                         && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .FirstOrDefaultAsync();

            if (existing != null)
                throw new InvalidOperationException("Bạn đã đăng ký gói này rồi.");

            // 3. Chỉ hỗ trợ Free plan (Price == 0)
            if (plan.Price > 0)
                throw new InvalidOperationException(
                    "Gói trả phí chưa được hỗ trợ. Vui lòng liên hệ hỗ trợ.");

            // 4. Hủy subscription active cũ (nếu có) trước khi tạo mới
            var oldSubs = await _db.UserSubscriptions
                .Where(s => s.UserId == userId && s.Status == "Active")
                .ToListAsync();

            foreach (var old in oldSubs)
                old.Status = "Cancelled";

            // 5. Tạo subscription mới, tự động Active
            var now = DateTime.UtcNow;
            var newSub = new UserSubscription
            {
                UserId = userId,
                PlanId = planId,
                StartDate = now,
                EndDate = now.AddYears(1),
                Status = "Active",
                UsedAnalysisCount = 0,
                UsedTokens = 0,
                CreatedAt = now
            };

            _db.UserSubscriptions.Add(newSub);
            await _db.SaveChangesAsync();

            // Load navigation property
            newSub.Plan = plan;
            return MapSubscription(newSub);
        }

        // ── Mapper ────────────────────────────────────────────────────────────

        private static SubscriptionPlanResponse MapPlan(SubscriptionPlan p) => new()
        {
            Id = p.Id,
            PlanName = p.PlanName,
            Price = p.Price,
            MaxAnalysisCount = p.MaxAnalysisCount,
            MaxTokenLimit = p.MaxTokenLimit,
            Description = p.Description,
            IsActive = p.IsActive
        };

        private static UserSubscriptionResponse MapSubscription(UserSubscription s) => new()
        {
            Id = s.Id,
            PlanId = s.PlanId,
            PlanName = s.Plan.PlanName,
            Price = s.Plan.Price,
            MaxAnalysisCount = s.Plan.MaxAnalysisCount,
            MaxTokenLimit = s.Plan.MaxTokenLimit,
            StartDate = s.StartDate,
            EndDate = s.EndDate,
            Status = s.Status,
            UsedAnalysisCount = s.UsedAnalysisCount,
            UsedTokens = s.UsedTokens
        };
    }
}
