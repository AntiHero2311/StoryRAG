namespace Repository.Entities
{
    public class Notification
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid? CreatedByUserId { get; set; }
        public string Type { get; set; } = "info";
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Tag { get; set; }
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadAt { get; set; }

        public User User { get; set; } = null!;
        public User? CreatedByUser { get; set; }
    }
}
