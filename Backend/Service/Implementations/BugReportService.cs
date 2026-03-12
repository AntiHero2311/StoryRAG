using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Interfaces;

namespace Service.Implementations
{
    public class BugReportService : IBugReportService
    {
        private readonly AppDbContext _db;

        public BugReportService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<BugReportResponse> CreateAsync(Guid userId, CreateBugReportRequest request)
        {
            var report = new BugReport
            {
                UserId = userId,
                Title = request.Title.Trim(),
                Description = request.Description.Trim(),
                Category = request.Category,
                Priority = request.Priority,
                Status = "Open",
                CreatedAt = DateTime.UtcNow,
            };

            _db.BugReports.Add(report);
            await _db.SaveChangesAsync();

            await _db.Entry(report).Reference(r => r.User).LoadAsync();
            return MapToResponse(report);
        }

        public async Task<List<BugReportResponse>> GetMyReportsAsync(Guid userId)
        {
            var reports = await _db.BugReports
                .Include(r => r.User)
                .Include(r => r.ResolvedBy)
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return reports.Select(MapToResponse).ToList();
        }

        public async Task<List<BugReportResponse>> GetAllAsync(string? statusFilter = null)
        {
            var query = _db.BugReports
                .Include(r => r.User)
                .Include(r => r.ResolvedBy)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(statusFilter))
                query = query.Where(r => r.Status == statusFilter);

            var reports = await query
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return reports.Select(MapToResponse).ToList();
        }

        public async Task<BugReportStatsResponse> GetStatsAsync()
        {
            var counts = await _db.BugReports
                .GroupBy(r => r.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            int Get(string s) => counts.FirstOrDefault(x => x.Status == s)?.Count ?? 0;

            return new BugReportStatsResponse
            {
                Total = counts.Sum(x => x.Count),
                Open = Get("Open"),
                InProgress = Get("InProgress"),
                Resolved = Get("Resolved"),
                Closed = Get("Closed"),
            };
        }

        public async Task<BugReportResponse> UpdateStatusAsync(Guid reportId, Guid staffId, UpdateBugReportRequest request)
        {
            var report = await _db.BugReports
                .Include(r => r.User)
                .Include(r => r.ResolvedBy)
                .FirstOrDefaultAsync(r => r.Id == reportId)
                ?? throw new Exception("Không tìm thấy báo cáo.");

            report.Status = request.Status;
            report.StaffNote = request.StaffNote?.Trim();
            report.UpdatedAt = DateTime.UtcNow;

            if (request.Status is "Resolved" or "Closed")
                report.ResolvedById = staffId;

            await _db.SaveChangesAsync();
            await _db.Entry(report).Reference(r => r.ResolvedBy).LoadAsync();
            return MapToResponse(report);
        }

        public async Task DeleteAsync(Guid reportId)
        {
            var report = await _db.BugReports.FindAsync(reportId)
                ?? throw new Exception("Không tìm thấy báo cáo.");

            _db.BugReports.Remove(report);
            await _db.SaveChangesAsync();
        }

        private static BugReportResponse MapToResponse(BugReport r) => new()
        {
            Id = r.Id,
            UserId = r.UserId,
            ReporterName = r.User?.FullName ?? "",
            ReporterEmail = r.User?.Email ?? "",
            Title = r.Title,
            Description = r.Description,
            Category = r.Category,
            Priority = r.Priority,
            Status = r.Status,
            StaffNote = r.StaffNote,
            ResolvedByName = r.ResolvedBy?.FullName,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt,
        };
    }
}
