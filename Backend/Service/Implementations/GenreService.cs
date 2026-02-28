using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class GenreService : IGenreService
    {
        private readonly AppDbContext _context;

        public GenreService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<GenreResponse>> GetAllGenresAsync()
        {
            return await _context.Genres
                .OrderBy(g => g.Name)
                .Select(g => MapToResponse(g))
                .ToListAsync();
        }

        public async Task<GenreResponse> GetGenreByIdAsync(int id)
        {
            var genre = await _context.Genres.FindAsync(id)
                ?? throw new Exception("Không tìm thấy thể loại.");
            return MapToResponse(genre);
        }

        public async Task<GenreResponse> CreateGenreAsync(CreateGenreRequest request)
        {
            if (await _context.Genres.AnyAsync(g => g.Slug == request.Slug))
                throw new Exception("Slug đã tồn tại.");

            var genre = new Genre
            {
                Name = request.Name,
                Slug = request.Slug,
                Color = request.Color,
                Description = request.Description,
            };

            _context.Genres.Add(genre);
            await _context.SaveChangesAsync();
            return MapToResponse(genre);
        }

        public async Task<GenreResponse> UpdateGenreAsync(int id, UpdateGenreRequest request)
        {
            var genre = await _context.Genres.FindAsync(id)
                ?? throw new Exception("Không tìm thấy thể loại.");

            if (await _context.Genres.AnyAsync(g => g.Slug == request.Slug && g.Id != id))
                throw new Exception("Slug đã tồn tại.");

            genre.Name = request.Name;
            genre.Slug = request.Slug;
            genre.Color = request.Color;
            genre.Description = request.Description;

            await _context.SaveChangesAsync();
            return MapToResponse(genre);
        }

        public async Task DeleteGenreAsync(int id)
        {
            var genre = await _context.Genres.FindAsync(id)
                ?? throw new Exception("Không tìm thấy thể loại.");

            _context.Genres.Remove(genre);
            await _context.SaveChangesAsync();
        }

        private static GenreResponse MapToResponse(Genre genre) => new()
        {
            Id = genre.Id,
            Name = genre.Name,
            Slug = genre.Slug,
            Color = genre.Color,
            Description = genre.Description,
        };
    }
}
