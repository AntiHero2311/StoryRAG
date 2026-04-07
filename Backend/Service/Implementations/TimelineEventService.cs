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
    public class TimelineEventService : ITimelineEventService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public TimelineEventService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        private static TimelineEventDto MapToDto(TimelineEvent e, string rawDek) => new TimelineEventDto
        {
            Id = e.Id,
            ProjectId = e.ProjectId,
            Category = e.Category,
            Title = EncryptionHelper.DecryptWithMasterKey(e.Title, rawDek),
            Description = e.Description != null ? EncryptionHelper.DecryptWithMasterKey(e.Description, rawDek) : null,
            TimeLabel = e.TimeLabel != null ? EncryptionHelper.DecryptWithMasterKey(e.TimeLabel, rawDek) : null,
            SortOrder = e.SortOrder,
            Importance = e.Importance,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
        };

        public async Task<List<TimelineEventDto>> GetByProjectAsync(Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entities = await _context.TimelineEvents
                .Where(e => e.ProjectId == projectId)
                .OrderBy(e => e.SortOrder)
                .ThenBy(e => e.CreatedAt)
                .ToListAsync();

            return entities.Select(e => MapToDto(e, rawDek)).ToList();
        }

        public async Task<TimelineEventDto> CreateAsync(Guid projectId, Guid userId, CreateTimelineEventRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            int sortOrder = request.SortOrder;
            if (sortOrder == 0)
            {
                var maxSort = await _context.TimelineEvents
                    .Where(e => e.ProjectId == projectId)
                    .MaxAsync(e => (int?)e.SortOrder) ?? 0;
                sortOrder = maxSort + 10;
            }

            var entity = new TimelineEvent
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Category = request.Category,
                Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek),
                Description = request.Description != null ? EncryptionHelper.EncryptWithMasterKey(request.Description, rawDek) : null,
                TimeLabel = request.TimeLabel != null ? EncryptionHelper.EncryptWithMasterKey(request.TimeLabel, rawDek) : null,
                SortOrder = sortOrder,
                Importance = request.Importance,
                CreatedAt = DateTime.UtcNow
            };

            _context.TimelineEvents.Add(entity);
            await _context.SaveChangesAsync();
            return MapToDto(entity, rawDek);
        }

        public async Task<TimelineEventDto> UpdateAsync(Guid id, Guid projectId, Guid userId, UpdateTimelineEventRequest request)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var user = await GetUserAsync(userId);
            var rawDek = GetDek(user);

            var entity = await _context.TimelineEvents.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId)
                ?? throw new KeyNotFoundException("Timeline event not found");

            if (request.Category != null) entity.Category = request.Category;
            if (request.Title != null) entity.Title = EncryptionHelper.EncryptWithMasterKey(request.Title, rawDek);
            if (request.Description != null) entity.Description = EncryptionHelper.EncryptWithMasterKey(request.Description, rawDek);
            if (request.TimeLabel != null) entity.TimeLabel = EncryptionHelper.EncryptWithMasterKey(request.TimeLabel, rawDek);
            if (request.SortOrder.HasValue) entity.SortOrder = request.SortOrder.Value;
            if (request.Importance != null) entity.Importance = request.Importance;
            
            entity.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return MapToDto(entity, rawDek);
        }

        public async Task<bool> DeleteAsync(Guid id, Guid projectId, Guid userId)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var entity = await _context.TimelineEvents.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entity == null) return false;
            
            _context.TimelineEvents.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ReorderAsync(Guid id, Guid projectId, Guid userId, int newSortOrder)
        {
            await VerifyOwnershipAsync(projectId, userId);
            var entity = await _context.TimelineEvents.FirstOrDefaultAsync(e => e.Id == id && e.ProjectId == projectId);
            if (entity == null) return false;
            
            entity.SortOrder = newSortOrder;
            entity.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
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
    }
}
