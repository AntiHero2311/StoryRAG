namespace Repository.Entities
{
    public class ProjectReportSnapshot
    {
        public Guid Id { get; set; }

        public Guid ProjectReportId { get; set; }

        public int ChapterNumber { get; set; }

        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// Nội dung văn bản (Plain Text) của chương tại thời điểm phân tích.
        /// Đã được mã hóa AES-256.
        /// </summary>
        public string Content { get; set; } = string.Empty;

        public int WordCount { get; set; }

        // Navigation
        public ProjectReport ProjectReport { get; set; } = null!;
    }
}
