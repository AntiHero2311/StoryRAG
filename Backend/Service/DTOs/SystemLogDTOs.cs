using System;
using System.Collections.Generic;

namespace Service.DTOs
{
    public class SystemLogItemDto
    {
        public Guid Id { get; set; }
        public string Level { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public Guid? ActorId { get; set; }
        public string? ActorName { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class SystemLogsPageResponse
    {
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        /// <summary>False khi bảng system_logs chưa tồn tại trên DB.</summary>
        public bool StorageReady { get; set; } = true;
        public List<SystemLogItemDto> Items { get; set; } = new();
    }

    public class SystemLimitsResponse
    {
        public int MaxUploadMb { get; set; }
        public int MaxProjectsPerAuthor { get; set; }
        public bool MaintenanceMode { get; set; }
        public long TotalProjects { get; set; }
        public long TotalChapters { get; set; }
        public long TotalWordCount { get; set; }
    }

    public class SystemLimitsRequest
    {
        public int MaxUploadMb { get; set; }
        public int MaxProjectsPerAuthor { get; set; }
        public bool MaintenanceMode { get; set; }
    }
}
