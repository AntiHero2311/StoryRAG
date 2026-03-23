using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.Interfaces;
using Service.DTOs;
using System;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/projects/{projectId}/timeline")]
    [Authorize]
    public class TimelineController : ControllerBase
    {
        private readonly ITimelineEventService _service;

        public TimelineController(ITimelineEventService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(Guid projectId)
        {
            var events = await _service.GetByProjectAsync(projectId);
            return Ok(events);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateTimelineEventRequest request)
        {
            var evt = await _service.CreateAsync(projectId, request);
            return CreatedAtAction(nameof(GetAll), new { projectId }, evt);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid projectId, Guid id, [FromBody] UpdateTimelineEventRequest request)
        {
            try
            {
                var evt = await _service.UpdateAsync(id, request);
                return Ok(evt);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid projectId, Guid id)
        {
            var success = await _service.DeleteAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpPatch("{id}/reorder")]
        public async Task<IActionResult> Reorder(Guid projectId, Guid id, [FromBody] int newSortOrder)
        {
            var success = await _service.ReorderAsync(id, newSortOrder);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
