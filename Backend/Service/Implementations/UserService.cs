using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.DTOs;
using Service.Interfaces;
using System;
using System.Threading.Tasks;

namespace Service.Implementations
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;

        public UserService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<UserProfileResponse> GetUserProfileAsync(Guid userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);
            if (user == null)
                throw new Exception("Không tìm thấy người dùng.");

            return new UserProfileResponse
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                AvatarURL = user.AvatarURL,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            };
        }

        public async Task<UserProfileResponse> UpdateUserProfileAsync(Guid userId, UpdateProfileRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);
            if (user == null)
                throw new Exception("Không tìm thấy người dùng.");

            if (!string.IsNullOrWhiteSpace(request.FullName))
                user.FullName = request.FullName.Trim();

            if (request.AvatarURL != null)
                user.AvatarURL = request.AvatarURL;

            await _context.SaveChangesAsync();

            return new UserProfileResponse
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                AvatarURL = user.AvatarURL,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            };
        }
    }
}
