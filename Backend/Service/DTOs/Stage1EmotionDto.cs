using System.Text.Json.Serialization;

namespace Service.DTOs
{
    public class Stage1EmotionDto
    {
        [JsonPropertyName("valence")]
        public double Valence { get; set; } = 0.0;

        [JsonPropertyName("intensity")]
        public double Intensity { get; set; } = 0.0;

        [JsonPropertyName("dominantEmotion")]
        public string DominantEmotion { get; set; } = "Neutral";

        [JsonPropertyName("pacingScore")]
        public double PacingScore { get; set; } = 50.0;

        [JsonPropertyName("note")]
        public string Note { get; set; } = string.Empty;
    }
}
