using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Service.Interfaces
{
    public interface IAiAnalysisHistoryService
    {
        Task SaveHistoryAsync(Guid projectId, Guid? chapterId, Guid userId, string analysisType, string jsonResult, int totalTokens);
        Task<AiAnalysisHistoryResult> GetHistoryAsync(Guid projectId, Guid userId, string analysisType, int page, int pageSize);
    }

    public class AiAnalysisHistoryDto
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public Guid? ChapterId { get; set; }
        public string AnalysisType { get; set; } = string.Empty;
        public string ResultJson { get; set; } = string.Empty;
        public int TotalTokens { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AiAnalysisHistoryResult
    {
        public List<AiAnalysisHistoryDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
