namespace Service.DTOs
{
    public class NarrativeChartsResponse
    {
        public List<PacingPoint> Pacing { get; set; } = new();
        public List<EmotionPoint> Emotions { get; set; } = new();
        public List<CharacterFrequency> CharacterFrequencies { get; set; } = new();
        public List<CharacterPresenceSeries> CharacterPresence { get; set; } = new();
        public List<CharacterRelationshipEdge> CharacterRelationships { get; set; } = new();
    }

    public class PacingPoint
    {
        public int SegmentIndex { get; set; }
        public int ChapterNumber { get; set; }
        public double Score { get; set; }
    }

    public class EmotionPoint
    {
        public int SegmentIndex { get; set; }
        public int ChapterNumber { get; set; }
        public double Valence { get; set; }
        public double Intensity { get; set; }
        public string DominantEmotion { get; set; } = "Neutral";
    }

    public class CharacterFrequency
    {
        public string CharacterName { get; set; } = string.Empty;
        public int TotalMentions { get; set; }
    }

    public class CharacterPresenceSeries
    {
        public string CharacterName { get; set; } = string.Empty;
        public List<CharacterPresencePoint> Points { get; set; } = new();
    }

    public class CharacterPresencePoint
    {
        public int SegmentIndex { get; set; }
        public int ChapterNumber { get; set; }
        public int Mentions { get; set; }
    }

    public class CharacterRelationshipEdge
    {
        public string SourceCharacter { get; set; } = string.Empty;
        public string TargetCharacter { get; set; } = string.Empty;
        public int Weight { get; set; }
    }
}
