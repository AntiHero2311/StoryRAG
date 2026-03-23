using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/export")]
    [ApiController]
    [Authorize]
    public class ExportController : ControllerBase
    {
        private readonly IExportService _exportService;

        public ExportController(IExportService exportService)
        {
            _exportService = exportService;
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }

        [HttpGet("{projectId:guid}")]
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
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }

        [HttpGet("{projectId:guid}/chapters/{chapterId:guid}")]
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
            catch (Exception ex) { return StatusCode(500, new { Message = ex.Message }); }
        }
    }
}
