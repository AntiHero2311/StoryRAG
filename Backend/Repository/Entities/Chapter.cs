namespace Repository.Entities
{
    public class Chapter
    {
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id</summary>
        public Guid ProjectId { get; set; }

        /// <summary>Số thứ tự chương (1, 2, 3...)</summary>
        public int ChapterNumber { get; set; }

        /// <summary>Tên chương — plain text, không nhạy cảm</summary>
        public string? Title { get; set; }

        /// <summary>Tổng số từ của version hiện tại</summary>
        public int WordCount { get; set; } = 0;

        /// <summary>Draft | Final | Archived</summary>
        public string Status { get; set; } = "Draft";

        /// <summary>FK tới version đang active</summary>
        public Guid? CurrentVersionId { get; set; }

        /// <summary>Số version hiện tại (tiện dùng)</summary>
        public int CurrentVersionNum { get; set; } = 0;

        public bool IsDeleted { get; set; } = false;

        /// <summary>Nội dung draft (auto-save, encrypted). Không tạo version mới.</summary>
        public string? DraftContent { get; set; }

        /// <summary>Thời điểm draft cuối cùng được lưu.</summary>
        public DateTime? DraftSavedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
        public ChapterVersion? CurrentVersion { get; set; }
        public ICollection<ChapterVersion> Versions { get; set; } = new List<ChapterVersion>();
    }
}
