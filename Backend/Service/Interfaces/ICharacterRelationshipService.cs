using Service.DTOs;

namespace Service.Interfaces
{
    public interface ICharacterRelationshipService
    {
        Task<CharacterRelationshipExtractResult> ExtractAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<CharacterRelationshipDto>> GetAllAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default);
    }
}

