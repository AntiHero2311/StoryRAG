using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Repository.Data;
using Repository.Entities;
using Service.Interfaces;
using System.Text.Json;

namespace Service.Implementations
{
    /// <summary>
    /// Lưu cấu hình vào bảng system_config, cache in-memory 60 giây.
    /// Singleton — dùng IServiceScopeFactory để tạo scope mới mỗi lần cần DB,
    /// tránh xung đột lifetime với AppDbContext (scoped).
    /// </summary>
    public class SystemConfigService : ISystemConfigService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<SystemConfigService> _logger;
        private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);
        private const string CacheKeyPrefix = "syscfg:";
        private const string AllKeysCacheKey = "syscfg:__all__";

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        public SystemConfigService(
            IServiceScopeFactory scopeFactory,
            IMemoryCache cache,
            ILogger<SystemConfigService> logger)
        {
            _scopeFactory = scopeFactory;
            _cache = cache;
            _logger = logger;
        }

        public async Task<T> GetAsync<T>(string key, T defaultValue)
        {
            var cacheKey = CacheKeyPrefix + key;
            if (_cache.TryGetValue(cacheKey, out string? cachedRaw) && cachedRaw != null)
                return DeserializeOrDefault(cachedRaw, defaultValue);

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var row = await db.SystemConfigs.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Key == key);

            if (row == null)
            {
                _cache.Set(cacheKey, SerializeValue(defaultValue), CacheDuration);
                return defaultValue;
            }

            _cache.Set(cacheKey, row.Value, CacheDuration);
            return DeserializeOrDefault(row.Value, defaultValue);
        }

        public async Task SetAsync<T>(string key, T value, Guid updatedBy)
        {
            var raw = SerializeValue(value);

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var existing = await db.SystemConfigs.FirstOrDefaultAsync(c => c.Key == key);

            if (existing == null)
            {
                db.SystemConfigs.Add(new SystemConfig
                {
                    Key = key,
                    Value = raw,
                    UpdatedBy = updatedBy,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                existing.Value = raw;
                existing.UpdatedBy = updatedBy;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();

            // Invalidate cache
            _cache.Remove(CacheKeyPrefix + key);
            _cache.Remove(AllKeysCacheKey);

            _logger.LogInformation("SystemConfig updated: key={Key} by updatedBy={UpdatedBy}", key, updatedBy);
        }

        public async Task<Dictionary<string, string>> GetAllRawAsync()
        {
            if (_cache.TryGetValue(AllKeysCacheKey, out Dictionary<string, string>? cached) && cached != null)
                return cached;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var rows = await db.SystemConfigs.AsNoTracking().ToListAsync();
            var dict = rows.ToDictionary(r => r.Key, r => r.Value);

            _cache.Set(AllKeysCacheKey, dict, CacheDuration);
            return dict;
        }

        private static string SerializeValue<T>(T value)
        {
            if (value is string s)
                return JsonSerializer.Serialize(s, JsonOpts);
            return JsonSerializer.Serialize(value, JsonOpts);
        }

        private static T DeserializeOrDefault<T>(string raw, T defaultValue)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(raw) || raw == "null")
                    return defaultValue;

                var result = JsonSerializer.Deserialize<T>(raw, JsonOpts);
                return result ?? defaultValue;
            }
            catch
            {
                return defaultValue;
            }
        }
    }
}
