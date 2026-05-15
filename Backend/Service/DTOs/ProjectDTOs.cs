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
        public int GenresLinked { get; set; }
        public string? Summary { get; set; }
        /// <summary>true nếu bước AI trích xuất bị lỗi (quá tải key). Dùng /reextract để thử lại.</summary>
        public bool AiExtractionFailed { get; set; }
        public string? AiExtractionError { get; set; }
    }

    public class ReExtractResult
    {
        public Guid ProjectId { get; set; }
        public int CharactersExtracted { get; set; }
        public int SettingsExtracted { get; set; }
        public int TimelineEventsExtracted { get; set; }
        public string? Summary { get; set; }
        public bool AiExtractionFailed { get; set; }
        public string? AiExtractionError { get; set; }
    }
}

