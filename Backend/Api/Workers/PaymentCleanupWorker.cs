using Microsoft.EntityFrameworkCore;
using Repository.Data;

namespace Api.Workers
{
    public class PaymentCleanupWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<PaymentCleanupWorker> _logger;
        private readonly TimeSpan _pollInterval = TimeSpan.FromMinutes(5); // Run every 5 minutes
        private readonly TimeSpan _staleThreshold = TimeSpan.FromMinutes(30); // Payments older than 30 mins are stale

        public PaymentCleanupWorker(IServiceScopeFactory scopeFactory, ILogger<PaymentCleanupWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("PaymentCleanupWorker is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanUpStalePaymentsAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error in PaymentCleanupWorker.");
                }

                await Task.Delay(_pollInterval, stoppingToken);
            }

            _logger.LogInformation("PaymentCleanupWorker is stopping.");
        }

        private async Task CleanUpStalePaymentsAsync(CancellationToken stoppingToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var thresholdTime = DateTime.UtcNow.Subtract(_staleThreshold);

            // Find payments in 'Pending' state created before the thresholdTime
            var stalePayments = await context.Payments
                .Where(p => p.Status == "Pending" && p.CreatedAt < thresholdTime)
                .ToListAsync(stoppingToken);

            if (stalePayments.Count > 0)
            {
                _logger.LogInformation("PaymentCleanupWorker found {Count} stale pending payments. Cancelling them...", stalePayments.Count);

                foreach (var payment in stalePayments)
                {
                    payment.Status = "Cancelled";
                    payment.UpdatedAt = DateTime.UtcNow;
                    payment.Description = (payment.Description ?? "") + " (Tự động huỷ do hết hạn giao dịch)";
                }

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("PaymentCleanupWorker successfully cancelled {Count} stale payments.", stalePayments.Count);
            }
        }
    }
}
