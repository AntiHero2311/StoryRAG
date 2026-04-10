using System;
using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class CreatePlotNoteRequest
    {
        public string Type { get; set; } = "Other";
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class UpdatePlotNoteRequest
    {
        public string? Type { get; set; }
        public string? Title { get; set; }
        public string? Content { get; set; }
    }

    public class PlotNoteResponse
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool HasEmbedding { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
