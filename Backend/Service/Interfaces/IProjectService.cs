using Service.DTOs;

namespace Service.Interfaces
{
    public interface IProjectService
    {
        Task<List<ProjectResponse>> GetUserProjectsAsync(Guid userId);
        Task<ProjectResponse> GetProjectByIdAsync(Guid projectId, Guid userId);
        Task<ProjectResponse> CreateProjectAsync(Guid userId, CreateProjectRequest request);
        Task<ProjectResponse> UpdateProjectAsync(Guid projectId, Guid userId, UpdateProjectRequest request);
        Task DeleteProjectAsync(Guid projectId, Guid userId);
        Task<AuthorDashboardStats> GetUserStatsAsync(Guid userId);
        Task<(string fileName, string content, string mimeType)> ExportProjectAsync(Guid projectId, Guid userId);
    }

    public class AuthorDashboardStats
    {
        public int TotalChapters { get; set; }
        public int TotalAnalysesUsed { get; set; }
        public int TotalChatMessages { get; set; }
    }
}
