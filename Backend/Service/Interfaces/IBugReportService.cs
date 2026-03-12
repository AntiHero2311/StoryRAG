using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Service.DTOs;

namespace Service.Interfaces
{
    public interface IBugReportService
    {
        // Author: tạo báo cáo lỗi
        Task<BugReportResponse> CreateAsync(Guid userId, CreateBugReportRequest request);

        // Author: xem danh sách báo cáo của chính mình
        Task<List<BugReportResponse>> GetMyReportsAsync(Guid userId);

        // Staff / Admin: xem toàn bộ báo cáo, lọc theo status
        Task<List<BugReportResponse>> GetAllAsync(string? statusFilter = null);

        // Staff / Admin: thống kê nhanh
        Task<BugReportStatsResponse> GetStatsAsync();

        // Staff / Admin: cập nhật trạng thái + ghi chú
        Task<BugReportResponse> UpdateStatusAsync(Guid reportId, Guid staffId, UpdateBugReportRequest request);

        // Staff / Admin: xoá báo cáo
        Task DeleteAsync(Guid reportId);
    }
}
