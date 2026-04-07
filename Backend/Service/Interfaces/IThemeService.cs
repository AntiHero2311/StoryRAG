using Repository.Entities;
using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Service.Interfaces
{
    public interface IThemeService
    {
        Task<List<ThemeResponse>> GetEntriesByProjectIdAsync(Guid projectId, Guid userId);
        Task<ThemeResponse?> GetEntryByIdAsync(Guid id, Guid projectId, Guid userId);
        Task<ThemeResponse> CreateEntryAsync(Guid projectId, Guid userId, CreateThemeRequest request);
        Task<ThemeResponse> UpdateEntryAsync(Guid id, Guid projectId, Guid userId, UpdateThemeRequest request);
        Task<bool> DeleteEntryAsync(Guid id, Guid projectId, Guid userId);
        Task<bool> GenerateEmbeddingAsync(Guid id, Guid projectId, Guid userId);
    }
}
