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
    public class ProjectService : IProjectService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public ProjectService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<List<ProjectResponse>> GetUserProjectsAsync(Guid userId)
        {
            var user = await GetUserWithDekAsync(userId);
            var rawDek = GetRawDek(user);

            var projects = await _context.Projects
                .Include(p => p.ProjectGenres)
                    .ThenInclude(pg => pg.Genre)
                .Where(p => p.AuthorId == userId && !p.IsDeleted)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return projects.Select(p => MapToResponse(p, rawDek)).ToList();
        }

        public async Task<ProjectResponse> GetProjectByIdAsync(Guid projectId, Guid userId)
        {
            var project = await _context.Projects
                .Include(p => p.ProjectGenres)
                    .ThenInclude(pg => pg.Genre)
                .FirstOrDefaultAsync(p => p.Id == projectId && p.AuthorId == userId && !p.IsDeleted)
                ?? throw new Exception("Không tìm thấy dự án.");

            var user = await GetUserWithDekAsync(userId);
            var rawDek = GetRawDek(user);

            return MapToResponse(project, rawDek);
        }

        public async Task<ProjectResponse> CreateProjectAsync(Guid userId, CreateProjectRequest request)
        {
            var user = await _context.Users.FindAsync(userId)
                ?? throw new Exception("Người dùng không tồn tại.");

            // If user doesn't have a DEK yet (e.g. migration didn't generate one), create it now
            if (string.IsNullOrEmpty(user.DataEncryptionKey))
            {
                string masterKeyForDek = _config["Security:MasterKey"]
                    ?? throw new Exception("MasterKey không tìm thấy trong cấu hình.");
                
                string newRawDek = EncryptionHelper.GenerateDataEncryptionKey();
                user.DataEncryptionKey = EncryptionHelper.EncryptWithMasterKey(newRawDek, masterKeyForDek);
                await _context.SaveChangesAsync();
            }

            var rawDek = GetRawDek(user);

            var project = new Project
            {
                AuthorId = userId,
                Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek),
                Summary = string.IsNullOrEmpty(request.Summary)
                    ? null
                    : EncryptionHelper.EncryptWithMasterKey(request.Summary, rawDek),
                Status = request.Status,
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            // Auto-embed summary if provided (non-fatal)
            if (!string.IsNullOrWhiteSpace(request.Summary))
            {
                try
                {
                    var vector = await EmbedSummaryAsync(request.Summary);
                    project.SummaryEmbedding = new Vector(vector);
                    await _context.SaveChangesAsync();
                }
                catch { /* embedding failure is non-fatal */ }
            }

            // Assign genres
            await SyncProjectGenresAsync(project.Id, request.GenreIds);

            // Reload with genres for response
            var created = await _context.Projects
                .Include(p => p.ProjectGenres).ThenInclude(pg => pg.Genre)
                .FirstAsync(p => p.Id == project.Id);
            return MapToResponse(created, rawDek);
        }

        public async Task<ProjectResponse> UpdateProjectAsync(Guid projectId, Guid userId, UpdateProjectRequest request)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && p.AuthorId == userId && !p.IsDeleted)
                ?? throw new Exception("Không tìm thấy dự án.");

            var user = await GetUserWithDekAsync(userId);
            var rawDek = GetRawDek(user);

            project.Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek);
            var newSummary = string.IsNullOrWhiteSpace(request.Summary) ? null : request.Summary;
            project.Summary = newSummary == null
                ? null
                : EncryptionHelper.EncryptWithMasterKey(newSummary, rawDek);

            // Clear summary embedding when summary changes
            if (project.Summary == null) project.SummaryEmbedding = null;

            project.CoverImageURL = request.CoverImageURL;
            project.Status = request.Status;
            project.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Auto-embed new summary (non-fatal)
            if (!string.IsNullOrWhiteSpace(newSummary))
            {
                try
                {
                    var vector = await EmbedSummaryAsync(newSummary);
                    project.SummaryEmbedding = new Vector(vector);
                    project.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
                catch { /* embedding failure is non-fatal */ }
            }

            // Sync genres
            await SyncProjectGenresAsync(project.Id, request.GenreIds);

            // Reload with genres for response
            var updated = await _context.Projects
                .Include(p => p.ProjectGenres).ThenInclude(pg => pg.Genre)
                .FirstAsync(p => p.Id == projectId);
            return MapToResponse(updated, rawDek);
        }

        public async Task DeleteProjectAsync(Guid projectId, Guid userId)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && p.AuthorId == userId && !p.IsDeleted)
                ?? throw new Exception("Không tìm thấy dự án.");

            project.IsDeleted = true;
            project.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        // ── Helpers ──────────────────────────────────────────────────────────────

        private async Task SyncProjectGenresAsync(Guid projectId, List<int> genreIds)
        {
            var existing = await _context.ProjectGenres
                .Where(pg => pg.ProjectId == projectId)
                .ToListAsync();
            _context.ProjectGenres.RemoveRange(existing);

            if (genreIds.Count > 0)
            {
                var validIds = await _context.Genres
                    .Where(g => genreIds.Contains(g.Id))
                    .Select(g => g.Id)
                    .ToListAsync();

                _context.ProjectGenres.AddRange(
                    validIds.Select(gid => new Repository.Entities.ProjectGenre
                    {
                        ProjectId = projectId,
                        GenreId = gid,
                    })
                );
            }

            await _context.SaveChangesAsync();
        }

        public async Task<(string fileName, string content, string mimeType)> ExportProjectAsync(Guid projectId, Guid userId)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && p.AuthorId == userId && !p.IsDeleted)
                ?? throw new Exception("Không tìm thấy dự án.");

            var user = await GetUserWithDekAsync(userId);
            var rawDek = GetRawDek(user);

            var title = EncryptionHelper.DecryptWithMasterKey(project.Title, rawDek);
            var summary = string.IsNullOrEmpty(project.Summary)
                ? null
                : EncryptionHelper.DecryptWithMasterKey(project.Summary, rawDek);

            var chapters = await _context.Chapters
                .Where(c => c.ProjectId == projectId && !c.IsDeleted)
                .OrderBy(c => c.ChapterNumber)
                .ToListAsync();

            var versionIds = chapters
                .Where(c => c.CurrentVersionId.HasValue)
                .Select(c => c.CurrentVersionId!.Value)
                .ToList();

            var versions = await _context.ChapterVersions
                .Where(v => versionIds.Contains(v.Id))
                .ToDictionaryAsync(v => v.Id);

            var sb = new System.Text.StringBuilder();
            sb.AppendLine(title);
            sb.AppendLine(new string('═', 60));
            if (!string.IsNullOrWhiteSpace(summary))
            {
                sb.AppendLine(summary);
                sb.AppendLine(new string('─', 60));
            }
            sb.AppendLine();

            foreach (var ch in chapters)
            {
                var chTitle = ch.Title ?? $"Chương {ch.ChapterNumber}";
                sb.AppendLine($"Chương {ch.ChapterNumber}: {chTitle}");
                sb.AppendLine(new string('─', 60));

                if (ch.CurrentVersionId.HasValue && versions.TryGetValue(ch.CurrentVersionId.Value, out var ver))
                {
                    var chContent = EncryptionHelper.DecryptWithMasterKey(ver.Content, rawDek);
                    sb.AppendLine(chContent);
                }
                sb.AppendLine();
                sb.AppendLine(new string('═', 60));
                sb.AppendLine();
            }

            var safeTitle = string.Concat(title.Split(System.IO.Path.GetInvalidFileNameChars()));
            var fileName = $"{safeTitle}.txt";

            return (fileName, sb.ToString(), "text/plain; charset=utf-8");
        }

        public async Task<AuthorDashboardStats> GetUserStatsAsync(Guid userId)
        {
            var totalChapters = await _context.Chapters
                .Where(c => c.Project.AuthorId == userId && !c.Project.IsDeleted)
                .CountAsync();

            var totalAnalysesUsed = await _context.UserSubscriptions
                .Where(s => s.UserId == userId)
                .SumAsync(s => (int?)s.UsedAnalysisCount) ?? 0;

            var totalChatMessages = await _context.ChatMessages
                .Where(m => m.UserId == userId)
                .CountAsync();

            return new AuthorDashboardStats
            {
                TotalChapters = totalChapters,
                TotalAnalysesUsed = totalAnalysesUsed,
                TotalChatMessages = totalChatMessages,
            };
        }

        private async Task<User> GetUserWithDekAsync(Guid userId)
        {
            var user = await _context.Users.FindAsync(userId)
                ?? throw new Exception("Người dùng không tồn tại.");

            if (string.IsNullOrEmpty(user.DataEncryptionKey))
                throw new Exception("Khóa mã hóa người dùng chưa được thiết lập.");

            return user;
        }

        private string GetRawDek(User user)
        {
            string masterKey = _config["Security:MasterKey"]
                ?? throw new Exception("MasterKey không tìm thấy trong cấu hình.");
            return EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);
        }

        private async Task<float[]> EmbedSummaryAsync(string summaryText)
        {
            var text = $"search_document: {summaryText}";
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

        private static ProjectResponse MapToResponse(Project project, string rawDek)
        {
            return new ProjectResponse
            {
                Id = project.Id,
                Title = EncryptionHelper.DecryptWithMasterKey(project.Title, rawDek),
                Summary = string.IsNullOrEmpty(project.Summary)
                    ? null
                    : EncryptionHelper.DecryptWithMasterKey(project.Summary, rawDek),
                CoverImageURL = project.CoverImageURL,
                Status = project.Status,
                CreatedAt = project.CreatedAt,
                UpdatedAt = project.UpdatedAt,
                Genres = project.ProjectGenres
                    .Select(pg => new GenreResponse
                    {
                        Id = pg.Genre.Id,
                        Name = pg.Genre.Name,
                        Slug = pg.Genre.Slug,
                        Color = pg.Genre.Color,
                        Description = pg.Genre.Description,
                    })
                    .ToList(),
            };
        }
    }
}
