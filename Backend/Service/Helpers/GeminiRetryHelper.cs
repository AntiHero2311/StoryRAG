using Microsoft.Extensions.Logging;
using System.ClientModel;
using System.Net;

namespace Service.Helpers
{
    /// <summary>
    /// Retry helper cho Gemini free tier — xử lý 429 Too Many Requests với exponential backoff.
    /// Free tier limits: ~15 RPM cho chat, ~1500 RPD cho embedding.
    /// </summary>
    public static class GeminiRetryHelper
    {
        private static readonly int[] BackoffSeconds = [10, 30, 65];

        /// <summary>
        /// Retry async action khi gặp 429. Dùng cho cả OpenAI SDK và HttpClient calls.
        /// </summary>
        public static async Task<T> ExecuteAsync<T>(
            Func<Task<T>> action,
            ILogger logger,
            string operationName = "Gemini",
            int maxRetries = 3)
        {
            for (var attempt = 0; attempt <= maxRetries; attempt++)
            {
                try
                {
                    return await action();
                }
                catch (Exception ex) when (attempt < maxRetries && Is429(ex))
                {
                    var wait = GetWaitSeconds(ex, attempt);
                    logger.LogWarning("{Op} gặp 429 Too Many Requests (lần {Attempt}/{Max}). Chờ {Wait}s...",
                        operationName, attempt + 1, maxRetries, wait);
                    await Task.Delay(TimeSpan.FromSeconds(wait));
                }
            }

            // Attempt cuối — không catch, để lỗi propagate lên
            return await action();
        }

        private static bool Is429(Exception ex)
        {
            // OpenAI SDK throws ClientResultException for HTTP errors
            if (ex is ClientResultException cre && cre.Status == (int)HttpStatusCode.TooManyRequests)
                return true;

            // HttpClient throws HttpRequestException
            if (ex is HttpRequestException hre && hre.StatusCode == HttpStatusCode.TooManyRequests)
                return true;

            return false;
        }

        private static int GetWaitSeconds(Exception ex, int attempt)
        {
            // Đọc Retry-After header nếu có (OpenAI SDK expose qua message hoặc inner)
            // Fallback về exponential backoff
            return BackoffSeconds[Math.Min(attempt, BackoffSeconds.Length - 1)];
        }
    }
}
