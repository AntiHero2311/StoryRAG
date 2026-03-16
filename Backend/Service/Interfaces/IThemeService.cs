using Repository.Entities;
using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Service.Interfaces
{
    public interface IThemeService
    {
        Task<List<ThemeEntry>> GetEntriesByProjectIdAsync(Guid projectId);
        Task<ThemeEntry?> GetEntryByIdAsync(Guid id);
        Task<ThemeEntry> CreateEntryAsync(Guid projectId, CreateThemeRequest request);
        Task<ThemeEntry> UpdateEntryAsync(Guid id, UpdateThemeRequest request);
        Task<bool> DeleteEntryAsync(Guid id);
        Task<bool> GenerateEmbeddingAsync(Guid id);
    }
}
