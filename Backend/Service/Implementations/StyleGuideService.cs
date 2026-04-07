using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
    public class StyleGuideService : IStyleGuideService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public StyleGuideService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<List<StyleGuideResponse>> GetEntriesByProjectIdAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            return await _context.StyleGuideEntries
                .Where(e => e.ProjectId == projectId)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => MapToResponse(e, rawDek))
                .ToListAsync();
        }

        public async Task<StyleGuideResponse?> GetEntryByIdAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.StyleGuideEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entry == null) return null;

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);
            return MapToResponse(entry, rawDek);
        }

        public async Task<StyleGuideResponse> CreateEntryAsync(Guid projectId, Guid userId, CreateStyleGuideRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = new StyleGuideEntry
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Aspect = request.Aspect,
                Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek),
                CreatedAt = DateTime.UtcNow
            };

            _context.StyleGuideEntries.Add(entry);
            await _context.SaveChangesAsync();
            return MapToResponse(entry, rawDek);
        }

        public async Task<StyleGuideResponse> UpdateEntryAsync(Guid id, Guid projectId, Guid userId, UpdateStyleGuideRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = await _context.StyleGuideEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Style guide not found");

            if (request.Aspect != null) entry.Aspect = request.Aspect;
            if (request.Content != null) entry.Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek);

            entry.UpdatedAt = DateTime.UtcNow;

            if (request.Aspect != null || request.Content != null)
            {
                entry.Embedding = null;
            }

            await _context.SaveChangesAsync();
            return MapToResponse(entry, rawDek);
        }

        public async Task<bool> DeleteEntryAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var entry = await _context.StyleGuideEntries.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entry == null) return false;

            _context.StyleGuideEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> GenerateEmbeddingAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            throw new NotImplementedException();
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

        private static StyleGuideResponse MapToResponse(StyleGuideEntry e, string rawDek) => new()
        {
            Id = e.Id,
            ProjectId = e.ProjectId,
            Aspect = e.Aspect,
            Content = EncryptionHelper.DecryptWithMasterKey(e.Content, rawDek),
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
        };
    }
}
