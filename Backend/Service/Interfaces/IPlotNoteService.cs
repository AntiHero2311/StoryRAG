using Repository.Entities;
using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Service.Interfaces
{
    public interface IPlotNoteService
    {
        Task<List<PlotNoteEntry>> GetEntriesByProjectIdAsync(Guid projectId);
        Task<PlotNoteEntry?> GetEntryByIdAsync(Guid id);
        Task<PlotNoteEntry> CreateEntryAsync(Guid projectId, CreatePlotNoteRequest request);
        Task<PlotNoteEntry> UpdateEntryAsync(Guid id, UpdatePlotNoteRequest request);
        Task<bool> DeleteEntryAsync(Guid id);
        Task<bool> GenerateEmbeddingAsync(Guid id);
    }
}
