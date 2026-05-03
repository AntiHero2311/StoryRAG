namespace Repository.Entities
{
    /// <summary>
    /// Một dòng rubric (Stage 2) gắn với <see cref="ProjectReport"/>; lưu tham chiếu chunk làm bằng chứng.
    /// </summary>
    public class ReportItem
    {
        public Guid Id { get; set; }

        /// <summary>FK tới ProjectReports.Id</summary>
        public Guid ProjectReportId { get; set; }

        /// <summary>Mã tiêu chí rubric (vd: 1.1, 2.3).</summary>
        public string CriterionKey { get; set; } = string.Empty;

        /// <summary>
        /// JSONB: mảng số nguyên (vd. id nội bộ hoặc ChunkIndex) trỏ tới chunk gốc làm bằng chứng; null cho bản ghi cũ / chưa gán.
        /// </summary>
        public List<int>? EvidenceChunkIds { get; set; }

        public ProjectReport ProjectReport { get; set; } = null!;
    }
}
