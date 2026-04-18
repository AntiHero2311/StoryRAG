using Service.DTOs;

namespace Service.Interfaces
{
    public interface INarrativeAnalyticsService
    {
        Task<NarrativeChartsResponse> GetNarrativeChartsAsync(Guid projectId, Guid userId, Guid? chapterId = null);
    }
}
