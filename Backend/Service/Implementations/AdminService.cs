using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.DTOs;
using Service.Interfaces;
using System.Linq;
using System.Threading.Tasks;

namespace Service.Implementations
{
    public class AdminService : IAdminService
    {
        private readonly AppDbContext _context;

        public AdminService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<UserStatsResponse> GetUserStatsAsync()
        {
            var users = await _context.Users
                .OrderByDescending(u => u.CreatedAt)
                .ToListAsync();

            var summaries = users.Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                Role = u.Role,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            }).ToList();

            return new UserStatsResponse
            {
                TotalUsers = users.Count,
                ActiveUsers = users.Count(u => u.IsActive),
                InactiveUsers = users.Count(u => !u.IsActive),
                TotalAuthors = users.Count(u => u.Role == "Author"),
                TotalStaff = users.Count(u => u.Role == "Staff"),
                TotalAdmins = users.Count(u => u.Role == "Admin"),
                Users = summaries
            };
        }
    }
}
