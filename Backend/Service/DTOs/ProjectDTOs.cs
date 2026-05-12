using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class CreateProjectRequest
    {
        [Required]
        [MinLength(1)]
        public string Title { get; set; } = string.Empty;

        public string? Summary { get; set; }

        public string? AiInstructions { get; set; }

        public string Status { get; set; } = "Draft";

        public List<int> GenreIds { get; set; } = new();
    }

    public class UpdateProjectRequest
    {
        [Required]
        [MinLength(1)]
        public string Title { get; set; } = string.Empty;

        public string? Summary { get; set; }

        public string? AiInstructions { get; set; }

        public string? CoverImageURL { get; set; }

        public string Status { get; set; } = "Draft";

        public List<int> GenreIds { get; set; } = new();
    }

    public class ProjectResponse
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string? AiInstructions { get; set; }
        public string? CoverImageURL { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<GenreResponse> Genres { get; set; } = new();
    }

    public class ProjectImportResult
    {
        public Guid ProjectId { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public int ChaptersImported { get; set; }
        public int CharactersExtracted { get; set; }
        public int SettingsExtracted { get; set; }
        public int TimelineEventsExtracted { get; set; }
        public string? Summary { get; set; }
    }
}

