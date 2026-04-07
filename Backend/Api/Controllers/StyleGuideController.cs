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
    [Route("api/projects/{projectId}/style-guides")]
    [Authorize]
    public class StyleGuideController : ControllerBase
    {
        private readonly IStyleGuideService _service;

        public StyleGuideController(IStyleGuideService service)
        {
            _service = service;
        }

        private Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }

        [HttpGet]
        public async Task<IActionResult> GetEntries(Guid projectId)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var entries = await _service.GetEntriesByProjectIdAsync(projectId, userId.Value);
            return Ok(entries);
        }

        [HttpPost]
        public async Task<IActionResult> CreateEntry(Guid projectId, [FromBody] CreateStyleGuideRequest request)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var entry = await _service.CreateEntryAsync(projectId, userId.Value, request);
            return CreatedAtAction(nameof(GetEntries), new { projectId }, entry);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateEntry(Guid projectId, Guid id, [FromBody] UpdateStyleGuideRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();

                var entry = await _service.UpdateEntryAsync(id, projectId, userId.Value, request);
                return Ok(entry);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEntry(Guid projectId, Guid id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var success = await _service.DeleteEntryAsync(id, projectId, userId.Value);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpPost("{id}/embed")]
        public async Task<IActionResult> GenerateEmbedding(Guid projectId, Guid id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();

                var success = await _service.GenerateEmbeddingAsync(id, projectId, userId.Value);
                return success ? Ok() : BadRequest("Failed to generate embedding");
            }
            catch (NotImplementedException)
            {
                return StatusCode(501, "Embedding generation not implemented yet.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
