using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using System.Text.Json;

namespace Api.Controllers
{
    [Route("api/faqs")]
    [ApiController]
    public class FaqController : ControllerBase
    {
        private readonly AppDbContext _db;

        public FaqController(AppDbContext db)
        {
            _db = db;
        }

        // Public read (no auth): only published=true
        // GET /api/faqs?category=xxx
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublic([FromQuery] string? category)
        {
            var query = _db.Faqs
                .AsNoTracking()
                .Where(x => x.Published);

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(x => x.Category == category);
            }

            var items = await query
                .OrderBy(x => x.Order)
                .ThenByDescending(x => x.UpdatedAt)
                .ToListAsync();

            return Ok(items);
        }

        // Staff/Admin CRUD
        [HttpGet("admin")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Staff,Admin")]
        public async Task<IActionResult> GetAll([FromQuery] string? category, [FromQuery] bool? published)
        {
            var query = _db.Faqs.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(x => x.Category == category);
            }

            if (published.HasValue)
            {
                query = query.Where(x => x.Published == published.Value);
            }

            var items = await query
                .OrderBy(x => x.Category)
                .ThenBy(x => x.Order)
                .ThenByDescending(x => x.UpdatedAt)
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("admin/{id:guid}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Staff,Admin")]
        public async Task<IActionResult> GetOne(Guid id)
        {
            var item = await _db.Faqs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (item == null) return NotFound(new { Message = "Không tìm thấy FAQ." });
            return Ok(item);
        }

        public class FaqUpsertRequest
        {
            public string Question { get; set; } = string.Empty;
            public string Answer { get; set; } = string.Empty;
            public string Category { get; set; } = "Tổng quan";
            public int Order { get; set; } = 0;
            public bool Published { get; set; } = false;
        }

        [HttpPost("admin")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Staff,Admin")]
        public async Task<IActionResult> Create([FromBody] FaqUpsertRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Question) || string.IsNullOrWhiteSpace(req.Answer))
                return BadRequest(new { Message = "Question và Answer là bắt buộc." });

            var entity = new Faq
            {
                Id = Guid.NewGuid(),
                Question = req.Question.Trim(),
                Answer = req.Answer.Trim(),
                Category = string.IsNullOrWhiteSpace(req.Category) ? "Tổng quan" : req.Category.Trim(),
                Order = req.Order,
                Published = req.Published,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Faqs.Add(entity);
            await _db.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpPut("admin/{id:guid}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Staff,Admin")]
        public async Task<IActionResult> Update(Guid id, [FromBody] FaqUpsertRequest req)
        {
            var entity = await _db.Faqs.FirstOrDefaultAsync(x => x.Id == id);
            if (entity == null) return NotFound(new { Message = "Không tìm thấy FAQ." });

            if (string.IsNullOrWhiteSpace(req.Question) || string.IsNullOrWhiteSpace(req.Answer))
                return BadRequest(new { Message = "Question và Answer là bắt buộc." });

            entity.Question = req.Question.Trim();
            entity.Answer = req.Answer.Trim();
            entity.Category = string.IsNullOrWhiteSpace(req.Category) ? "Tổng quan" : req.Category.Trim();
            entity.Order = req.Order;
            entity.Published = req.Published;
            entity.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(entity);
        }

        public class FaqPublishRequest
        {
            public bool Published { get; set; }
        }

        [HttpPatch("admin/{id:guid}/publish")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Staff,Admin")]
        public async Task<IActionResult> TogglePublish(Guid id, [FromBody] JsonElement body)
        {
            var entity = await _db.Faqs.FirstOrDefaultAsync(x => x.Id == id);
            if (entity == null) return NotFound(new { Message = "Không tìm thấy FAQ." });

            bool published;
            if (body.ValueKind is JsonValueKind.True or JsonValueKind.False)
            {
                published = body.GetBoolean();
            }
            else if (body.ValueKind == JsonValueKind.Object)
            {
                if (body.TryGetProperty("published", out var publishedProp) ||
                    body.TryGetProperty("Published", out publishedProp))
                {
                    published = publishedProp.ValueKind is JsonValueKind.True or JsonValueKind.False
                        ? publishedProp.GetBoolean()
                        : throw new InvalidOperationException("Published phải là boolean.");
                }
                else
                {
                    return BadRequest(new { Message = "Thiếu trường published." });
                }
            }
            else
            {
                return BadRequest(new { Message = "Body không hợp lệ." });
            }

            entity.Published = published;
            entity.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpDelete("admin/{id:guid}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Staff,Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var entity = await _db.Faqs.FirstOrDefaultAsync(x => x.Id == id);
            if (entity == null) return NotFound(new { Message = "Không tìm thấy FAQ." });

            _db.Faqs.Remove(entity);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

