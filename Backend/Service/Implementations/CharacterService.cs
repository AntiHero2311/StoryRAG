using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Pgvector;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;

namespace Service.Implementations
{
    public class CharacterService : ICharacterService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IEmbeddingService _embeddingService;

        public CharacterService(AppDbContext context, IConfiguration config, IEmbeddingService embeddingService)
        {
            _context = context;
            _config = config;
            _embeddingService = embeddingService;
        }

        public async Task<List<CharacterResponse>> GetAllAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            return await _context.CharacterEntries
                .Where(c => c.ProjectId == projectId)
                .OrderBy(c => c.CreatedAt)
                .Select(c => MapToResponse(c, rawDek))
                .ToListAsync();
        }

        public async Task<CharacterResponse?> GetByIdAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.CharacterEntries
                .FirstOrDefaultAsync(c => c.Id == id && c.ProjectId == projectId);

            if (entry == null) return null;

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);
            return MapToResponse(entry, rawDek);
        }

        public async Task<CharacterResponse> CreateAsync(Guid projectId, Guid userId, CreateCharacterRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = new CharacterEntry
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Name = EncryptionHelper.EncryptWithMasterKey(request.Name, rawDek),
                Role = request.Role,
                Description = EncryptionHelper.EncryptWithMasterKey(request.Description, rawDek),
                Background = request.Background != null ? EncryptionHelper.EncryptWithMasterKey(request.Background, rawDek) : null,
                Notes = request.Notes != null ? EncryptionHelper.EncryptWithMasterKey(request.Notes, rawDek) : null,
                CreatedAt = DateTime.UtcNow,
            };

            _context.CharacterEntries.Add(entry);
            await _context.SaveChangesAsync();

            // Auto-embed after save (non-fatal if embedding service unavailable)
            try
            {
                var vector = await EmbedDocumentAsync(request.Name, request.Role, request.Description, request.Background ?? string.Empty);
                entry.Embedding = new Vector(vector);
                entry.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch { /* embedding failure is non-fatal */ }

            return MapToResponse(entry, rawDek);
        }

        public async Task<CharacterResponse> UpdateAsync(Guid id, Guid projectId, Guid userId, UpdateCharacterRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.CharacterEntries
                .FirstOrDefaultAsync(c => c.Id == id && c.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Không tìm thấy nhân vật.");

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            bool contentChanged = false;

            if (request.Name != null) { entry.Name = EncryptionHelper.EncryptWithMasterKey(request.Name, rawDek); contentChanged = true; }
            if (request.Role != null) entry.Role = request.Role;
            if (request.Description != null) { entry.Description = EncryptionHelper.EncryptWithMasterKey(request.Description, rawDek); contentChanged = true; }
            if (request.Background != null) { entry.Background = EncryptionHelper.EncryptWithMasterKey(request.Background, rawDek); contentChanged = true; }
            if (request.Notes != null) { entry.Notes = EncryptionHelper.EncryptWithMasterKey(request.Notes, rawDek); }

            // Clear embedding when core content changes
            if (contentChanged) entry.Embedding = null;

            entry.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Auto-embed after update when content changed (non-fatal if embedding service unavailable)
            if (contentChanged)
            {
                try
                {
                    var name = EncryptionHelper.DecryptWithMasterKey(entry.Name, rawDek);
                    var description = EncryptionHelper.DecryptWithMasterKey(entry.Description, rawDek);
                    var background = entry.Background != null ? EncryptionHelper.DecryptWithMasterKey(entry.Background, rawDek) : string.Empty;
                    var vector = await EmbedDocumentAsync(name, entry.Role, description, background);
                    entry.Embedding = new Vector(vector);
                    entry.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
                catch { /* embedding failure is non-fatal */ }
            }

            return MapToResponse(entry, rawDek);
        }

        public async Task DeleteAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.CharacterEntries
                .FirstOrDefaultAsync(c => c.Id == id && c.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Không tìm thấy nhân vật.");

            _context.CharacterEntries.Remove(entry);
            await _context.SaveChangesAsync();
        }

        public async Task<CharacterResponse> EmbedAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.CharacterEntries
                .FirstOrDefaultAsync(c => c.Id == id && c.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Không tìm thấy nhân vật.");

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var name = EncryptionHelper.DecryptWithMasterKey(entry.Name, rawDek);
            var description = EncryptionHelper.DecryptWithMasterKey(entry.Description, rawDek);
            var background = entry.Background != null ? EncryptionHelper.DecryptWithMasterKey(entry.Background, rawDek) : string.Empty;

            var embeddingVector = await EmbedDocumentAsync(name, entry.Role, description, background);
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

        private async Task<float[]> EmbedDocumentAsync(string name, string role, string description, string background)
        {
            var parts = new List<string> { name, role, description };
            if (!string.IsNullOrWhiteSpace(background)) parts.Add(background);
            var text = $"search_document: {string.Join("\n", parts)}";
            return await _embeddingService.GetEmbeddingAsync(text);
        }

        private static CharacterResponse MapToResponse(CharacterEntry e, string rawDek) => new()
        {
            Id = e.Id,
            ProjectId = e.ProjectId,
            Name = EncryptionHelper.DecryptWithMasterKey(e.Name, rawDek),
            Role = e.Role,
            Description = EncryptionHelper.DecryptWithMasterKey(e.Description, rawDek),
            Background = e.Background != null ? EncryptionHelper.DecryptWithMasterKey(e.Background, rawDek) : null,
            Notes = e.Notes != null ? EncryptionHelper.DecryptWithMasterKey(e.Notes, rawDek) : null,
            HasEmbedding = e.Embedding != null,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
        };
    }
}
