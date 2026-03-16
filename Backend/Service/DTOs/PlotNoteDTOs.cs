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
}
