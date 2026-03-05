using Service.DTOs;

namespace Service.Interfaces
{
    public interface IUserSettingsService
    {
        Task<EditorSettingsResponse> GetAsync(Guid userId);
        Task<EditorSettingsResponse> UpdateAsync(Guid userId, UpdateEditorSettingsRequest request);
    }
}
