using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class UserSettingsService : IUserSettingsService
    {
        private readonly AppDbContext _context;

        public UserSettingsService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<EditorSettingsResponse> GetAsync(Guid userId)
        {
            var settings = await _context.UserSettings.FindAsync(userId);
            return settings == null
                ? new EditorSettingsResponse()
                : new EditorSettingsResponse { EditorFont = settings.EditorFont, EditorFontSize = settings.EditorFontSize };
        }

        public async Task<EditorSettingsResponse> UpdateAsync(Guid userId, UpdateEditorSettingsRequest request)
        {
            var settings = await _context.UserSettings.FindAsync(userId);
            if (settings == null)
            {
                settings = new UserSettings { UserId = userId };
                _context.UserSettings.Add(settings);
            }

            if (request.EditorFont != null) settings.EditorFont = request.EditorFont;
            if (request.EditorFontSize.HasValue) settings.EditorFontSize = request.EditorFontSize.Value;

            await _context.SaveChangesAsync();
            return new EditorSettingsResponse { EditorFont = settings.EditorFont, EditorFontSize = settings.EditorFontSize };
        }
    }
}
