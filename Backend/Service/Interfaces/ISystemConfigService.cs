namespace Service.Interfaces
{
    public interface ISystemConfigService
    {
        Task<T> GetAsync<T>(string key, T defaultValue);
        Task SetAsync<T>(string key, T value, Guid updatedBy);
    }
}
