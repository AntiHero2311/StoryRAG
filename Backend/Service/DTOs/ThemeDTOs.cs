using System;
using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class CreateThemeRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    public class UpdateThemeRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Notes { get; set; }
    }

    public class ThemeResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
