using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("analysis_job_rerun_audits")]
    public class AnalysisJobRerunAudit
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid OldJobId { get; set; }

        [Required]
        public Guid NewJobId { get; set; }

        [Required]
        public Guid StaffId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

