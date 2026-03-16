using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.Interfaces;
using Service.DTOs;
using System;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/projects/{projectId}/themes")]
    [Authorize]
    public class ThemeController : ControllerBase
    {
        private readonly IThemeService _service;

        public ThemeController(IThemeService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetEntries(Guid projectId)
        {
            var entries = await _service.GetEntriesByProjectIdAsync(projectId);
            return Ok(entries);
        }

        [HttpPost]
        public async Task<IActionResult> CreateEntry(Guid projectId, [FromBody] CreateThemeRequest request)
        {
            var entry = await _service.CreateEntryAsync(projectId, request);
            return CreatedAtAction(nameof(GetEntries), new { projectId }, entry);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateEntry(Guid projectId, Guid id, [FromBody] UpdateThemeRequest request)
        {
            try
            {
                var entry = await _service.UpdateEntryAsync(id, request);
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
            var success = await _service.DeleteEntryAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpPost("{id}/embed")]
        public async Task<IActionResult> GenerateEmbedding(Guid projectId, Guid id)
        {
            try
            {
                var success = await _service.GenerateEmbeddingAsync(id);
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
