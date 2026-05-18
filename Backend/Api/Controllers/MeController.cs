using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.DTOs;
using Service.Interfaces;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/me")]
    [ApiController]
    [Authorize(Roles = "Author")]
    public class MeController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ISupportWorkflowService _supportWorkflow;

        public MeController(AppDbContext db, ISupportWorkflowService supportWorkflow)
        {
            _db = db;
            _supportWorkflow = supportWorkflow;
        }

        [HttpGet("feedback")]
        public async Task<IActionResult> GetMyFeedback()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var entities = await _db.StaffFeedbacks
                .AsNoTracking()
                .Where(x => x.AuthorId == userId.Value)
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            var items = entities.Select(MapFeedback).ToList();
            return Ok(items);
        }

        [HttpPost("feedback/{id:guid}/mark-read")]
        public async Task<IActionResult> MarkFeedbackRead(Guid id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var feedback = await _db.StaffFeedbacks
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .FirstOrDefaultAsync(x => x.Id == id && x.AuthorId == userId.Value);

            if (feedback == null) return NotFound(new { Message = "Không tìm thấy feedback." });

            if (feedback.ReadAt == null)
            {
                feedback.ReadAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            return Ok(MapFeedback(feedback));
        }

        [HttpPost("feedback/{id:guid}/respond")]
        public async Task<IActionResult> RespondToFeedback(Guid id, [FromBody] FeedbackResponseRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            var feedback = await _db.StaffFeedbacks
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .FirstOrDefaultAsync(x => x.Id == id && x.AuthorId == userId.Value);

            if (feedback == null) return NotFound(new { Message = "Không tìm thấy feedback." });

            feedback.UserReaction = request.Reaction;
            feedback.UserFeedback = string.IsNullOrWhiteSpace(request.Content) ? null : request.Content.Trim();
            feedback.UserRespondedAt = DateTime.UtcNow;
            if (feedback.ReadAt == null)
                feedback.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(MapFeedback(feedback));
        }

        [HttpGet("support-tickets")]
        public async Task<IActionResult> GetMySupportTickets()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });
            var items = await _supportWorkflow.GetMyTicketsAsync(userId.Value);
            return Ok(items);
        }

        [HttpPost("support-tickets")]
        public async Task<IActionResult> CreateSupportTicket([FromBody] CreateSupportTicketRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });
            var result = await _supportWorkflow.CreateTicketAsync(userId.Value, request);
            return Ok(result);
        }

        [HttpGet("appeals")]
        public async Task<IActionResult> GetMyAppeals()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });
            var items = await _supportWorkflow.GetMyAppealsAsync(userId.Value);
            return Ok(items);
        }

        [HttpPost("appeals")]
        public async Task<IActionResult> CreateAppeal([FromBody] CreateAuthorAppealRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });
            try
            {
                var result = await _supportWorkflow.CreateAppealAsync(userId.Value, request);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Message = ex.Message });
            }
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }

        private static StaffFeedbackResponse MapFeedback(Repository.Entities.StaffFeedback feedback)
        {
            return new StaffFeedbackResponse
            {
                Id = feedback.Id,
                ProjectId = feedback.ProjectId,
                ProjectReportId = feedback.ProjectReportId,
                ChapterId = feedback.ChapterId,
                AuthorId = feedback.AuthorId,
                AuthorName = feedback.Author?.FullName ?? string.Empty,
                StaffId = feedback.StaffId,
                StaffName = feedback.Staff?.FullName ?? string.Empty,
                Content = feedback.Content,
                Status = feedback.Status,
                StaffNote = feedback.StaffNote,
                UserReaction = feedback.UserReaction,
                UserFeedback = feedback.UserFeedback,
                UserRespondedAt = feedback.UserRespondedAt,
                CreatedAt = feedback.CreatedAt,
                UpdatedAt = feedback.UpdatedAt,
                ReadAt = feedback.ReadAt,
            };
        }
    }
}
