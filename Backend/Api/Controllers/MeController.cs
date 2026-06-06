using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.DTOs;

namespace Api.Controllers
{
    [Route("api/me")]
    [ApiController]
    [Authorize(Roles = "Author")]
    public class MeController : AppControllerBase
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
                .Include(x => x.Project)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            var staffIds = entities.Select(e => e.StaffId).Distinct().ToList();
            var genreMap = await GetStaffGenreMapAsync(staffIds);

            var items = entities.Select(x => MapFeedback(x, genreMap)).ToList();
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
                .Include(x => x.Project)
                .FirstOrDefaultAsync(x => x.Id == id && x.AuthorId == userId.Value);

            if (feedback == null) return NotFound(new { Message = "Không tìm thấy feedback." });

            if (feedback.ReadAt == null)
            {
                feedback.ReadAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            var genreMap = await GetStaffGenreMapAsync(new List<Guid> { feedback.StaffId });
            return Ok(MapFeedback(feedback, genreMap));
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
                .Include(x => x.Project)
                .FirstOrDefaultAsync(x => x.Id == id && x.AuthorId == userId.Value);

            if (feedback == null) return NotFound(new { Message = "Không tìm thấy feedback." });

            feedback.UserReaction = request.Reaction;
            feedback.UserFeedback = string.IsNullOrWhiteSpace(request.Content) ? null : request.Content.Trim();
            feedback.UserRespondedAt = DateTime.UtcNow;
            if (feedback.ReadAt == null)
                feedback.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var genreMap = await GetStaffGenreMapAsync(new List<Guid> { feedback.StaffId });
            return Ok(MapFeedback(feedback, genreMap));
        }

        [HttpPost("feedback")]
        public async Task<IActionResult> CreateFeedback([FromBody] AuthorFeedbackCreateRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { Message = "Không thể xác thực người dùng." });

            // Verify project belongs to user
            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.AuthorId == userId.Value && !p.IsDeleted);
            if (project == null) return NotFound(new { Message = "Không tìm thấy dự án hoặc bạn không có quyền sở hữu dự án này." });

            // If ProjectReportId is provided, verify it belongs to this project
            if (request.ProjectReportId.HasValue)
            {
                var reportExists = await _db.ProjectReports.AnyAsync(r => r.Id == request.ProjectReportId.Value && r.ProjectId == request.ProjectId);
                if (!reportExists) return NotFound(new { Message = "Không tìm thấy báo cáo phân tích tương ứng với dự án." });
            }

            // Find staff to assign feedback to:
            Guid staffId;
            // 1. Try to find the reviewer of the report if provided
            if (request.ProjectReportId.HasValue)
            {
                var reviewerId = await _db.StaffAnalysisReviews
                    .AsNoTracking()
                    .Where(r => r.ProjectReportId == request.ProjectReportId.Value)
                    .Select(r => (Guid?)r.ReviewedBy)
                    .FirstOrDefaultAsync();
                if (reviewerId.HasValue)
                {
                    staffId = reviewerId.Value;
                }
                else
                {
                    // 2. Try to find any staff who sent feedback for this project previously
                    var prevFeedbackStaffId = await _db.StaffFeedbacks
                        .AsNoTracking()
                        .Where(f => f.ProjectId == request.ProjectId)
                        .OrderByDescending(f => f.CreatedAt)
                        .Select(f => (Guid?)f.StaffId)
                        .FirstOrDefaultAsync();
                    if (prevFeedbackStaffId.HasValue)
                    {
                        staffId = prevFeedbackStaffId.Value;
                    }
                    else
                    {
                        // 3. Try to find staff by project genre, then any staff, then admin
                        var assignedStaffId = await GetFallbackStaffIdAsync(request.ProjectId);
                        if (assignedStaffId.HasValue)
                        {
                            staffId = assignedStaffId.Value;
                        }
                        else
                        {
                            return BadRequest(new { Message = "Không thể tìm thấy nhân viên hệ thống (Staff) để gửi phản hồi." });
                        }
                    }
                }
            }
            else
            {
                // Try previous feedback staff for this project, then staff by genre, then any staff, then admin
                var prevFeedbackStaffId = await _db.StaffFeedbacks
                    .AsNoTracking()
                    .Where(f => f.ProjectId == request.ProjectId)
                    .OrderByDescending(f => f.CreatedAt)
                    .Select(f => (Guid?)f.StaffId)
                    .FirstOrDefaultAsync();
                if (prevFeedbackStaffId.HasValue)
                {
                    staffId = prevFeedbackStaffId.Value;
                }
                else
                {
                    var assignedStaffId = await GetFallbackStaffIdAsync(request.ProjectId);
                    if (assignedStaffId.HasValue)
                    {
                        staffId = assignedStaffId.Value;
                    }
                    else
                    {
                        return BadRequest(new { Message = "Không thể tìm thấy nhân viên hệ thống (Staff) để gửi phản hồi." });
                    }
                }
            }

            var feedback = new Repository.Entities.StaffFeedback
            {
                Id = Guid.NewGuid(),
                ProjectId = request.ProjectId,
                ProjectReportId = request.ProjectReportId,
                ChapterId = null,
                AuthorId = userId.Value,
                StaffId = staffId,
                Content = request.Content.Trim(),
                Status = "Open",
                StaffNote = null,
                CreatedAt = DateTime.UtcNow,
                ReadAt = null,
            };

            _db.StaffFeedbacks.Add(feedback);
            await _db.SaveChangesAsync();

            // Load relations to return mapped feedback
            feedback = await _db.StaffFeedbacks
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .Include(x => x.Project)
                .FirstAsync(x => x.Id == feedback.Id);

            var genreMap = await GetStaffGenreMapAsync(new List<Guid> { feedback.StaffId });
            return Ok(MapFeedback(feedback, genreMap));
        }

        private async Task<Dictionary<Guid, List<GenreResponse>>> GetStaffGenreMapAsync(List<Guid> staffIds)
        {
            if (staffIds == null || staffIds.Count == 0)
                return new Dictionary<Guid, List<GenreResponse>>();

            return await _db.StaffGenres
                .AsNoTracking()
                .Where(sg => staffIds.Contains(sg.StaffId))
                .Include(sg => sg.Genre)
                .GroupBy(sg => sg.StaffId)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.OrderBy(sg => sg.Genre.Name)
                          .Select(sg => new GenreResponse
                          {
                              Id = sg.Genre.Id,
                              Name = sg.Genre.Name,
                              Slug = sg.Genre.Slug,
                              Color = sg.Genre.Color,
                              Description = sg.Genre.Description
                          }).ToList());
        }

        private async Task<Guid?> GetFallbackStaffIdAsync(Guid projectId)
        {
            // 1. Get genre IDs of the project
            var projectGenreIds = await _db.ProjectGenres
                .AsNoTracking()
                .Where(pg => pg.ProjectId == projectId)
                .Select(pg => pg.GenreId)
                .ToListAsync();

            if (projectGenreIds.Count > 0)
            {
                // 2. Try to find a staff member who has specialized in one of these genres
                var matchedStaffId = await _db.StaffGenres
                    .AsNoTracking()
                    .Where(sg => projectGenreIds.Contains(sg.GenreId))
                    .Select(sg => (Guid?)sg.StaffId)
                    .FirstOrDefaultAsync();

                if (matchedStaffId.HasValue)
                {
                    return matchedStaffId.Value;
                }
            }

            // 3. Fallback to any staff member
            var defaultStaff = await _db.Users
                .AsNoTracking()
                .Where(u => u.Role == "Staff")
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync();

            if (defaultStaff.HasValue)
            {
                return defaultStaff.Value;
            }

            // 4. Fallback to admin
            var adminId = await _db.Users
                .AsNoTracking()
                .Where(u => u.Role == "Admin")
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync();

            return adminId;
        }

        private static StaffFeedbackResponse MapFeedback(Repository.Entities.StaffFeedback feedback, Dictionary<Guid, List<GenreResponse>> genreMap)
        {
            return new StaffFeedbackResponse
            {
                Id = feedback.Id,
                ProjectId = feedback.ProjectId,
                ProjectTitle = feedback.Project?.Title ?? string.Empty,
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
                StaffGenres = genreMap.TryGetValue(feedback.StaffId, out var genres) ? genres : new List<GenreResponse>()
            };
        }
    }
}
