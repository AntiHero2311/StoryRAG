using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Repository.Entities;

namespace Service.Helpers;

/// <summary>
/// Phát hiện và xử lý hành vi lạm dụng AI (bot, spam request).
/// Dùng User.IsActive = false để suspend (không cần thêm field mới vào Users).
/// Ghi <see cref="ProjectAbuseFlag"/> để staff xem qua API flagged-projects.
/// </summary>
public static class AbuseDetector
{
    // Ngưỡng cảnh báo: >50 AI requests trong cửa sổ thời gian
    private const int WarningThreshold = 50;

    // Ngưỡng auto-suspend: >200 AI requests trong cửa sổ thời gian
    private const int SuspendThreshold = 200;

    // Cửa sổ thời gian kiểm tra
    private static readonly TimeSpan DetectionWindow = TimeSpan.FromMinutes(10);

    public const string ReasonRateLimitWarning = "AI_RATE_LIMIT_WARNING";
    public const string ReasonRateLimitSuspend = "AI_RATE_LIMIT_SUSPEND";

    /// <summary>
    /// Đếm tổng số lần gọi AI của user trong DetectionWindow phút gần nhất.
    /// Nếu vượt ngưỡng → log cảnh báo, ghi cờ project, hoặc auto-suspend.
    /// Gọi sau mỗi lần gọi AI thành công.
    /// </summary>
    public static async Task CheckAndFlagAsync(Guid userId, Guid projectId, AppDbContext context, ILogger logger)
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
                context.ProjectAbuseFlags.Add(new ProjectAbuseFlag
                {
                    ProjectId = projectId,
                    UserId = userId,
                    FlagReason = ReasonRateLimitSuspend,
                    Severity = "Critical",
                    FlaggedAt = DateTime.UtcNow,
                });
                await context.SaveChangesAsync();
                logger.LogWarning(
                    "⛔ Auto-suspended UserId={UserId} — {Count} AI calls trong {Window} phút (ngưỡng: {Threshold}).",
                    userId, totalCalls, DetectionWindow.TotalMinutes, SuspendThreshold);
            }
        }
        else if (totalCalls >= WarningThreshold)
        {
            var hasRecentWarning = await context.ProjectAbuseFlags
                .AnyAsync(f =>
                    f.UserId == userId &&
                    f.ProjectId == projectId &&
                    f.Severity == "Warning" &&
                    f.FlaggedAt >= since);

            if (!hasRecentWarning)
            {
                context.ProjectAbuseFlags.Add(new ProjectAbuseFlag
                {
                    ProjectId = projectId,
                    UserId = userId,
                    FlagReason = ReasonRateLimitWarning,
                    Severity = "Warning",
                    FlaggedAt = DateTime.UtcNow,
                });
                await context.SaveChangesAsync();
            }

            logger.LogWarning(
                "⚠️ Nghi ngờ lạm dụng: UserId={UserId} — {Count} AI calls trong {Window} phút.",
                userId, totalCalls, DetectionWindow.TotalMinutes);
        }
    }
}
