using System;
using System.Threading.Tasks;
using Service.DTOs;

namespace Service.Interfaces
{
    public interface IUserService
    {
        Task<UserProfileResponse> GetUserProfileAsync(Guid userId);
        Task<UserProfileResponse> UpdateUserProfileAsync(Guid userId, UpdateProfileRequest request);
    }
}
