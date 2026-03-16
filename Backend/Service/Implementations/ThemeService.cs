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
    public class ThemeService : IThemeService
    {
        private readonly AppDbContext _context;

        public ThemeService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<ThemeEntry>> GetEntriesByProjectIdAsync(Guid projectId)
        {
            return await _context.ThemeEntries
                .Where(e => e.ProjectId == projectId)
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();
        }

        public async Task<ThemeEntry?> GetEntryByIdAsync(Guid id)
        {
            return await _context.ThemeEntries.FirstOrDefaultAsync(e => e.Id == id);
        }

        public async Task<ThemeEntry> CreateEntryAsync(Guid projectId, CreateThemeRequest request)
        {
            var entry = new ThemeEntry
            {
                ProjectId = projectId,
                Title = request.Title,
                Description = request.Description,
                Notes = request.Notes
            };

            _context.ThemeEntries.Add(entry);
            await _context.SaveChangesAsync();
            return entry;
        }

        public async Task<ThemeEntry> UpdateEntryAsync(Guid id, UpdateThemeRequest request)
        {
            var entry = await _context.ThemeEntries.FindAsync(id);
            if (entry == null) throw new KeyNotFoundException("Entry not found");

            if (request.Title != null) entry.Title = request.Title;
            if (request.Description != null) entry.Description = request.Description;
            if (request.Notes != null) entry.Notes = request.Notes;

            entry.UpdatedAt = DateTime.UtcNow;

            if (request.Title != null || request.Description != null || request.Notes != null)
            {
                entry.Embedding = null;
            }

            await _context.SaveChangesAsync();
            return entry;
        }

        public async Task<bool> DeleteEntryAsync(Guid id)
        {
            var entry = await _context.ThemeEntries.FindAsync(id);
            if (entry == null) return false;

            _context.ThemeEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> GenerateEmbeddingAsync(Guid id)
        {
            throw new NotImplementedException();
        }
    }
}
