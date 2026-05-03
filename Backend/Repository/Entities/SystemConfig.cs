namespace Repository.Entities
{
    /// <summary>
    /// Lưu trữ cấu hình hệ thống dạng key-value (JSONB). Admin có thể thay đổi ở runtime.
    /// </summary>
    public class SystemConfig
    {
        /// <summary>Khóa định danh cấu hình, ví dụ: "rag.chunk_size"</summary>
        public string Key { get; set; } = string.Empty;

        /// <summary>Giá trị JSON (string, int, bool, object). Stored as JSONB.</summary>
        public string Value { get; set; } = "null";

        /// <summary>Admin đã cập nhật lần cuối.</summary>
        public Guid? UpdatedBy { get; set; }

        public User? Updater { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
