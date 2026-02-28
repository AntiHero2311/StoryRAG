using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class GenreResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class CreateGenreRequest
    {
        [Required][MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required][MaxLength(100)]
        public string Slug { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Color { get; set; } = "#6366f1";

        [MaxLength(500)]
        public string? Description { get; set; }
    }

    public class UpdateGenreRequest
    {
        [Required][MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required][MaxLength(100)]
        public string Slug { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Color { get; set; } = "#6366f1";

        [MaxLength(500)]
        public string? Description { get; set; }
    }
}
