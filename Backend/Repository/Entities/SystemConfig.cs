using System;

namespace Repository.Entities
{
    public class SystemConfig
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = "null";
        public Guid UpdatedBy { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
