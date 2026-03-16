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
    public class StyleGuideService : IStyleGuideService
    {
        private readonly AppDbContext _context;

        public StyleGuideService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<StyleGuideEntry>> GetEntriesByProjectIdAsync(Guid projectId)
        {
            return await _context.StyleGuideEntries
                .Where(e => e.ProjectId == projectId)
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();
        }

        public async Task<StyleGuideEntry?> GetEntryByIdAsync(Guid id)
        {
            return await _context.StyleGuideEntries.FirstOrDefaultAsync(e => e.Id == id);
        }

        public async Task<StyleGuideEntry> CreateEntryAsync(Guid projectId, CreateStyleGuideRequest request)
        {
            var entry = new StyleGuideEntry
            {
                ProjectId = projectId,
                Aspect = request.Aspect,
                Content = request.Content
            };

            _context.StyleGuideEntries.Add(entry);
            await _context.SaveChangesAsync();
            return entry;
        }

        public async Task<StyleGuideEntry> UpdateEntryAsync(Guid id, UpdateStyleGuideRequest request)
        {
            var entry = await _context.StyleGuideEntries.FindAsync(id);
            if (entry == null) throw new KeyNotFoundException("Entry not found");

            if (request.Aspect != null) entry.Aspect = request.Aspect;
            if (request.Content != null) entry.Content = request.Content;

            entry.UpdatedAt = DateTime.UtcNow;
            
            // Clear embedding if content updated
            if (request.Aspect != null || request.Content != null)
            {
                entry.Embedding = null;
            }

            await _context.SaveChangesAsync();
            return entry;
        }

        public async Task<bool> DeleteEntryAsync(Guid id)
        {
            var entry = await _context.StyleGuideEntries.FindAsync(id);
            if (entry == null) return false;

            _context.StyleGuideEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> GenerateEmbeddingAsync(Guid id)
        {
            // Implementation for embedding goes here (using similar logic to CharacterService)
            // Since User has AI integration later down the stack, we just provide the signature.
            throw new NotImplementedException();
        }
    }
}
