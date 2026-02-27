using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/project/{projectId:guid}/chapters")]
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

        /// <summary>Lấy danh sách chương của một dự án.</summary>
        [HttpGet]
        public async Task<IActionResult> GetChapters(Guid projectId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var chapters = await _chapterService.GetChaptersByProjectAsync(projectId, userId.Value);
                return Ok(chapters);
            }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Lấy chi tiết chương (kèm nội dung và danh sách versions).</summary>
        [HttpGet("{chapterId:guid}")]
        public async Task<IActionResult> GetChapterDetail(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var chapter = await _chapterService.GetChapterDetailAsync(chapterId, userId.Value);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return NotFound(new { Message = ex.Message }); }
        }

        /// <summary>Tạo chương mới (kèm nội dung, tự động tạo Version 1).</summary>
        [HttpPost]
        public async Task<IActionResult> CreateChapter(Guid projectId, [FromBody] CreateChapterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var chapter = await _chapterService.CreateChapterAsync(projectId, userId.Value, request);
                return CreatedAtAction(nameof(GetChapterDetail),
                    new { projectId, chapterId = chapter.Id }, chapter);
            }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Cập nhật chương (tự động tạo version mới).</summary>
        [HttpPut("{chapterId:guid}")]
        public async Task<IActionResult> UpdateChapter(Guid projectId, Guid chapterId, [FromBody] UpdateChapterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var chapter = await _chapterService.UpdateChapterAsync(chapterId, userId.Value, request);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Xóa mềm chương.</summary>
        [HttpDelete("{chapterId:guid}")]
        public async Task<IActionResult> DeleteChapter(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                await _chapterService.DeleteChapterAsync(chapterId, userId.Value);
                return Ok(new { Message = "Chương đã được xóa." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        // ── Version management ─────────────────────────────────────────────────

        /// <summary>Lấy danh sách tất cả versions của chương.</summary>
        [HttpGet("{chapterId:guid}/versions")]
        public async Task<IActionResult> GetVersions(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var versions = await _chapterService.GetVersionsAsync(chapterId, userId.Value);
                return Ok(versions);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return NotFound(new { Message = ex.Message }); }
        }

        /// <summary>Xem nội dung một version cụ thể.</summary>
        [HttpGet("{chapterId:guid}/versions/{versionNumber:int}")]
        public async Task<IActionResult> GetVersionDetail(Guid projectId, Guid chapterId, int versionNumber)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var version = await _chapterService.GetVersionDetailAsync(chapterId, versionNumber, userId.Value);
                return Ok(version);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return NotFound(new { Message = ex.Message }); }
        }

        /// <summary>Lưu version mới thủ công (không thay đổi nội dung hiện tại, tạo snapshot).</summary>
        [HttpPost("{chapterId:guid}/versions")]
        public async Task<IActionResult> SaveNewVersion(Guid projectId, Guid chapterId, [FromBody] SaveNewVersionRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var chapter = await _chapterService.SaveNewVersionAsync(chapterId, userId.Value, request);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        /// <summary>Phục hồi về một version cũ (tạo version mới với nội dung cũ).</summary>
        [HttpPost("{chapterId:guid}/versions/{versionNumber:int}/restore")]
        public async Task<IActionResult> RestoreVersion(Guid projectId, Guid chapterId, int versionNumber)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var chapter = await _chapterService.RestoreVersionAsync(chapterId, versionNumber, userId.Value);
                return Ok(chapter);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (Exception ex) { return BadRequest(new { Message = ex.Message }); }
        }

        // ── Chunking ───────────────────────────────────────────────────────────

        /// <summary>Chunk version hiện tại của chương (chuẩn bị cho AI embedding Phase 2).</summary>
        [HttpPost("{chapterId:guid}/chunk")]
        public async Task<IActionResult> ChunkChapter(Guid projectId, Guid chapterId)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

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
    }
}
