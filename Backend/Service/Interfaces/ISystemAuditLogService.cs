using Service.DTOs;

namespace Service.Interfaces
{
    public interface ISystemAuditLogService
    {
        Task LogAsync(string category, string action, string message, Guid? actorId = null, string level = "Info", string? metadataJson = null);
        Task<SystemLogsPageResponse> GetLogsAsync(int page, int pageSize, string? category, string? level);
    }
}
