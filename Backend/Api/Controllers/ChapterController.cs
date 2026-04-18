using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/projects/{projectId:guid}/chapters")]
    [ApiController]
    [Authorize]
    public class ChapterController : ControllerBase
    {
        private readonly IChapterService _chapterService;

        public ChapterController(IChapterService chapterService)
        {
            _chapterService = chapterService;
        }

        // ── Chapter CRUD ───────────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetChapters(Guid projectId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var chapters = await _chapterService.GetChaptersByProjectAsync(projectId, userId.Value);
                return Ok(chapters);
            }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        [HttpGet("{chapterId:guid}")]
        public async Task<IActionResult> GetChapterDetail(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var chapter = await _chapterService.GetChapterDetailAsync(chapterId, userId.Value);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return NotFound(new { Message = ex.Message }); }
        }

        [HttpPost]
        public async Task<IActionResult> CreateChapter(Guid projectId, [FromBody] CreateChapterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var chapter = await _chapterService.CreateChapterAsync(projectId, userId.Value, request);
                return CreatedAtAction(nameof(GetChapterDetail), new { projectId, chapterId = chapter.Id }, chapter);
            }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        [HttpPost("import")]
        [RequestSizeLimit(25 * 1024 * 1024)]
        public async Task<IActionResult> ImportManuscript(Guid projectId, [FromForm] ImportManuscriptFormRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (request.File == null || request.File.Length == 0)
                return BadRequest(new { Message = "Vui lòng chọn file để import." });

            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();

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
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Lưu in-place: cập nhật content của version đang active (không tạo version mới).</summary>
        [HttpPut("{chapterId:guid}")]
        public async Task<IActionResult> UpdateChapter(Guid projectId, Guid chapterId, [FromBody] UpdateChapterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var chapter = await _chapterService.UpdateChapterAsync(chapterId, userId.Value, request);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Đổi tên chương (chỉ title).</summary>
        [HttpPatch("{chapterId:guid}/title")]
        public async Task<IActionResult> RenameChapter(Guid projectId, Guid chapterId, [FromBody] RenameChapterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var chapter = await _chapterService.RenameChapterAsync(chapterId, userId.Value, request);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        [HttpDelete("{chapterId:guid}")]
        public async Task<IActionResult> DeleteChapter(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                await _chapterService.DeleteChapterAsync(chapterId, userId.Value);
                return Ok(new { Message = "Chương đã được xóa." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        // ── Version management ─────────────────────────────────────────────────

        [HttpGet("{chapterId:guid}/versions")]
        public async Task<IActionResult> GetVersions(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var versions = await _chapterService.GetVersionsAsync(chapterId, userId.Value);
                return Ok(versions);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return NotFound(new { Message = ex.Message }); }
        }

        [HttpGet("{chapterId:guid}/versions/{versionNumber:int}")]
        public async Task<IActionResult> GetVersionDetail(Guid projectId, Guid chapterId, int versionNumber)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var version = await _chapterService.GetVersionDetailAsync(chapterId, versionNumber, userId.Value);
                return Ok(version);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return NotFound(new { Message = ex.Message }); }
        }

        /// <summary>Tạo version mới trống (do người dùng chủ ý).</summary>
        [HttpPost("{chapterId:guid}/versions")]
        public async Task<IActionResult> CreateNewVersion(Guid projectId, Guid chapterId, [FromBody] CreateVersionRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var chapter = await _chapterService.CreateNewVersionAsync(chapterId, userId.Value, request);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Chuyển sang version khác (set làm active).</summary>
        [HttpPatch("{chapterId:guid}/versions/{versionNumber:int}/activate")]
        public async Task<IActionResult> SetActiveVersion(Guid projectId, Guid chapterId, int versionNumber)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var chapter = await _chapterService.SetActiveVersionAsync(chapterId, versionNumber, userId.Value);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Đổi tên version.</summary>
        [HttpPatch("{chapterId:guid}/versions/{versionNumber:int}/title")]
        public async Task<IActionResult> UpdateVersionTitle(Guid projectId, Guid chapterId, int versionNumber, [FromBody] UpdateVersionTitleRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var version = await _chapterService.UpdateVersionTitleAsync(chapterId, versionNumber, userId.Value, request);
                return Ok(version);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Xóa version (chỉ khi chapter có ≥2 version).</summary>
        [HttpDelete("{chapterId:guid}/versions/{versionNumber:int}")]
        public async Task<IActionResult> DeleteVersion(Guid projectId, Guid chapterId, int versionNumber)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                await _chapterService.DeleteVersionAsync(chapterId, versionNumber, userId.Value);
                return Ok(new { Message = "Phiên bản đã được xóa." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Toggle ghim phiên bản — version ghim không bị xóa tự động.</summary>
        [HttpPut("{chapterId:guid}/versions/{versionNumber:int}/pin")]
        public async Task<IActionResult> TogglePinVersion(Guid projectId, Guid chapterId, int versionNumber)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var result = await _chapterService.TogglePinVersionAsync(chapterId, versionNumber, userId.Value);
                return Ok(result);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Lấy nội dung thuần của một version để so sánh diff.</summary>
        [HttpGet("{chapterId:guid}/versions/{versionNumber:int}/content")]
        public async Task<IActionResult> GetVersionContent(Guid projectId, Guid chapterId, int versionNumber)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var content = await _chapterService.GetVersionContentAsync(chapterId, versionNumber, userId.Value);
                return Ok(new { content });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        [HttpGet("{chapterId:guid}/versions/compare")]
        public async Task<IActionResult> CompareVersions(
            Guid projectId,
            Guid chapterId,
            [FromQuery] int fromVersion,
            [FromQuery] int toVersion)
        {
            if (fromVersion <= 0 || toVersion <= 0)
                return BadRequest(new { Message = "fromVersion và toVersion phải lớn hơn 0." });

            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();

                var diff = await _chapterService.CompareVersionsAsync(chapterId, fromVersion, toVersion, userId.Value);
                return Ok(diff);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        // ── Chunking ───────────────────────────────────────────────────────────

        [HttpPost("{chapterId:guid}/chunk")]
        public async Task<IActionResult> ChunkChapter(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized();
                var result = await _chapterService.ChunkVersionAsync(chapterId, userId.Value);
                return Ok(result);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        // ── Helper ─────────────────────────────────────────────────────────────

        private Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }

        public class ImportManuscriptFormRequest
        {
            [Required]
            public IFormFile File { get; set; } = null!;

            public bool SplitByHeadings { get; set; } = true;
        }
    }
}
