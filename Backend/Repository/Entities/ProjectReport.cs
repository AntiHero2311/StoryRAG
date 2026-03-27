using System.Text.Json;

namespace Repository.Entities
{
    public class ProjectReport
    {
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>FK to Users.Id</summary>
        public Guid UserId { get; set; }

        /// <summary>Pending | Completed | Failed | MockData</summary>
        public string Status { get; set; } = "Pending";

        /// <summary>Tổng điểm (0–100)</summary>
        public decimal TotalScore { get; set; }

        /// <summary>JSONB: array of 13 criterion results</summary>
        public string CriteriaJson { get; set; } = "[]";

        /// <summary>Lưu lại phiên bản dự án lúc đánh giá (vd: v1.0.0)</summary>
        public string ProjectVersion { get; set; } = "v1.0.0";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
