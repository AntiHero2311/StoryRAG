using System;
using System.Collections.Generic;

namespace Service.DTOs
{
    public class UserSummaryDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class UserStatsResponse
    {
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int InactiveUsers { get; set; }
        public int TotalAuthors { get; set; }
        public int TotalStaff { get; set; }
        public int TotalAdmins { get; set; }
        public List<UserSummaryDto> Users { get; set; } = new();
    }
}
