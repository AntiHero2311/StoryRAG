using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/projects/{projectId:guid}/character")]
    [ApiController]
    [Authorize]
    public class CharacterController : ControllerBase
    {
        private readonly ICharacterService _service;

        public CharacterController(ICharacterService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(Guid projectId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var result = await _service.GetAllAsync(projectId, userId.Value);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid projectId, Guid id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var result = await _service.GetByIdAsync(id, projectId, userId.Value);
                if (result == null) return NotFound(new { message = "Không tìm thấy nhân vật." });
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateCharacterRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var result = await _service.CreateAsync(projectId, userId.Value, request);
                return CreatedAtAction(nameof(GetById), new { projectId, id = result.Id }, result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid projectId, Guid id, [FromBody] UpdateCharacterRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var result = await _service.UpdateAsync(id, projectId, userId.Value, request);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid projectId, Guid id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                await _service.DeleteAsync(id, projectId, userId.Value);
                return NoContent();
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
        }

        [HttpPost("{id:guid}/embed")]
        public async Task<IActionResult> Embed(Guid projectId, Guid id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var result = await _service.EmbedAsync(id, projectId, userId.Value);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
        }

        private Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }
}
