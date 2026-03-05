using System.ComponentModel.DataAnnotations;

namespace Service.DTOs
{
    public class EditorSettingsResponse
    {
        public string EditorFont { get; set; } = "Be Vietnam Pro";
        public int EditorFontSize { get; set; } = 17;
    }

    public class UpdateEditorSettingsRequest
    {
        [MaxLength(100)]
        public string? EditorFont { get; set; }

        [Range(10, 32)]
        public int? EditorFontSize { get; set; }
    }
}
