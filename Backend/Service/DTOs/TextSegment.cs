using System;
using System.Collections.Generic;

namespace Service.DTOs
{
    public class TextSegment
    {
        public int SegmentIndex { get; set; }
        public Guid? ChapterId { get; set; }
        public int ChapterNumber { get; set; }
        public string Text { get; set; } = string.Empty;
        public int WordCount { get; set; }
        public List<string> Tokens { get; set; } = new();
    }
}
