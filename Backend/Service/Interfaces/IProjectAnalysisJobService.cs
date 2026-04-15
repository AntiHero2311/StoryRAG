using Service.DTOs;

namespace Service.Interfaces
{
    public interface IProjectAnalysisJobService
    {
        Task<ProjectAnalysisJobResponse> EnqueueAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default);
        Task<ProjectAnalysisJobResponse?> GetActiveJobAsync(Guid userId, Guid? projectId = null, CancellationToken cancellationToken = default);
        Task<ProjectAnalysisJobResponse?> GetJobAsync(Guid projectId, Guid jobId, Guid userId, CancellationToken cancellationToken = default);
        Task<ProjectReportResponse> GetJobResultAsync(Guid projectId, Guid jobId, Guid userId, CancellationToken cancellationToken = default);
        Task<ProjectAnalysisJobResponse> CancelJobAsync(Guid projectId, Guid jobId, Guid userId, CancellationToken cancellationToken = default);
        Task ProcessJobAsync(Guid jobId, CancellationToken cancellationToken = default);
    }
}
