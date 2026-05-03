namespace Repository.Entities
{
    /// <summary>
    /// Kết quả cố định giai đoạn 1 (trích xuất facts) của phân tích project, lưu JSONB để RAG / giai đoạn 2 đọc lại.
    /// </summary>
    public class ProjectAnalysisFact
    {
        public Guid Id { get; set; }

        /// <summary>FK tới Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>
        /// Định danh một lần chạy phân tích; FK tới ProjectAnalysisJobs.Id (cùng một job = một run).
        /// </summary>
        public Guid RunId { get; set; }

        /// <summary>
        /// JSONB — schema tổng quát (Stage 1). Bắt buộc có bốn mảng cấp cao:
        /// <para>
        /// <c>{ "characters": [], "chapter_stats": [], "plot_events": [], "consistency_flags": [] }</c>
        /// </para>
        /// <list type="bullet">
        /// <item><description><c>characters</c> — mảng object: thông tin nhân vật đã trích (tên, vai trò, traits, ... tùy pipeline).</description></item>
        /// <item><description><c>chapter_stats</c> — mảng object: thống kê theo chương (số từ, tâm điểm, ...).</description></item>
        /// <item><description><c>plot_events</c> — mảng object: sự kiện cốt truyện có thứ tự / tham chiếu chương.</description></item>
        /// <item><description><c>consistency_flags</c> — mảng object: cờ / gợi ý mâu thuẫn logic (chưa chấm điểm — thuộc Stage 2).</description></item>
        /// </list>
        /// Phần tử trong từng mảng là object tự do (schema chi tiết do M2.1.3 quy định); DB chỉ đảm bảo cấu trúc cấp 1.
        /// </summary>
        public string Payload { get; set; } =
            """{"characters":[],"chapter_stats":[],"plot_events":[],"consistency_flags":[]}""";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Project Project { get; set; } = null!;
        public ProjectAnalysisJob AnalysisJob { get; set; } = null!;
    }
}
