using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;

namespace Service.Implementations
{
    public class StaffService : IStaffService
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly IProjectReportService _projectReportService;

        public StaffService(AppDbContext db, IConfiguration config, IProjectReportService projectReportService)
        {
            _db = db;
            _config = config;
            _projectReportService = projectReportService;
        }

        public async Task<StaffPagedResponse<FlaggedManuscriptItem>> GetFlaggedManuscriptsAsync(int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var projects = await _db.Projects
                .AsNoTracking()
                .Where(p => !p.IsDeleted)
                .Include(p => p.Author)
                .OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt)
                .ToListAsync();

            var reports = await _db.ProjectReports
                .AsNoTracking()
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var latestByProject = reports
                .GroupBy(r => r.ProjectId)
                .ToDictionary(g => g.Key, g => g.First());

            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Thiếu cấu hình Security:MasterKey.");
            var flagged = new List<FlaggedManuscriptItem>();

            foreach (var project in projects)
            {
                latestByProject.TryGetValue(project.Id, out var latestReport);
                var flagReason = GetFlagReason(latestReport);
                if (flagReason == null)
                {
                    continue;
                }

                var title = "[Encrypted Title]";
                if (!string.IsNullOrWhiteSpace(project.Author.DataEncryptionKey))
                {
                    var authorDek = EncryptionHelper.DecryptWithMasterKey(project.Author.DataEncryptionKey, masterKey);
                    title = EncryptionHelper.DecryptWithMasterKey(project.Title, authorDek);
                }

                flagged.Add(new FlaggedManuscriptItem
                {
                    ProjectId = project.Id,
                    ProjectTitle = title,
                    AuthorId = project.AuthorId,
                    AuthorName = project.Author.FullName,
                    LatestReportStatus = latestReport?.Status,
                    LatestScore = latestReport?.TotalScore,
                    LatestReportId = latestReport?.Id,
                    FlagReason = flagReason,
                    LastUpdatedAt = latestReport?.UpdatedAt ?? latestReport?.CreatedAt ?? project.UpdatedAt ?? project.CreatedAt
                });
            }

            var total = flagged.Count;
            var items = flagged
                .OrderByDescending(x => x.LastUpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return new StaffPagedResponse<FlaggedManuscriptItem>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<StaffPagedResponse<StaffFeedbackResponse>> GetFeedbacksAsync(Guid? projectId, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.StaffFeedbacks
                .AsNoTracking()
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .AsQueryable();

            if (projectId.HasValue)
            {
                query = query.Where(x => x.ProjectId == projectId.Value);
            }

            var total = await query.CountAsync();
            var entities = await query
                .OrderByDescending(x => x.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            var items = entities.Select(MapFeedback).ToList();

            return new StaffPagedResponse<StaffFeedbackResponse>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<StaffFeedbackResponse> CreateFeedbackAsync(Guid staffId, StaffFeedbackRequest request)
        {
            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted)
                ?? throw new KeyNotFoundException("Không tìm thấy dự án.");

            if (request.ChapterId.HasValue)
            {
                var chapterExists = await _db.Chapters.AnyAsync(c => c.Id == request.ChapterId.Value && c.ProjectId == request.ProjectId && !c.IsDeleted);
                if (!chapterExists)
                {
                    throw new KeyNotFoundException("Chapter không thuộc dự án hoặc không tồn tại.");
                }
            }

            var feedback = new StaffFeedback
            {
                Id = Guid.NewGuid(),
                ProjectId = request.ProjectId,
                ChapterId = request.ChapterId,
                AuthorId = project.AuthorId,
                StaffId = staffId,
                Content = request.Content.Trim(),
                Status = request.Status,
                StaffNote = string.IsNullOrWhiteSpace(request.StaffNote) ? null : request.StaffNote.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _db.StaffFeedbacks.Add(feedback);
            await _db.SaveChangesAsync();

            feedback = await _db.StaffFeedbacks
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .FirstAsync(x => x.Id == feedback.Id);

            return MapFeedback(feedback);
        }

        public async Task<StaffFeedbackResponse> UpdateFeedbackAsync(Guid feedbackId, Guid staffId, StaffFeedbackRequest request)
        {
            var feedback = await _db.StaffFeedbacks
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .FirstOrDefaultAsync(x => x.Id == feedbackId)
                ?? throw new KeyNotFoundException("Không tìm thấy feedback.");

            feedback.StaffId = staffId;
            feedback.Content = request.Content.Trim();
            feedback.Status = request.Status;
            feedback.StaffNote = string.IsNullOrWhiteSpace(request.StaffNote) ? null : request.StaffNote.Trim();
            feedback.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return MapFeedback(feedback);
        }

        public async Task DeleteFeedbackAsync(Guid feedbackId)
        {
            var feedback = await _db.StaffFeedbacks.FindAsync(feedbackId)
                ?? throw new KeyNotFoundException("Không tìm thấy feedback.");

            _db.StaffFeedbacks.Remove(feedback);
            await _db.SaveChangesAsync();
        }

        public async Task<StaffPagedResponse<StaffContentResponse>> GetKnowledgeBaseAsync(string? type, bool? isPublished, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.StaffKnowledgeBaseItems.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(type))
            {
                query = query.Where(x => x.Type == type);
            }

            if (isPublished.HasValue)
            {
                query = query.Where(x => x.IsPublished == isPublished.Value);
            }

            var total = await query.CountAsync();
            var entities = await query
                .OrderBy(x => x.SortOrder)
                .ThenByDescending(x => x.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            var items = entities.Select(MapContent).ToList();

            return new StaffPagedResponse<StaffContentResponse>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<StaffContentResponse> CreateKnowledgeBaseItemAsync(Guid staffId, StaffContentRequest request)
        {
            var entity = new StaffKnowledgeBaseItem
            {
                Id = Guid.NewGuid(),
                Type = request.Type,
                Title = request.Title.Trim(),
                Content = request.Content.Trim(),
                Tags = string.IsNullOrWhiteSpace(request.Tags) ? null : request.Tags.Trim(),
                IsPublished = request.IsPublished,
                SortOrder = request.SortOrder,
                CreatedBy = staffId,
                CreatedAt = DateTime.UtcNow
            };

            _db.StaffKnowledgeBaseItems.Add(entity);
            await _db.SaveChangesAsync();
            return MapContent(entity);
        }

        public async Task<StaffContentResponse> UpdateKnowledgeBaseItemAsync(Guid id, Guid staffId, StaffContentRequest request)
        {
            var entity = await _db.StaffKnowledgeBaseItems.FirstOrDefaultAsync(x => x.Id == id)
                ?? throw new KeyNotFoundException("Không tìm thấy bài viết.");

            entity.Type = request.Type;
            entity.Title = request.Title.Trim();
            entity.Content = request.Content.Trim();
            entity.Tags = string.IsNullOrWhiteSpace(request.Tags) ? null : request.Tags.Trim();
            entity.IsPublished = request.IsPublished;
            entity.SortOrder = request.SortOrder;
            entity.UpdatedBy = staffId;
            entity.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return MapContent(entity);
        }

        public async Task DeleteKnowledgeBaseItemAsync(Guid id)
        {
            var entity = await _db.StaffKnowledgeBaseItems.FirstOrDefaultAsync(x => x.Id == id)
                ?? throw new KeyNotFoundException("Không tìm thấy bài viết.");

            _db.StaffKnowledgeBaseItems.Remove(entity);
            await _db.SaveChangesAsync();
        }

        public async Task<StaffPagedResponse<StaffAnalysisReviewResponse>> GetAnalysisReviewsAsync(Guid? projectId, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.StaffAnalysisReviews.AsNoTracking().AsQueryable();
            if (projectId.HasValue)
            {
                query = query.Where(x => x.ProjectId == projectId.Value);
            }

            var total = await query.CountAsync();
            var entities = await query
                .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            var items = entities.Select(MapReview).ToList();

            return new StaffPagedResponse<StaffAnalysisReviewResponse>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            };
        }

        public async Task<StaffAnalysisReviewResponse> ReviewAnalysisAsync(Guid reportId, Guid staffId, ReviewAnalysisRequest request)
        {
            var report = await _db.ProjectReports
                .Include(r => r.Project)
                .FirstOrDefaultAsync(r => r.Id == reportId)
                ?? throw new KeyNotFoundException("Không tìm thấy báo cáo phân tích.");

            var review = await _db.StaffAnalysisReviews.FirstOrDefaultAsync(x => x.ProjectReportId == reportId);
            if (review == null)
            {
                review = new StaffAnalysisReview
                {
                    Id = Guid.NewGuid(),
                    ProjectReportId = reportId,
                    ProjectId = report.ProjectId,
                    AuthorId = report.Project.AuthorId,
                    ReviewedBy = staffId,
                    Action = request.Action,
                    Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                    CreatedAt = DateTime.UtcNow
                };
                _db.StaffAnalysisReviews.Add(review);
            }
            else
            {
                review.ReviewedBy = staffId;
                review.Action = request.Action;
                review.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
                review.UpdatedAt = DateTime.UtcNow;
            }

            if (request.Action == "RerunRequested")
            {
                var isIncomplete = !string.Equals(report.Status, "Completed", StringComparison.OrdinalIgnoreCase)
                                   || (!string.IsNullOrWhiteSpace(report.CriteriaJson) &&
                                       report.CriteriaJson.Contains("INCOMPLETE", StringComparison.OrdinalIgnoreCase));
                if (!isIncomplete)
                {
                    throw new InvalidOperationException("Chỉ có thể re-run các phân tích chưa hoàn tất hoặc bị gắn cờ INCOMPLETE.");
                }

                var rerun = await _projectReportService.AnalyzeAsync(report.ProjectId, report.Project.AuthorId);
                review.RerunReportId = rerun.Id;
            }

            await _db.SaveChangesAsync();
            return MapReview(review);
        }

        private static StaffFeedbackResponse MapFeedback(StaffFeedback feedback)
        {
            return new StaffFeedbackResponse
            {
                Id = feedback.Id,
                ProjectId = feedback.ProjectId,
                ChapterId = feedback.ChapterId,
                AuthorId = feedback.AuthorId,
                AuthorName = feedback.Author?.FullName ?? string.Empty,
                StaffId = feedback.StaffId,
                StaffName = feedback.Staff?.FullName ?? string.Empty,
                Content = feedback.Content,
                Status = feedback.Status,
                StaffNote = feedback.StaffNote,
                CreatedAt = feedback.CreatedAt,
                UpdatedAt = feedback.UpdatedAt
            };
        }

        private static StaffContentResponse MapContent(StaffKnowledgeBaseItem item)
        {
            return new StaffContentResponse
            {
                Id = item.Id,
                Type = item.Type,
                Title = item.Title,
                Content = item.Content,
                Tags = item.Tags,
                IsPublished = item.IsPublished,
                SortOrder = item.SortOrder,
                CreatedBy = item.CreatedBy,
                UpdatedBy = item.UpdatedBy,
                CreatedAt = item.CreatedAt,
                UpdatedAt = item.UpdatedAt
            };
        }

        private static StaffAnalysisReviewResponse MapReview(StaffAnalysisReview review)
        {
            return new StaffAnalysisReviewResponse
            {
                Id = review.Id,
                ProjectReportId = review.ProjectReportId,
                ProjectId = review.ProjectId,
                AuthorId = review.AuthorId,
                ReviewedBy = review.ReviewedBy,
                Action = review.Action,
                Note = review.Note,
                RerunReportId = review.RerunReportId,
                CreatedAt = review.CreatedAt,
                UpdatedAt = review.UpdatedAt
            };
        }

        private static string? GetFlagReason(ProjectReport? report)
        {
            if (report == null)
            {
                return "NO_ANALYSIS";
            }

            if (!string.Equals(report.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                return "INCOMPLETE_ANALYSIS";
            }

            if (report.TotalScore < 60)
            {
                return "LOW_QUALITY_SCORE";
            }

            if (!string.IsNullOrWhiteSpace(report.CriteriaJson) &&
                report.CriteriaJson.Contains("INCOMPLETE", StringComparison.OrdinalIgnoreCase))
            {
                return "INCOMPLETE_STORY";
            }

            return null;
        }
    }
}
