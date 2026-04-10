using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Pgvector;
using Repository.Data;
using Repository.Entities;
using Service.Helpers;
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
        private readonly IConfiguration _config;
        private readonly IEmbeddingService _embeddingService;

        public PlotNoteService(AppDbContext context, IConfiguration config, IEmbeddingService embeddingService)
        {
            _context = context;
            _config = config;
            _embeddingService = embeddingService;
        }

        public async Task<List<PlotNoteResponse>> GetEntriesByProjectIdAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            return await _context.PlotNoteEntries
                .Where(e => e.ProjectId == projectId)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => MapToResponse(e, rawDek))
                .ToListAsync();
        }

        public async Task<PlotNoteResponse?> GetEntryByIdAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            
            var entry = await _context.PlotNoteEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entry == null) return null;

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);
            return MapToResponse(entry, rawDek);
        }

        public async Task<PlotNoteResponse> CreateEntryAsync(Guid projectId, Guid userId, CreatePlotNoteRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = new PlotNoteEntry
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Type = request.Type, // Type is an enum/category usually, but we can encrypt if needed. It's safe leaving as clear text if it's just 'Arc', 'Twist'. Keeping it clear to allow querying/filtering.
                Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek),
                Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek),
                CreatedAt = DateTime.UtcNow,
            };

            var embeddingVector = await EmbedDocumentAsync(
                request.Type,
                request.Title,
                request.Content);
            entry.Embedding = new Vector(embeddingVector);
            entry.UpdatedAt = DateTime.UtcNow;

            _context.PlotNoteEntries.Add(entry);
            await _context.SaveChangesAsync();

            return MapToResponse(entry, rawDek);
        }

        public async Task<PlotNoteResponse> UpdateEntryAsync(Guid id, Guid projectId, Guid userId, UpdatePlotNoteRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = await _context.PlotNoteEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Plot note not found");

            if (request.Type != null) entry.Type = request.Type;
            if (request.Title != null) entry.Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek);
            if (request.Content != null) entry.Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek);

            var shouldRegenerateEmbedding = request.Type != null || request.Title != null || request.Content != null;
            if (shouldRegenerateEmbedding)
            {
                var type = request.Type ?? entry.Type;
                var title = request.Title ?? EncryptionHelper.DecryptWithMasterKey(entry.Title, rawDek);
                var content = request.Content ?? EncryptionHelper.DecryptWithMasterKey(entry.Content, rawDek);
                var embeddingVector = await EmbedDocumentAsync(type, title, content);

                entry.Embedding = new Vector(embeddingVector);
            }

            entry.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToResponse(entry, rawDek);
        }

        public async Task<bool> DeleteEntryAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var entry = await _context.PlotNoteEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entry == null) return false;

            _context.PlotNoteEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<PlotNoteResponse> GenerateEmbeddingAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.PlotNoteEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Plot note not found");

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);
            var title = EncryptionHelper.DecryptWithMasterKey(entry.Title, rawDek);
            var content = EncryptionHelper.DecryptWithMasterKey(entry.Content, rawDek);
            var embeddingVector = await EmbedDocumentAsync(entry.Type, title, content);

            entry.Embedding = new Vector(embeddingVector);
            entry.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToResponse(entry, rawDek);
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private async Task VerifyOwnershipAsync(Guid projectId, Guid userId)
        {
            var exists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId);
            if (!exists)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        private async Task<Repository.Entities.User> GetUserAsync(Guid userId) =>
            await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("User không tồn tại.");

        private string GetDek(Repository.Entities.User user)
        {
            var masterKey = _config["Security:MasterKey"]!;
            return EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);
        }

        private async Task<float[]> EmbedDocumentAsync(string type, string title, string content)
        {
            var text = $"search_document: {type}\n{title}\n{content}";
            return await _embeddingService.GetEmbeddingAsync(text);
        }

        private static PlotNoteResponse MapToResponse(PlotNoteEntry e, string rawDek) => new()
        {
            Id = e.Id,
            ProjectId = e.ProjectId,
            Type = e.Type,
            Title = EncryptionHelper.DecryptWithMasterKey(e.Title, rawDek),
            Content = EncryptionHelper.DecryptWithMasterKey(e.Content, rawDek),
            HasEmbedding = e.Embedding != null,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
        };
    }
}
