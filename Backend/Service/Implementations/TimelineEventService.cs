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
    public class TimelineEventService : ITimelineEventService
    {
        private readonly AppDbContext _context;

        public TimelineEventService(AppDbContext context)
        {
            _context = context;
        }

        private static TimelineEventDto MapToDto(TimelineEvent e) => new TimelineEventDto
        {
            Id = e.Id,
            ProjectId = e.ProjectId,
            Category = e.Category,
            Title = e.Title,
            Description = e.Description,
            TimeLabel = e.TimeLabel,
            SortOrder = e.SortOrder,
            Importance = e.Importance,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
        };

        public async Task<List<TimelineEventDto>> GetByProjectAsync(Guid projectId)
        {
            return await _context.TimelineEvents
                .Where(e => e.ProjectId == projectId)
                .OrderBy(e => e.SortOrder)
                .ThenBy(e => e.CreatedAt)
                .Select(e => MapToDto(e))
                .ToListAsync();
        }

        public async Task<TimelineEventDto> CreateAsync(Guid projectId, CreateTimelineEventRequest request)
        {
            // Auto-calculate sort order if not given
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
                ProjectId = projectId,
                Category = request.Category,
                Title = request.Title,
                Description = request.Description,
                TimeLabel = request.TimeLabel,
                SortOrder = sortOrder,
                Importance = request.Importance,
            };

            _context.TimelineEvents.Add(entity);
            await _context.SaveChangesAsync();
            return MapToDto(entity);
        }

        public async Task<TimelineEventDto> UpdateAsync(Guid id, UpdateTimelineEventRequest request)
        {
            var entity = await _context.TimelineEvents.FindAsync(id)
                ?? throw new KeyNotFoundException("Timeline event not found");

            if (request.Category != null) entity.Category = request.Category;
            if (request.Title != null) entity.Title = request.Title;
            if (request.Description != null) entity.Description = request.Description;
            if (request.TimeLabel != null) entity.TimeLabel = request.TimeLabel;
            if (request.SortOrder.HasValue) entity.SortOrder = request.SortOrder.Value;
            if (request.Importance != null) entity.Importance = request.Importance;
            entity.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return MapToDto(entity);
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var entity = await _context.TimelineEvents.FindAsync(id);
            if (entity == null) return false;
            _context.TimelineEvents.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ReorderAsync(Guid id, int newSortOrder)
        {
            var entity = await _context.TimelineEvents.FindAsync(id);
            if (entity == null) return false;
            entity.SortOrder = newSortOrder;
            entity.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
