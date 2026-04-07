using Repository.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Service.DTOs;

namespace Service.Interfaces
{
    public interface IStyleGuideService
    {
        Task<List<StyleGuideResponse>> GetEntriesByProjectIdAsync(Guid projectId, Guid userId);
        Task<StyleGuideResponse?> GetEntryByIdAsync(Guid id, Guid projectId, Guid userId);
        Task<StyleGuideResponse> CreateEntryAsync(Guid projectId, Guid userId, CreateStyleGuideRequest request);
        Task<StyleGuideResponse> UpdateEntryAsync(Guid id, Guid projectId, Guid userId, UpdateStyleGuideRequest request);
        Task<bool> DeleteEntryAsync(Guid id, Guid projectId, Guid userId);
        Task<bool> GenerateEmbeddingAsync(Guid id, Guid projectId, Guid userId);
    }
}
