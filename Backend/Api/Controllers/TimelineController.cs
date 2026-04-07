using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.Interfaces;
using Service.DTOs;
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Collections.Generic;

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

        private Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(Guid projectId)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var events = await _service.GetByProjectAsync(projectId, userId.Value);
            return Ok(events);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateTimelineEventRequest request)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var evt = await _service.CreateAsync(projectId, userId.Value, request);
            return CreatedAtAction(nameof(GetAll), new { projectId }, evt);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid projectId, Guid id, [FromBody] UpdateTimelineEventRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();

                var evt = await _service.UpdateAsync(id, projectId, userId.Value, request);
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
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var success = await _service.DeleteAsync(id, projectId, userId.Value);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpPatch("{id}/reorder")]
        public async Task<IActionResult> Reorder(Guid projectId, Guid id, [FromBody] int newSortOrder)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var success = await _service.ReorderAsync(id, projectId, userId.Value, newSortOrder);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
