using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.Interfaces;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/manuscript")]
    [ApiController]
    [Authorize]
    public class ManuscriptController : ControllerBase
    {
        private readonly IChapterService _chapterService;
        private readonly IExportService _exportService;

        public ManuscriptController(
            IChapterService chapterService,
            IExportService exportService)
        {
            _chapterService = chapterService;
            _exportService = exportService;
        }

        [HttpPost("{projectId:guid}/upload")]
        [RequestSizeLimit(25 * 1024 * 1024)]
        public async Task<IActionResult> Upload(Guid projectId, [FromForm] UploadManuscriptFormRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (request.File == null || request.File.Length == 0)
                return BadRequest(new { Message = "Vui lòng chọn file để upload." });

            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                await using var stream = new MemoryStream();
                await request.File.CopyToAsync(stream);

                var result = await _chapterService.ImportManuscriptAsync(
                    projectId,
                    userId.Value,
                    request.File.FileName,
                    request.File.ContentType,
                    stream.ToArray(),
                    request.SplitByHeadings);

                return Ok(result);
            }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        [HttpGet("{projectId:guid}/export")]
        public async Task<IActionResult> ExportProject(Guid projectId, [FromQuery] string format = "docx")
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var bytes = await _exportService.ExportProjectAsync(projectId, userId.Value, format);
                var contentType = _exportService.GetContentType(format);
                var ext = _exportService.GetFileExtension(format);

                return File(bytes, contentType, $"Project_{projectId}{ext}");
            }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        [HttpGet("{projectId:guid}/chapters/{chapterId:guid}/export")]
        public async Task<IActionResult> ExportChapter(Guid projectId, Guid chapterId, [FromQuery] string format = "docx")
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var bytes = await _exportService.ExportChapterAsync(projectId, chapterId, userId.Value, format);
                var contentType = _exportService.GetContentType(format);
                var ext = _exportService.GetFileExtension(format);

                return File(bytes, contentType, $"Chapter_{chapterId}{ext}");
            }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }

        public class UploadManuscriptFormRequest
        {
            [Required]
            public IFormFile File { get; set; } = null!;

            public bool SplitByHeadings { get; set; } = true;
        }
    }
}
