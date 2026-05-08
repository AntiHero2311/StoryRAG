using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.DTOs;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/me")]
    [ApiController]
    [Authorize(Roles = "Author")]
    public class MeController : ControllerBase
    {
        private readonly AppDbContext _db;

        public MeController(AppDbContext db)
        {
            _db = db;
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
                ChapterId = feedback.ChapterId,
                AuthorId = feedback.AuthorId,
                AuthorName = feedback.Author?.FullName ?? string.Empty,
                StaffId = feedback.StaffId,
                StaffName = feedback.Staff?.FullName ?? string.Empty,
                Content = feedback.Content,
                Status = feedback.Status,
                StaffNote = feedback.StaffNote,
                CreatedAt = feedback.CreatedAt,
                UpdatedAt = feedback.UpdatedAt,
                ReadAt = feedback.ReadAt,
            };
        }
    }
}

