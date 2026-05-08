using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    [Table("writing_tips")]
    public class WritingTip
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required, MaxLength(8000)]
        public string Content { get; set; } = string.Empty;

        /// <summary>Tags for filtering (postgres text[]).</summary>
        public string[] Tags { get; set; } = [];

        public bool Published { get; set; } = false;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

