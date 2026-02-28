using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GenreController : ControllerBase
    {
        private readonly IGenreService _genreService;

        public GenreController(IGenreService genreService)
        {
            _genreService = genreService;
        }

        /// <summary>Lấy tất cả thể loại.</summary>
        [HttpGet]
        [Authorize(Roles = "Author,Admin,Staff")]
        public async Task<IActionResult> GetAllGenres()
        {
            try
            {
                var genres = await _genreService.GetAllGenresAsync();
                return Ok(genres);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>Tạo thể loại mới (Admin only).</summary>
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateGenre([FromBody] CreateGenreRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var genre = await _genreService.CreateGenreAsync(request);
                return CreatedAtAction(nameof(GetAllGenres), new { id = genre.Id }, genre);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>Cập nhật thể loại (Admin only).</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateGenre(int id, [FromBody] UpdateGenreRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var genre = await _genreService.UpdateGenreAsync(id, request);
                return Ok(genre);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>Xóa thể loại (Admin only).</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteGenre(int id)
        {
            try
            {
                await _genreService.DeleteGenreAsync(id);
                return Ok(new { Message = "Thể loại đã được xóa." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }
    }
}
