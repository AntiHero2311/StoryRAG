using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.Interfaces;
using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Service.Implementations
{
    public class PlotNoteService : IPlotNoteService
    {
        private readonly AppDbContext _context;

        public PlotNoteService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<PlotNoteEntry>> GetEntriesByProjectIdAsync(Guid projectId)
        {
            return await _context.PlotNoteEntries
                .Where(e => e.ProjectId == projectId)
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();
        }

        public async Task<PlotNoteEntry?> GetEntryByIdAsync(Guid id)
        {
            return await _context.PlotNoteEntries.FirstOrDefaultAsync(e => e.Id == id);
        }

        public async Task<PlotNoteEntry> CreateEntryAsync(Guid projectId, CreatePlotNoteRequest request)
        {
            var entry = new PlotNoteEntry
            {
                ProjectId = projectId,
                Type = request.Type,
                Title = request.Title,
                Content = request.Content
            };

            _context.PlotNoteEntries.Add(entry);
            await _context.SaveChangesAsync();
            return entry;
        }

        public async Task<PlotNoteEntry> UpdateEntryAsync(Guid id, UpdatePlotNoteRequest request)
        {
            var entry = await _context.PlotNoteEntries.FindAsync(id);
            if (entry == null) throw new KeyNotFoundException("Entry not found");

            if (request.Type != null) entry.Type = request.Type;
            if (request.Title != null) entry.Title = request.Title;
            if (request.Content != null) entry.Content = request.Content;

            entry.UpdatedAt = DateTime.UtcNow;

            if (request.Type != null || request.Title != null || request.Content != null)
            {
                entry.Embedding = null;
            }

            await _context.SaveChangesAsync();
            return entry;
        }

        public async Task<bool> DeleteEntryAsync(Guid id)
        {
            var entry = await _context.PlotNoteEntries.FindAsync(id);
            if (entry == null) return false;

            _context.PlotNoteEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> GenerateEmbeddingAsync(Guid id)
        {
            throw new NotImplementedException();
        }
    }
}
