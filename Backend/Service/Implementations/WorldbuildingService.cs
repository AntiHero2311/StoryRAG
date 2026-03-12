using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Pgvector;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Net.Http.Json;

namespace Service.Implementations
{
    public class WorldbuildingService : IWorldbuildingService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public WorldbuildingService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<List<WorldbuildingResponse>> GetAllAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            return await _context.WorldbuildingEntries
                .Where(w => w.ProjectId == projectId)
                .OrderBy(w => w.CreatedAt)
                .Select(w => MapToResponse(w, rawDek))
                .ToListAsync();
        }

        public async Task<WorldbuildingResponse?> GetByIdAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.WorldbuildingEntries
                .FirstOrDefaultAsync(w => w.Id == id && w.ProjectId == projectId);

            if (entry == null) return null;

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);
            return MapToResponse(entry, rawDek);
        }

        public async Task<WorldbuildingResponse> CreateAsync(Guid projectId, Guid userId, CreateWorldbuildingRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entry = new WorldbuildingEntry
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek),
                Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek),
                Category = request.Category,
                CreatedAt = DateTime.UtcNow,
            };

            _context.WorldbuildingEntries.Add(entry);
            await _context.SaveChangesAsync();

            // Auto-embed after save (non-fatal if embedding service unavailable)
            try
            {
                var vector = await EmbedDocumentAsync(request.Title, request.Content);
                entry.Embedding = new Vector(vector);
                entry.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch { /* embedding failure is non-fatal */ }

            return MapToResponse(entry, rawDek);
        }

        public async Task<WorldbuildingResponse> UpdateAsync(Guid id, Guid projectId, Guid userId, UpdateWorldbuildingRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.WorldbuildingEntries
                .FirstOrDefaultAsync(w => w.Id == id && w.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Không tìm thấy mục worldbuilding.");

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            if (request.Title != null)
                entry.Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek);
            if (request.Content != null)
                entry.Content = EncryptionHelper.EncryptWithMasterKey(request.Content, rawDek);
            if (request.Category != null)
                entry.Category = request.Category;

            // Clear embedding when content changes
            if (request.Title != null || request.Content != null)
                entry.Embedding = null;

            entry.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Auto-embed after update when content changed (non-fatal if embedding service unavailable)
            if (request.Title != null || request.Content != null)
            {
                try
                {
                    var title = EncryptionHelper.DecryptWithMasterKey(entry.Title, rawDek);
                    var content = EncryptionHelper.DecryptWithMasterKey(entry.Content, rawDek);
                    var vector = await EmbedDocumentAsync(title, content);
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

            var entry = await _context.WorldbuildingEntries
                .FirstOrDefaultAsync(w => w.Id == id && w.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Không tìm thấy mục worldbuilding.");

            _context.WorldbuildingEntries.Remove(entry);
            await _context.SaveChangesAsync();
        }

        public async Task<WorldbuildingResponse> EmbedAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var entry = await _context.WorldbuildingEntries
                .FirstOrDefaultAsync(w => w.Id == id && w.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Không tìm thấy mục worldbuilding.");

            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var title = EncryptionHelper.DecryptWithMasterKey(entry.Title, rawDek);
            var content = EncryptionHelper.DecryptWithMasterKey(entry.Content, rawDek);
            var embeddingVector = await EmbedDocumentAsync(title, content);
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

        private async Task<float[]> EmbedDocumentAsync(string title, string content)
        {
            var text = $"search_document: {title}\n\n{content}";
            // Direct HTTP call to avoid search_query prefix in GetEmbeddingAsync
            var baseUrl = _config["AI:BaseUrl"] ?? "http://localhost:1234/v1";
            var apiKey = _config["AI:ApiKey"] ?? "lm-studio";
            var model = _config["AI:EmbeddingModel"] ?? "nomic-embed-text";

            using var http = new System.Net.Http.HttpClient();
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            var body = new { model, input = new[] { text } };
            var response = await http.PostAsJsonAsync($"{baseUrl}/embeddings", body);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            return json.GetProperty("data")[0].GetProperty("embedding")
                .EnumerateArray().Select(x => x.GetSingle()).ToArray();
        }

        private static WorldbuildingResponse MapToResponse(WorldbuildingEntry e, string rawDek) => new()
        {
            Id = e.Id,
            ProjectId = e.ProjectId,
            Title = EncryptionHelper.DecryptWithMasterKey(e.Title, rawDek),
            Content = EncryptionHelper.DecryptWithMasterKey(e.Content, rawDek),
            Category = e.Category,
            HasEmbedding = e.Embedding != null,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
        };
    }
}
