using Service.DTOs;

namespace Service.Interfaces
{
    public interface ICharacterService
    {
        Task<List<CharacterResponse>> GetAllAsync(Guid projectId, Guid userId);
        Task<CharacterResponse?> GetByIdAsync(Guid id, Guid projectId, Guid userId);
        Task<CharacterResponse> CreateAsync(Guid projectId, Guid userId, CreateCharacterRequest request);
        Task<CharacterResponse> UpdateAsync(Guid id, Guid projectId, Guid userId, UpdateCharacterRequest request);
        Task DeleteAsync(Guid id, Guid projectId, Guid userId);
        Task<CharacterResponse> EmbedAsync(Guid id, Guid projectId, Guid userId);
    }
}
