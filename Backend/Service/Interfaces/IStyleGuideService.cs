using Repository.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Service.DTOs;

namespace Service.Interfaces
{
    public interface IStyleGuideService
    {
        Task<List<StyleGuideEntry>> GetEntriesByProjectIdAsync(Guid projectId);
        Task<StyleGuideEntry?> GetEntryByIdAsync(Guid id);
        Task<StyleGuideEntry> CreateEntryAsync(Guid projectId, CreateStyleGuideRequest request);
        Task<StyleGuideEntry> UpdateEntryAsync(Guid id, UpdateStyleGuideRequest request);
        Task<bool> DeleteEntryAsync(Guid id);
        Task<bool> GenerateEmbeddingAsync(Guid id);
    }
}
