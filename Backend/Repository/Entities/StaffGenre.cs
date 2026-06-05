using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Repository.Entities
{
    /// <summary>
    /// Junction table: Staff ↔ Genre chuyên môn.
    /// Admin gán thể loại truyện cho từng Staff.
    /// </summary>
    [Table("StaffGenres")]
    public class StaffGenre
    {
        [Required]
        public Guid StaffId { get; set; }

        [Required]
        public int GenreId { get; set; }

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Admin đã gán (audit trail).</summary>
        public Guid? AssignedBy { get; set; }

        // Navigation
        [ForeignKey(nameof(StaffId))]
        public User Staff { get; set; } = null!;

        [ForeignKey(nameof(GenreId))]
        public Genre Genre { get; set; } = null!;

        [ForeignKey(nameof(AssignedBy))]
        public User? AssignedByAdmin { get; set; }
    }
}
