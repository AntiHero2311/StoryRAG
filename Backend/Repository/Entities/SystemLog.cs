using System;

namespace Repository.Entities
{
    public class SystemLog
    {
        public Guid Id { get; set; }
        public string Level { get; set; } = "Info";
        public string Category { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public Guid? ActorId { get; set; }
        public string? MetadataJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public User? Actor { get; set; }
    }
}
