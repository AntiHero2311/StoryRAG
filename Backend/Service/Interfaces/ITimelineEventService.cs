using Service.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Service.Interfaces
{
    public interface ITimelineEventService
    {
        Task<List<TimelineEventDto>> GetByProjectAsync(Guid projectId);
        Task<TimelineEventDto> CreateAsync(Guid projectId, CreateTimelineEventRequest request);
        Task<TimelineEventDto> UpdateAsync(Guid id, UpdateTimelineEventRequest request);
        Task<bool> DeleteAsync(Guid id);
        Task<bool> ReorderAsync(Guid id, int newSortOrder);
    }
}
