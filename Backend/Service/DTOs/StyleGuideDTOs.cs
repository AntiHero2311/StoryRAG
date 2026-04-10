using System;
using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class CreateStyleGuideRequest
    {
        public string Aspect { get; set; } = "Other";
        public string Content { get; set; } = string.Empty;
    }

    public class UpdateStyleGuideRequest
    {
        public string? Aspect { get; set; }
        public string? Content { get; set; }
    }

    public class StyleGuideResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string Aspect { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool HasEmbedding { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
