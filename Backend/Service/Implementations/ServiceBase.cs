using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.Helpers;

namespace Service.Implementations
{
    /// <summary>
    /// Base class cung cấp các helper chung cho mọi service cần truy cập DB + mã hóa:
    /// VerifyOwnershipAsync, GetUserAsync, GetRawDek, GetRawDekAsync.
    /// </summary>
    public abstract class ServiceBase
    {
        protected readonly AppDbContext _context;
        protected readonly IConfiguration _config;

        protected ServiceBase(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        /// <summary>Xác minh user là chủ sở hữu project (chưa bị xóa).</summary>
        protected async Task VerifyOwnershipAsync(Guid projectId, Guid userId, CancellationToken ct = default)
        {
            var exists = await _context.Projects
                .AnyAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId, ct);
            if (!exists)
                throw new KeyNotFoundException("Dự án không tồn tại hoặc bạn không có quyền truy cập.");
        }

        /// <summary>Lấy User theo userId, throw nếu không tồn tại.</summary>
        protected async Task<User> GetUserAsync(Guid userId)
        {
            return await _context.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("User không tồn tại.");
        }

        /// <summary>Lấy raw DEK từ User đã có.</summary>
        protected string GetRawDek(User user)
        {
            var masterKey = _config["Security:MasterKey"]
                ?? throw new InvalidOperationException("MasterKey không tìm thấy trong cấu hình.");
            return EncryptionHelper.DecryptWithMasterKey(user.DataEncryptionKey!, masterKey);
        }

        /// <summary>Lấy raw DEK trực tiếp từ userId (kết hợp GetUserAsync + GetRawDek).</summary>
        protected async Task<string> GetRawDekAsync(Guid userId)
        {
            var user = await GetUserAsync(userId);
            return GetRawDek(user);
        }
    }
}
