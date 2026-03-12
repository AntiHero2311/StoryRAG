using Microsoft.Extensions.Logging;
using OpenAI.Chat;
using System.ClientModel;
using System.Net;

namespace Service.Helpers
{
    /// <summary>
    /// Retry helper cho Gemini free tier — xử lý 429 Too Many Requests với exponential backoff.
    /// Free tier limits: gemma-3-27b-it ~30 RPM / 14.4K RPD, gemini-embedding-001 ~100 RPM / 1K RPD.
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

        /// <summary>
        /// Gemma 3 không hỗ trợ system role ("Developer instruction is not enabled").
        /// Phương thức này merge system message vào đầu user message đầu tiên.
        /// </summary>
        public static List<ChatMessage> FlattenSystemForGemma(IEnumerable<ChatMessage> messages)
        {
            var list = messages.ToList();
            var systemParts = list
                .OfType<SystemChatMessage>()
                .SelectMany(s => s.Content)
                .Select(p => p.Text)
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .ToList();

            if (systemParts.Count == 0) return list;

            var systemText = string.Join("\n\n", systemParts);
            var remaining = list.Where(m => m is not SystemChatMessage).ToList();

            var firstUser = remaining.FirstOrDefault(m => m is UserChatMessage);
            if (firstUser != null)
            {
                var idx = remaining.IndexOf(firstUser);
                var originalText = firstUser.Content[0].Text;
                remaining[idx] = ChatMessage.CreateUserMessage(
                    $"[Hướng dẫn hệ thống]\n{systemText}\n\n[Câu hỏi của người dùng]\n{originalText}");
            }
            else
            {
                remaining.Insert(0, ChatMessage.CreateUserMessage($"[Hướng dẫn hệ thống]\n{systemText}"));
            }

            return remaining;
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
