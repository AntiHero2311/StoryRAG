using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class CreateProjectRequest
    {
        [Required]
        [MinLength(1)]
        public string Title { get; set; } = string.Empty;

        public string? Summary { get; set; }

        public string Status { get; set; } = "Draft";
    }

    public class UpdateProjectRequest
    {
        [Required]
        [MinLength(1)]
        public string Title { get; set; } = string.Empty;

        public string? Summary { get; set; }

        public string? CoverImageURL { get; set; }

        public string Status { get; set; } = "Draft";
    }

    public class ProjectResponse
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string? CoverImageURL { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
