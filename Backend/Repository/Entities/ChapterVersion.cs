namespace Repository.Entities
{
    public class ChapterVersion
    {
        public Guid Id { get; set; }

        /// <summary>FK to Chapters.Id</summary>
        public Guid ChapterId { get; set; }

        /// <summary>Số thứ tự phiên bản (1, 2, 3...) tăng dần</summary>
        public int VersionNumber { get; set; }

        /// <summary>Tên phiên bản do người dùng đặt (VD: "Bản nháp 1", "Hướng đi mới")</summary>
        public string? Title { get; set; }

        /// <summary>AES-256 encrypted content (nội dung chương)</summary>
        public string Content { get; set; } = string.Empty;

        /// <summary>AES-256 encrypted change note (ghi chú thay đổi)</summary>
        public string? ChangeNote { get; set; }

        /// <summary>Số từ của version này</summary>
        public int WordCount { get; set; } = 0;

        /// <summary>Ước tính số token (dùng về sau khi có AI)</summary>
        public int TokenCount { get; set; } = 0;

        /// <summary>FK to Users.Id — người tạo version</summary>
        public Guid CreatedBy { get; set; }

        /// <summary>Đã chunk xong chưa</summary>
        public bool IsChunked { get; set; } = false;

        /// <summary>Đã embed vào VectorDB chưa (Phase 2)</summary>
        public bool IsEmbedded { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Cập nhật lần cuối (khi lưu in-place)</summary>
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public Chapter Chapter { get; set; } = null!;
        public User Creator { get; set; } = null!;
        public ICollection<ChapterChunk> Chunks { get; set; } = new List<ChapterChunk>();
    }
}
