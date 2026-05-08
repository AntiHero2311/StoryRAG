using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("faqs")]
    public class Faq
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(300)]
        public string Question { get; set; } = string.Empty;

        [Required, MaxLength(5000)]
        public string Answer { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string Category { get; set; } = "General";

        /// <summary>Sort order (lower comes first).</summary>
        public int Order { get; set; } = 0;

        public bool Published { get; set; } = false;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

