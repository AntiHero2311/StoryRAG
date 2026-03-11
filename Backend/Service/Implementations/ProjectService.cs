using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;

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
            project.Summary = string.IsNullOrEmpty(request.Summary)
                ? null
                : EncryptionHelper.EncryptWithMasterKey(request.Summary, rawDek);
            project.CoverImageURL = request.CoverImageURL;
            project.Status = request.Status;
            project.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

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
