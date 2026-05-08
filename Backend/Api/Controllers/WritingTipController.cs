using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;

namespace Api.Controllers
{
    [Route("api/writing-tips")]
    [ApiController]
    public class WritingTipController : ControllerBase
    {
        private readonly AppDbContext _db;

        public WritingTipController(AppDbContext db)
        {
            _db = db;
        }

        // Public read (no auth): only published=true
        // GET /api/writing-tips?tag=xxx
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublic([FromQuery] string? tag)
        {
            var query = _db.WritingTips
                .AsNoTracking()
                .Where(x => x.Published);

            if (!string.IsNullOrWhiteSpace(tag))
            {
                var t = tag.Trim();
                query = query.Where(x => x.Tags.Contains(t));
            }

            var items = await query
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync();

            return Ok(items);
        }

        // Staff/Admin CRUD
        [HttpGet("admin")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> GetAll([FromQuery] string? tag, [FromQuery] bool? published)
        {
            var query = _db.WritingTips.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(tag))
            {
                var t = tag.Trim();
                query = query.Where(x => x.Tags.Contains(t));
            }

            if (published.HasValue)
            {
                query = query.Where(x => x.Published == published.Value);
            }

            var items = await query
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("admin/{id:guid}")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> GetOne(Guid id)
        {
            var item = await _db.WritingTips.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (item == null) return NotFound(new { Message = "Không tìm thấy WritingTip." });
            return Ok(item);
        }

        public class WritingTipUpsertRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Content { get; set; } = string.Empty;
            public string[] Tags { get; set; } = [];
            public bool Published { get; set; } = false;
        }

        [HttpPost("admin")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> Create([FromBody] WritingTipUpsertRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Title) || string.IsNullOrWhiteSpace(req.Content))
                return BadRequest(new { Message = "Title và Content là bắt buộc." });

            var entity = new WritingTip
            {
                Id = Guid.NewGuid(),
                Title = req.Title.Trim(),
                Content = req.Content.Trim(),
                Tags = NormalizeTags(req.Tags),
                Published = req.Published,
                UpdatedAt = DateTime.UtcNow
            };

            _db.WritingTips.Add(entity);
            await _db.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpPut("admin/{id:guid}")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> Update(Guid id, [FromBody] WritingTipUpsertRequest req)
        {
            var entity = await _db.WritingTips.FirstOrDefaultAsync(x => x.Id == id);
            if (entity == null) return NotFound(new { Message = "Không tìm thấy WritingTip." });

            if (string.IsNullOrWhiteSpace(req.Title) || string.IsNullOrWhiteSpace(req.Content))
                return BadRequest(new { Message = "Title và Content là bắt buộc." });

            entity.Title = req.Title.Trim();
            entity.Content = req.Content.Trim();
            entity.Tags = NormalizeTags(req.Tags);
            entity.Published = req.Published;
            entity.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpPatch("admin/{id:guid}/publish")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> TogglePublish(Guid id, [FromBody] bool published)
        {
            var entity = await _db.WritingTips.FirstOrDefaultAsync(x => x.Id == id);
            if (entity == null) return NotFound(new { Message = "Không tìm thấy WritingTip." });

            entity.Published = published;
            entity.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpDelete("admin/{id:guid}")]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var entity = await _db.WritingTips.FirstOrDefaultAsync(x => x.Id == id);
            if (entity == null) return NotFound(new { Message = "Không tìm thấy WritingTip." });

            _db.WritingTips.Remove(entity);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private static string[] NormalizeTags(string[] tags)
        {
            if (tags == null || tags.Length == 0) return Array.Empty<string>();
            return tags
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.Trim())
                .Where(t => t.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
    }
}

