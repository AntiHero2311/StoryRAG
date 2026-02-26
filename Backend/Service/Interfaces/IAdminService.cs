using System.Threading.Tasks;
using Service.DTOs;

namespace Service.Interfaces
{
    public interface IAdminService
    {
        Task<UserStatsResponse> GetUserStatsAsync();
    }
}
