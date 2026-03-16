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
}
