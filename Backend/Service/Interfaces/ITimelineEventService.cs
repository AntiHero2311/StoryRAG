using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Service.Interfaces
{
    public interface ITimelineEventService
    {
        Task<List<TimelineEventDto>> GetByProjectAsync(Guid projectId, Guid userId);
        Task<TimelineEventDto> CreateAsync(Guid projectId, Guid userId, CreateTimelineEventRequest request);
        Task<TimelineEventDto> UpdateAsync(Guid id, Guid projectId, Guid userId, UpdateTimelineEventRequest request);
        Task<bool> DeleteAsync(Guid id, Guid projectId, Guid userId);
        Task<bool> ReorderAsync(Guid id, Guid projectId, Guid userId, int newSortOrder);
    }
}
