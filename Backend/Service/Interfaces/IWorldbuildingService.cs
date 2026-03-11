using Service.DTOs;

namespace Service.Interfaces
{
    public interface IWorldbuildingService
    {
        Task<List<WorldbuildingResponse>> GetAllAsync(Guid projectId, Guid userId);
        Task<WorldbuildingResponse?> GetByIdAsync(Guid id, Guid projectId, Guid userId);
        Task<WorldbuildingResponse> CreateAsync(Guid projectId, Guid userId, CreateWorldbuildingRequest request);
        Task<WorldbuildingResponse> UpdateAsync(Guid id, Guid projectId, Guid userId, UpdateWorldbuildingRequest request);
        Task DeleteAsync(Guid id, Guid projectId, Guid userId);
        Task<WorldbuildingResponse> EmbedAsync(Guid id, Guid projectId, Guid userId);
    }
}
