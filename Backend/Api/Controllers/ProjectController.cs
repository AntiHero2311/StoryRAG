using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/projects")]
    [ApiController]
    [Authorize(Roles = "Author")]
    public class ProjectController : ControllerBase
    {
        private readonly IProjectService _projectService;
        private readonly IProjectReportService _reportService;
        private readonly IProjectImportService _importService;
        private readonly ILogger<ProjectController> _logger;

        public ProjectController(
            IProjectService projectService,
            IProjectReportService reportService,
            IProjectImportService importService,
            ILogger<ProjectController> logger)
        {
            _projectService = projectService;
            _reportService = reportService;
            _importService = importService;
            _logger = logger;
        }

        /// <summary>
        /// Lấy danh sách tất cả dự án của người dùng đang đăng nhập.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetUserProjects()
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var projects = await _projectService.GetUserProjectsAsync(userId.Value);
                return Ok(projects);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Lấy thông tin chi tiết một dự án theo ID.
        /// </summary>
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetProjectById(Guid id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var project = await _projectService.GetProjectByIdAsync(id, userId.Value);
                return Ok(project);
            }
            catch (Exception ex)
            {
                return NotFound(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Tạo dự án mới.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] CreateProjectRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var project = await _projectService.CreateProjectAsync(userId.Value, request);
                return CreatedAtAction(nameof(GetProjectById), new { id = project.Id }, project);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Cập nhật dự án.
        /// </summary>
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateProject(Guid id, [FromBody] UpdateProjectRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var project = await _projectService.UpdateProjectAsync(id, userId.Value, request);
                return Ok(project);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Xóa mềm dự án (IsDeleted = true).
        /// </summary>
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteProject(Guid id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                await _projectService.DeleteProjectAsync(id, userId.Value);
                return Ok(new { Message = "Dự án đã được xóa." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Thống kê tổng hợp của người dùng (số chương, phân tích, chat).
        /// </summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetUserStats()
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var stats = await _projectService.GetUserStatsAsync(userId.Value);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Xuất toàn bộ chương của dự án thành file .txt.
        /// </summary>
        [HttpGet("{id:guid}/export")]
        public async Task<IActionResult> ExportProject(Guid id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                var (fileName, content, mimeType) = await _projectService.ExportProjectAsync(id, userId.Value);
                var bytes = System.Text.Encoding.UTF8.GetBytes(content);
                return File(bytes, mimeType, fileName);
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        /// <summary>
        /// Lấy nội dung chunk đã giải mã (theo Guid hoặc ordinal phẳng) để hiển thị bằng chứng RAG.
        /// </summary>
        [HttpGet("{id:guid}/chunks")]
        public async Task<IActionResult> GetEvidenceChunks(Guid id, [FromQuery] string? ids, [FromQuery] string? ordinals, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                if (string.IsNullOrWhiteSpace(ids) && string.IsNullOrWhiteSpace(ordinals))
                    return BadRequest(new { Message = "Cần tham số ids hoặc ordinals (danh sách phân tách bằng dấu phẩy)." });

                var list = await _reportService.GetProjectEvidenceChunksAsync(id, userId.Value, ids, ordinals, cancellationToken);
                return Ok(list);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        // ── Helper ───────────────────────────────────────────────────────────────

        /// <summary>Import bản thảo (.txt/.docx/.pdf) → tạo Project + Chapters + AI trích xuất.</summary>
        [HttpPost("import")]
        [Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("LongImport")]
        [RequestSizeLimit(80 * 1024 * 1024)]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ImportProject(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "Vui lòng chọn file để import (.txt, .docx, .pdf)." });
            if (file.Length > 80L * 1024 * 1024)
                return BadRequest(new { Message = "File import quá lớn. Vui lòng dùng file <= 80MB." });

            try
            {
                var userId = GetUserId();
                if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                var fileBytes = ms.ToArray();

                var result = await _importService.ImportFromManuscriptAsync(
                    userId.Value,
                    file.FileName,
                    file.ContentType,
                    fileBytes);

                return Ok(result);
            }
            catch (OperationCanceledException)
            {
                return StatusCode(StatusCodes.Status408RequestTimeout, new
                {
                    Message = "Import mất quá nhiều thời gian do dữ liệu lớn. Vui lòng thử lại với file nhỏ hơn hoặc chia tác phẩm thành nhiều phần."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Project import failed for file {FileName}.", file.FileName);
                return BadRequest(new { Message = ex.Message });
            }
        }

        // ── Helper ───────────────────────────────────────────────────────────────

        private Guid? GetUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }
}
