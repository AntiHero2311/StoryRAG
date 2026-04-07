using Repository.Entities;
using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Service.Interfaces
{
    public interface IPlotNoteService
    {
        Task<List<PlotNoteResponse>> GetEntriesByProjectIdAsync(Guid projectId, Guid userId);
        Task<PlotNoteResponse?> GetEntryByIdAsync(Guid id, Guid projectId, Guid userId);
        Task<PlotNoteResponse> CreateEntryAsync(Guid projectId, Guid userId, CreatePlotNoteRequest request);
        Task<PlotNoteResponse> UpdateEntryAsync(Guid id, Guid projectId, Guid userId, UpdatePlotNoteRequest request);
        Task<bool> DeleteEntryAsync(Guid id, Guid projectId, Guid userId);
        Task<bool> GenerateEmbeddingAsync(Guid id, Guid projectId, Guid userId);
    }
}
