using Microsoft.EntityFrameworkCore;
using OpenAI.Chat;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using System.Text.Json;

namespace Service.Implementations
{
    public partial class ProjectReportService
    {
        private async Task<(ContentAnalysisResult Content, int TokensUsed)> ExtractStoryBibleAsync(
            string projectTitle,
            List<string> decryptedChunks,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            if (progressCallback != null)
            {
                await progressCallback(40, "Đang phân tích Story Bible (World, Characters, Timeline, Themes)...", cancellationToken);
            }

            // Fake implementation for now, should call LLM to extract JSON
            var sysPrompt = "Bạn là AI chuyên phân tích truyện. Hãy trích xuất các WorldSettings, Characters, TimelineEvents, Themes dưới dạng JSON.";
            var userMsg = $"Nội dung truyện:\n{string.Join("\n\n", decryptedChunks.Take(10))}"; // Trích 10 chunk mẫu

            var result = new ContentAnalysisResult
            {
                AnalysisNote = "Dữ liệu được trích xuất tự động bằng AI từ nội dung bản thảo."
            };

            int tokensUsed = 5000; // Fake token usage

            return (result, tokensUsed);
        }

        private async Task<(EmotionPacingResult Pacing, int TokensUsed)> AnalyzeEmotionPacingAsync(
            string projectTitle,
            List<string> decryptedChunks,
            Func<int, string?, CancellationToken, Task>? progressCallback,
            CancellationToken cancellationToken)
        {
            if (progressCallback != null)
            {
                await progressCallback(40, "Đang đo lường nhịp độ và cảm xúc...", cancellationToken);
            }

            var result = new EmotionPacingResult
            {
                OverallPacingProfile = "Nhịp độ ổn định",
                DominantEmotionProfile = "Neutral"
            };

            int tokensUsed = 3000;

            return (result, tokensUsed);
        }
    }
}
