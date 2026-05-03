namespace Service.Interfaces
{
    /// <summary>
    /// Dịch vụ đọc/ghi cấu hình hệ thống với cache in-memory 60 giây.
    /// Admin có thể cập nhật tham số RAG ở runtime mà không cần restart server.
    /// </summary>
    public interface ISystemConfigService
    {
        /// <summary>Lấy giá trị cấu hình. Trả về defaultValue nếu chưa được set.</summary>
        Task<T> GetAsync<T>(string key, T defaultValue);

        /// <summary>Ghi/cập nhật giá trị cấu hình và invalidate cache.</summary>
        Task SetAsync<T>(string key, T value, Guid updatedBy);

        /// <summary>Lấy toàn bộ config keys hiện có (dùng cho admin UI).</summary>
        Task<Dictionary<string, string>> GetAllRawAsync();
    }
}
