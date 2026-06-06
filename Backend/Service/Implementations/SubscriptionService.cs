using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    /// <summary>
    /// Dịch vụ quản lý các gói dịch vụ, đăng ký/gia hạn gói và kiểm tra giới hạn sử dụng của người dùng.
    /// </summary>
    public class SubscriptionService : ISubscriptionService
    {
        private readonly AppDbContext _db;
        private readonly INotificationService _notificationService;

        public SubscriptionService(AppDbContext db, INotificationService notificationService)
        {
            _db = db;
            _notificationService = notificationService;
        }

        // ── Plans ─────────────────────────────────────────────────────────────

        /// <summary>Lấy tất cả plan (active hoặc all nếu includeInactive)</summary>
        public async Task<IEnumerable<SubscriptionPlanResponse>> GetAllPlansAsync(bool includeInactive = false)
        {
            var query = _db.SubscriptionPlans.AsQueryable();
            if (!includeInactive) query = query.Where(p => p.IsActive);
            var plans = await query.OrderBy(p => p.Price).ToListAsync();
            return plans.Select(MapPlan);
        }

        /// <summary>Lấy chi tiết một plan</summary>
        public async Task<SubscriptionPlanResponse> GetPlanByIdAsync(int id)
        {
            var plan = await _db.SubscriptionPlans.FindAsync(id)
                ?? throw new KeyNotFoundException($"Không tìm thấy plan ID={id}.");
            return MapPlan(plan);
        }

        /// <summary>Tạo plan mới — Admin only</summary>
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

        /// <summary>Cập nhật plan — Admin only</summary>
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

        /// <summary>Deactivate hoặc xoá plan — Admin only. Trả về true nếu xoá hoàn toàn, false nếu chỉ deactivate.</summary>
        public async Task<bool> DeletePlanAsync(int id)
        {
            var plan = await _db.SubscriptionPlans.FindAsync(id)
                ?? throw new KeyNotFoundException($"Không tìm thấy plan ID={id}.");

            var hasSubscriptions = await _db.UserSubscriptions.AnyAsync(s => s.PlanId == id);
            var hasPayments = await _db.Payments.AnyAsync(p => p.PlanId == id);

            if (hasSubscriptions || hasPayments)
            {
                plan.IsActive = false;
                await _db.SaveChangesAsync();
                return false; // Soft-deleted (Deactivated)
            }

            _db.SubscriptionPlans.Remove(plan);
            await _db.SaveChangesAsync();
            return true; // Hard-deleted
        }

        // ── User Subscription ─────────────────────────────────────────────────

        public async Task<UserSubscriptionResponse?> GetMySubscriptionAsync(Guid userId)
        {
            var now = DateTime.UtcNow;
            
            // 1. Tìm subscription active hiện tại
            var sub = await _db.UserSubscriptions
                .Include(s => s.Plan)
                .Include(s => s.NextPlan)
                .Where(s => s.UserId == userId && s.Status == "Active")
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            if (sub == null) return null;

            // 2. Nếu đã hết hạn và có gói tiếp theo được hẹn lịch (Hạ cấp)
            if (sub.EndDate < now && sub.NextPlanId.HasValue)
            {
                sub.Status = "Expired";
                
                var nextPlan = sub.NextPlan ?? await _db.SubscriptionPlans.FindAsync(sub.NextPlanId.Value);
                if (nextPlan != null && nextPlan.IsActive)
                {
                    var newSub = new UserSubscription
                    {
                        UserId = userId,
                        PlanId = nextPlan.Id,
                        StartDate = now,
                        EndDate = now.AddMonths(1),
                        Status = "Active",
                        UsedAnalysisCount = 0,
                        UsedTokens = 0,
                        CreatedAt = now
                    };
                    _db.UserSubscriptions.Add(newSub);
                    await _db.SaveChangesAsync();

                    try
                    {
                        await _notificationService.CreateForUserAsync(
                            userId,
                            "info",
                            "Gói đã được hạ cấp",
                            $"Gói của bạn đã được chuyển sang \"{nextPlan.PlanName}\". Gói mới có hiệu lực từ hôm nay đến {now.AddMonths(1):dd/MM/yyyy}.",
                            tag: $"subscription-downgrade-activated-{newSub.Id}");
                    }
                    catch { /* Không để lỗi notification chặn luồng chính */ }

                    newSub.Plan = nextPlan;
                    return MapSubscription(newSub);
                }
                
                await _db.SaveChangesAsync();
                return null;
            }

            // 3. Nếu đã hết hạn nhưng không có gói tiếp theo
            if (sub.EndDate < now)
            {
                sub.Status = "Expired";
                await _db.SaveChangesAsync();
                return null;
            }

            return MapSubscription(sub);
        }

        /// <summary>Đăng ký plan cho user. Free plan (Price=0) tự động Active ngay.</summary>
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
                    "Gói trả phí cần thanh toán qua VNPay trước khi kích hoạt.");

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

            try
            {
                await _notificationService.CreateForUserAsync(
                    userId,
                    "success",
                    "Đăng ký gói thành công",
                    $"Bạn đã đăng ký thành công gói \"{plan.PlanName}\". Gói có hiệu lực đến {newSub.EndDate:dd/MM/yyyy}.",
                    tag: $"subscription-new-{newSub.Id}");
            }
            catch { /* Không để lỗi notification chặn luồng chính */ }

            // Load navigation property
            newSub.Plan = plan;
            return MapSubscription(newSub);
        }

        /// <summary>Kích hoạt gói trả phí sau khi thanh toán thành công.</summary>
        public async Task<UserSubscriptionResponse> ActivatePaidSubscriptionAsync(Guid userId, int planId, Guid paymentId)
        {
            var plan = await _db.SubscriptionPlans.FindAsync(planId)
                ?? throw new KeyNotFoundException($"Không tìm thấy plan ID={planId}.");

            if (!plan.IsActive)
                throw new InvalidOperationException("Plan này hiện không khả dụng.");

            if (plan.Price <= 0)
                throw new InvalidOperationException("Chỉ dùng API này cho gói trả phí.");

            var current = await _db.UserSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s =>
                    s.UserId == userId &&
                    s.Status == "Active" &&
                    s.EndDate >= DateTime.UtcNow);

            // 1. Nếu đang có gói active
            if (current != null)
            {
                // A. Nếu là cùng gói (Gia hạn)
                if (current.PlanId == planId)
                {
                    current.EndDate = current.EndDate.AddMonths(1);
                    
                    var p = await _db.Payments.FindAsync(paymentId);
                    if (p != null) { p.SubscriptionId = current.Id; p.UpdatedAt = DateTime.UtcNow; }
                    
                    await _db.SaveChangesAsync();

                    try
                    {
                        await _notificationService.CreateForUserAsync(
                            userId,
                            "success",
                            "Gia hạn gói thành công",
                            $"Bạn đã gia hạn thành công gói \"{plan.PlanName}\". Gói hiện có hiệu lực đến {current.EndDate:dd/MM/yyyy}.",
                            tag: $"subscription-renew-{current.Id}-{current.EndDate:yyyyMMdd}");
                    }
                    catch { /* Không để lỗi notification chặn luồng chính */ }

                    return MapSubscription(current);
                }
                
                // B. Nếu là hạ cấp (Giá gói mới < Giá gói hiện tại)
                if (plan.Price < current.Plan.Price)
                {
                    current.NextPlanId = planId;
                    
                    var p = await _db.Payments.FindAsync(paymentId);
                    if (p != null) { p.UpdatedAt = DateTime.UtcNow; }
                    
                    await _db.SaveChangesAsync();

                    try
                    {
                        await _notificationService.CreateForUserAsync(
                            userId,
                            "warning",
                            "Hạ cấp gói đã được lên lịch",
                            $"Yêu cầu hạ cấp xuống gói \"{plan.PlanName}\" đã được ghi nhận. Gói mới sẽ có hiệu lực sau khi gói \"{current.Plan.PlanName}\" hiện tại hết hạn vào {current.EndDate:dd/MM/yyyy}. Hệ thống không hoàn lại tiền chênh lệch cho chu kỳ hiện tại.",
                            tag: $"subscription-downgrade-scheduled-{current.Id}");
                    }
                    catch { /* Không để lỗi notification chặn luồng chính */ }

                    // Load NextPlan for mapping
                    current.NextPlan = plan;
                    return MapSubscription(current);
                }
                
                // C. Nếu là nâng cấp (Giá gói mới > Giá gói hiện tại) -> Thay thế ngay lập tức
                current.Status = "Cancelled";
            }

            // 2. Tạo subscription mới (Cho trường hợp Nâng cấp hoặc chưa có gói)
            var now = DateTime.UtcNow;
            var newSub = new UserSubscription
            {
                UserId = userId,
                PlanId = planId,
                StartDate = now,
                EndDate = now.AddMonths(1),
                Status = "Active",
                UsedAnalysisCount = 0,
                UsedTokens = 0,
                CreatedAt = now
            };

            _db.UserSubscriptions.Add(newSub);
            await _db.SaveChangesAsync();

            var payment = await _db.Payments.FindAsync(paymentId);
            if (payment != null)
            {
                payment.SubscriptionId = newSub.Id;
                payment.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            try
            {
                var isUpgrade = current != null;
                if (isUpgrade)
                {
                    await _notificationService.CreateForUserAsync(
                        userId,
                        "success",
                        "Nâng cấp gói thành công",
                        $"Bạn đã nâng cấp thành công lên gói \"{plan.PlanName}\". Gói mới có hiệu lực ngay từ hôm nay đến {newSub.EndDate:dd/MM/yyyy}.",
                        tag: $"subscription-upgrade-{newSub.Id}");
                }
                else
                {
                    await _notificationService.CreateForUserAsync(
                        userId,
                        "success",
                        "Đăng ký gói thành công",
                        $"Bạn đã đăng ký thành công gói \"{plan.PlanName}\". Gói có hiệu lực đến {newSub.EndDate:dd/MM/yyyy}.",
                        tag: $"subscription-new-{newSub.Id}");
                }
            }
            catch { /* Không để lỗi notification chặn luồng chính */ }

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
            UsedTokens = s.UsedTokens,
            NextPlanId = s.NextPlanId,
            NextPlanName = s.NextPlan?.PlanName
        };
    }
}
