using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Repository.Data;
using Repository.Entities;
using Service.Interfaces;
using System.Text.Json;

namespace Service.Implementations
{
    public class SystemConfigService : ISystemConfigService
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;
        private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);
        private const string CacheKeyPrefix = "syscfg:";

        public SystemConfigService(AppDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        public async Task<T> GetAsync<T>(string key, T defaultValue)
        {
            var cacheKey = CacheKeyPrefix + key;
            if (_cache.TryGetValue(cacheKey, out string? cachedJson) && cachedJson != null)
            {
                return Deserialize(cachedJson, defaultValue);
            }

            var entity = await _context.SystemConfigs
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Key == key);

            if (entity == null)
                return defaultValue;

            _cache.Set(cacheKey, entity.Value, CacheDuration);
            return Deserialize(entity.Value, defaultValue);
        }

        public async Task SetAsync<T>(string key, T value, Guid updatedBy)
        {
            var json = JsonSerializer.Serialize(value);

            var entity = await _context.SystemConfigs.FirstOrDefaultAsync(c => c.Key == key);
            if (entity == null)
            {
                entity = new SystemConfig { Key = key };
                _context.SystemConfigs.Add(entity);
            }

            entity.Value = json;
            entity.UpdatedBy = updatedBy;
            entity.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _cache.Remove(CacheKeyPrefix + key);
        }

        private static T Deserialize<T>(string json, T defaultValue)
        {
            try
            {
                var result = JsonSerializer.Deserialize<T>(json);
                return result ?? defaultValue;
            }
            catch (JsonException)
            {
                return defaultValue;
            }
        }
    }
}
