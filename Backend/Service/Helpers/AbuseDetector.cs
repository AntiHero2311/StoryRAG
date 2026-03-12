using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Repository.Data;

namespace Service.Helpers;

/// <summary>
/// Phát hiện và xử lý hành vi lạm dụng AI (bot, spam request).
/// Dùng User.IsActive = false để suspend (không cần thêm field mới vào DB).
/// </summary>
public static class AbuseDetector
{
    // Ngưỡng cảnh báo: >50 AI requests trong cửa sổ thời gian
    private const int WarningThreshold = 50;

    // Ngưỡng auto-suspend: >200 AI requests trong cửa sổ thời gian
    private const int SuspendThreshold = 200;

    // Cửa sổ thời gian kiểm tra
    private static readonly TimeSpan DetectionWindow = TimeSpan.FromMinutes(10);

    /// <summary>
    /// Đếm tổng số lần gọi AI của user trong DetectionWindow phút gần nhất.
    /// Nếu vượt ngưỡng → log cảnh báo hoặc auto-suspend.
    /// Gọi sau mỗi lần gọi AI thành công.
    /// </summary>
    public static async Task CheckAndFlagAsync(Guid userId, AppDbContext context, ILogger logger)
    {
        var since = DateTime.UtcNow - DetectionWindow;

        // Đếm chat + rewrite trong cửa sổ
        var chatCount = await context.ChatMessages
            .CountAsync(m => m.UserId == userId && m.CreatedAt >= since);

        var rewriteCount = await context.RewriteHistories
            .CountAsync(r => r.UserId == userId && r.CreatedAt >= since);

        var totalCalls = chatCount + rewriteCount;

        if (totalCalls >= SuspendThreshold)
        {
            var user = await context.Users.FindAsync(userId);
            if (user != null && user.IsActive)
            {
                user.IsActive = false;
                await context.SaveChangesAsync();
                logger.LogWarning(
                    "⛔ Auto-suspended UserId={UserId} — {Count} AI calls trong {Window} phút (ngưỡng: {Threshold}).",
                    userId, totalCalls, DetectionWindow.TotalMinutes, SuspendThreshold);
            }
        }
        else if (totalCalls >= WarningThreshold)
        {
            logger.LogWarning(
                "⚠️ Nghi ngờ lạm dụng: UserId={UserId} — {Count} AI calls trong {Window} phút.",
                userId, totalCalls, DetectionWindow.TotalMinutes);
        }
    }
}
