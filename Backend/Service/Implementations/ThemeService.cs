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
    public class ThemeService : IThemeService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmbeddingService _embeddingService;

        public ThemeService(AppDbContext context, IConfiguration config, IEmbeddingService embeddingService)
        {
            _context = context;
            _config = config;
            _embeddingService = embeddingService;
        }

        public async Task<List<ThemeResponse>> GetEntriesByProjectIdAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            return await _context.ThemeEntries
                .Where(e => e.ProjectId == projectId)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => MapToResponse(e, rawDek))
                .ToListAsync();
        }

        public async Task<ThemeResponse?> GetEntryByIdAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.ThemeEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entry == null) return null;

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);
            return MapToResponse(entry, rawDek);
        }

        public async Task<ThemeResponse> CreateEntryAsync(Guid projectId, Guid userId, CreateThemeRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = new ThemeEntry
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek),
                Description = EncryptionHelper.EncryptWithMasterKey(request.Description, rawDek),
                Notes = request.Notes != null ? EncryptionHelper.EncryptWithMasterKey(request.Notes, rawDek) : null,
                CreatedAt = DateTime.UtcNow,
            };

            var embeddingVector = await EmbedDocumentAsync(
                request.Title,
                request.Description,
                request.Notes);
            entry.Embedding = new Vector(embeddingVector);
            entry.UpdatedAt = DateTime.UtcNow;

            _context.ThemeEntries.Add(entry);
            await _context.SaveChangesAsync();

            return MapToResponse(entry, rawDek);
        }

        public async Task<ThemeResponse> UpdateEntryAsync(Guid id, Guid projectId, Guid userId, UpdateThemeRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = await _context.ThemeEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Theme not found");

            if (request.Title != null) entry.Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek);
            if (request.Description != null) entry.Description = EncryptionHelper.EncryptWithMasterKey(request.Description, rawDek);
            if (request.Notes != null) entry.Notes = EncryptionHelper.EncryptWithMasterKey(request.Notes, rawDek);

            var shouldRegenerateEmbedding = request.Title != null || request.Description != null || request.Notes != null;
            if (shouldRegenerateEmbedding)
            {
                var title = request.Title ?? EncryptionHelper.DecryptWithMasterKey(entry.Title, rawDek);
                var description = request.Description ?? EncryptionHelper.DecryptWithMasterKey(entry.Description, rawDek);
                var notes = request.Notes ?? (entry.Notes != null ? EncryptionHelper.DecryptWithMasterKey(entry.Notes, rawDek) : null);
                var embeddingVector = await EmbedDocumentAsync(title, description, notes);

                entry.Embedding = new Vector(embeddingVector);
            }

            entry.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToResponse(entry, rawDek);
        }

        public async Task<bool> DeleteEntryAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var entry = await _context.ThemeEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entry == null) return false;

            _context.ThemeEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<ThemeResponse> GenerateEmbeddingAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.ThemeEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Theme not found");

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);
            var title = EncryptionHelper.DecryptWithMasterKey(entry.Title, rawDek);
            var description = EncryptionHelper.DecryptWithMasterKey(entry.Description, rawDek);
            var notes = entry.Notes != null ? EncryptionHelper.DecryptWithMasterKey(entry.Notes, rawDek) : null;
            var embeddingVector = await EmbedDocumentAsync(title, description, notes);

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

        private async Task<float[]> EmbedDocumentAsync(string title, string description, string? notes)
        {
            var notesText = string.IsNullOrWhiteSpace(notes) ? string.Empty : $"\n{notes}";
            var text = $"search_document: {title}\n{description}{notesText}";
            return await _embeddingService.GetEmbeddingAsync(text);
        }

        private static ThemeResponse MapToResponse(ThemeEntry e, string rawDek) => new()
        {
            Id = e.Id,
            ProjectId = e.ProjectId,
            Title = EncryptionHelper.DecryptWithMasterKey(e.Title, rawDek),
            Description = EncryptionHelper.DecryptWithMasterKey(e.Description, rawDek),
            Notes = e.Notes != null ? EncryptionHelper.DecryptWithMasterKey(e.Notes, rawDek) : null,
            HasEmbedding = e.Embedding != null,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
        };
    }
}
