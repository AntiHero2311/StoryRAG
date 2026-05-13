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
        private readonly IAnalysisJobQueue _analysisJobQueue;

        public StaffService(
            AppDbContext db,
            IConfiguration config,
            IProjectReportService projectReportService,
            IAnalysisJobQueue analysisJobQueue)
        {
            _db = db;
            _config = config;
            _projectReportService = projectReportService;
            _analysisJobQueue = analysisJobQueue;
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

        public async Task<StaffPagedResponse<FlaggedProjectItem>> GetFlaggedProjectsAsync(int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var baseQuery =
                from f in _db.ProjectAbuseFlags.AsNoTracking()
                join p in _db.Projects.AsNoTracking() on f.ProjectId equals p.Id
                where !p.IsDeleted
                join u in _db.Users.AsNoTracking() on p.AuthorId equals u.Id
                orderby f.FlaggedAt descending
                select new FlaggedProjectItem
                {
                    ProjectId = f.ProjectId,
                    AuthorEmail = u.Email,
                    FlagReason = f.FlagReason,
                    FlaggedAt = f.FlaggedAt,
                    Severity = f.Severity,
                };

            var total = await baseQuery.CountAsync();
            var items = await baseQuery
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new StaffPagedResponse<FlaggedProjectItem>
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

        public async Task<StaffFeedbackResponse> CreateFeedbackAsync(Guid staffId, StaffFeedbackCreateRequest request)
        {
            var projectId = (request.ProjectIdSnake is Guid snake && snake != Guid.Empty)
                ? snake
                : request.ProjectId;
            var message = !string.IsNullOrWhiteSpace(request.Message)
                ? request.Message.Trim()
                : (request.Content?.Trim() ?? string.Empty);

            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted)
                ?? throw new KeyNotFoundException("Không tìm thấy dự án.");

            var feedback = new StaffFeedback
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                ChapterId = null,
                AuthorId = project.AuthorId,
                StaffId = staffId,
                Content = message,
                Status = "Open",
                StaffNote = null,
                CreatedAt = DateTime.UtcNow,
                ReadAt = null,
            };

            _db.StaffFeedbacks.Add(feedback);
            await _db.SaveChangesAsync();

            feedback = await _db.StaffFeedbacks
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .FirstAsync(x => x.Id == feedback.Id);

            return MapFeedback(feedback);
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
                CreatedAt = DateTime.UtcNow,
                ReadAt = null,
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

        public async Task<StaffPagedResponse<StaffPendingReportItem>> GetPendingReportsAsync(int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var pendingStatuses = new[]
            {
                ProjectReportService.ReviewStatusPendingStaff,
                ProjectReportService.ReviewStatusStaffReviewing
            };

            var query = _db.ProjectReports
                .AsNoTracking()
                .Include(r => r.Project)
                    .ThenInclude(p => p.Author)
                .Where(r => pendingStatuses.Contains(r.ReviewStatus ?? string.Empty))
                .OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt);

            var total = await query.CountAsync();
            var reports = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Thiếu cấu hình Security:MasterKey.");
            var items = reports.Select(report =>
            {
                var projectTitle = "[Encrypted Title]";
                if (!string.IsNullOrWhiteSpace(report.Project?.Author?.DataEncryptionKey))
                {
                    var authorDek = EncryptionHelper.DecryptWithMasterKey(report.Project.Author.DataEncryptionKey, masterKey);
                    projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, authorDek);
                }
                else if (report.Project != null)
                {
                    projectTitle = report.Project.Title;
                }

                return new StaffPendingReportItem
                {
                    ReportId = report.Id,
                    ProjectId = report.ProjectId,
                    ProjectTitle = projectTitle,
                    AuthorId = report.UserId,
                    AuthorName = report.Project?.Author?.FullName ?? string.Empty,
                    TotalScore = report.TotalScore,
                    ReviewStatus = report.ReviewStatus ?? ProjectReportService.ReviewStatusPendingStaff,
                    CreatedAt = report.CreatedAt,
                    UpdatedAt = report.UpdatedAt,
                };
            }).ToList();

            return new StaffPagedResponse<StaffPendingReportItem>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize,
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

            if (request.Action == "Verified")
                report.ReviewStatus = ProjectReportService.ReviewStatusReleased;
            else if (request.Action == "Adjusted")
                report.ReviewStatus = ProjectReportService.ReviewStatusStaffReviewing;
            else if (request.Action == "RerunRequested")
                report.ReviewStatus = ProjectReportService.ReviewStatusPendingStaff;

            report.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return MapReview(review);
        }

        public async Task<IReadOnlyList<StaffAnalysisJobItem>> GetAnalysisJobsAsync(string? status)
        {
            var statuses = ParseStatuses(status);
            var now = DateTime.UtcNow;
            var staleBefore = now.AddMinutes(-15);

            var query = _db.ProjectAnalysisJobs
                .AsNoTracking()
                .Select(j => new
                {
                    j.Id,
                    j.ProjectId,
                    RequestedBy = j.UserId,
                    j.Status,
                    j.ErrorMessage,
                    j.StartedAt,
                    j.UpdatedAt,
                    j.CreatedAt
                })
                .AsQueryable();

            if (statuses.Contains("failed"))
            {
                // keep in query; additional filters below
            }

            var wantFailed = statuses.Contains("failed");
            var wantStale = statuses.Contains("stale");

            if (wantFailed && !wantStale)
            {
                query = query.Where(x => x.Status == "Failed");
            }
            else if (!wantFailed && wantStale)
            {
                query = query.Where(x => x.Status == "Processing" && (x.UpdatedAt ?? x.StartedAt ?? x.CreatedAt) < staleBefore);
            }
            else
            {
                // default or both
                query = query.Where(x =>
                    x.Status == "Failed" ||
                    (x.Status == "Processing" && (x.UpdatedAt ?? x.StartedAt ?? x.CreatedAt) < staleBefore));
            }

            var items = await query
                .OrderByDescending(x => x.UpdatedAt ?? x.StartedAt ?? x.CreatedAt)
                .Take(200)
                .ToListAsync();

            return items.Select(x => new StaffAnalysisJobItem
            {
                Id = x.Id,
                ProjectId = x.ProjectId,
                RequestedBy = x.RequestedBy,
                Status = x.Status,
                ErrorMessage = x.ErrorMessage,
                StartedAt = x.StartedAt,
                LastHeartbeat = x.UpdatedAt ?? x.StartedAt ?? x.CreatedAt
            }).ToList();
        }

        public async Task<StaffAnalysisJobItem> RerunAnalysisJobAsync(Guid jobId, Guid staffId)
        {
            var oldJob = await _db.ProjectAnalysisJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j => j.Id == jobId)
                ?? throw new KeyNotFoundException("Không tìm thấy job phân tích.");

            var activeSub = await _db.UserSubscriptions
                .AsNoTracking()
                .Include(s => s.Plan)
                .Where(s => s.UserId == oldJob.UserId && s.Status == "Active" && s.EndDate >= DateTime.UtcNow)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync();
            var priority = AnalysisJobPriorityHelper.CalculatePriority(activeSub);

            // Create new queued job referencing the old one.
            var now = DateTime.UtcNow;
            var newJob = new ProjectAnalysisJob
            {
                Id = Guid.NewGuid(),
                ProjectId = oldJob.ProjectId,
                UserId = oldJob.UserId,
                Status = "Queued",
                Stage = "Queued",
                Progress = 0,
                ProjectVersionHash = oldJob.ProjectVersionHash ?? string.Empty,
                RetriedFromId = oldJob.Id,
                CreatedAt = now,
                UpdatedAt = now,
                ErrorMessage = null,
                StartedAt = null,
                CompletedAt = null,
                ReportId = null,
            };

            _db.ProjectAnalysisJobs.Add(newJob);
            _db.AnalysisJobRerunAudits.Add(new AnalysisJobRerunAudit
            {
                Id = Guid.NewGuid(),
                OldJobId = oldJob.Id,
                NewJobId = newJob.Id,
                StaffId = staffId,
                CreatedAt = now,
            });

            await _db.SaveChangesAsync();

            // Queue for immediate processing.
            await _analysisJobQueue.EnqueueAsync(newJob.Id, priority, CancellationToken.None);

            return new StaffAnalysisJobItem
            {
                Id = newJob.Id,
                ProjectId = newJob.ProjectId,
                RequestedBy = newJob.UserId,
                Status = newJob.Status,
                ErrorMessage = newJob.ErrorMessage,
                StartedAt = newJob.StartedAt,
                LastHeartbeat = newJob.UpdatedAt ?? newJob.CreatedAt
            };
        }

        public async Task<StaffReportDetailResponse> GetReportDetailAsync(Guid reportId)
        {
            var report = await _db.ProjectReports
                .AsNoTracking()
                .Include(r => r.Project)
                    .ThenInclude(p => p.Author)
                .FirstOrDefaultAsync(r => r.Id == reportId)
                ?? throw new KeyNotFoundException("Không tìm thấy báo cáo phân tích.");

            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Thiếu cấu hình Security:MasterKey.");

            var projectTitle = "[Encrypted Title]";
            if (!string.IsNullOrWhiteSpace(report.Project?.Author?.DataEncryptionKey))
            {
                var authorDek = EncryptionHelper.DecryptWithMasterKey(report.Project.Author.DataEncryptionKey, masterKey);
                projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, authorDek);
            }
            else if (report.Project != null)
            {
                projectTitle = report.Project.Title;
            }

            return MapReportDetail(report, projectTitle);
        }

        public async Task<StaffReportDetailResponse> EditReportAsync(Guid reportId, Guid staffId, StaffEditReportRequest request)
        {
            var report = await _db.ProjectReports
                .Include(r => r.Project)
                    .ThenInclude(p => p.Author)
                .FirstOrDefaultAsync(r => r.Id == reportId)
                ?? throw new KeyNotFoundException("Không tìm thấy báo cáo phân tích.");

            if (string.Equals(report.Status, "Pending", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(report.Status, "Failed", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Chỉ có thể chỉnh sửa report đã hoàn tất (Completed/MockData).");
            }

            var currentVersion = report.UpdatedAt ?? report.CreatedAt;
            if (request.ExpectedUpdatedAt.HasValue)
            {
                var expected = request.ExpectedUpdatedAt.Value.ToUniversalTime();
                var actual = currentVersion.ToUniversalTime();
                if (expected != actual)
                {
                    throw new InvalidOperationException(
                        "Report đã được staff khác cập nhật trước đó. Vui lòng tải lại dữ liệu mới nhất trước khi lưu.");
                }
            }

            // Parse AI CriteriaJson gốc
            var sourceCriteriaJson = report.StaffEditedCriteriaJson ?? report.CriteriaJson;
            List<System.Text.Json.Nodes.JsonObject>? criteriaList = null;

            try
            {
                var arr = System.Text.Json.Nodes.JsonNode.Parse(sourceCriteriaJson) as System.Text.Json.Nodes.JsonArray;
                criteriaList = arr?
                    .OfType<System.Text.Json.Nodes.JsonObject>()
                    .ToList();
            }
            catch
            {
                throw new InvalidOperationException("CriteriaJson của report không hợp lệ, không thể chỉnh sửa.");
            }

            if (criteriaList == null)
                throw new InvalidOperationException("CriteriaJson rỗng hoặc không phải mảng JSON.");

            // Áp dụng các chỉnh sửa của staff
            foreach (var edit in request.EditedCriteria)
            {
                var target = criteriaList.FirstOrDefault(c =>
                    c["key"]?.GetValue<string>() == edit.Key ||
                    c["Key"]?.GetValue<string>() == edit.Key);

                if (target == null) continue;

                if (edit.Feedback != null)
                    target["feedback"] = edit.Feedback;
                if (edit.Evidence != null)
                    target["evidence"] = edit.Evidence;
                if (edit.Errors != null)
                    target["errors"] = new System.Text.Json.Nodes.JsonArray(
                        edit.Errors.Select(e => (System.Text.Json.Nodes.JsonNode)System.Text.Json.Nodes.JsonValue.Create(e)!).ToArray());
                if (edit.Suggestions != null)
                    target["suggestions"] = new System.Text.Json.Nodes.JsonArray(
                        edit.Suggestions.Select(s => (System.Text.Json.Nodes.JsonNode)System.Text.Json.Nodes.JsonValue.Create(s)!).ToArray());
            }

            var editedJson = new System.Text.Json.Nodes.JsonArray(
                criteriaList.Cast<System.Text.Json.Nodes.JsonNode?>().ToArray()
            ).ToJsonString();

            report.StaffEditedCriteriaJson = editedJson;
            report.ReviewStatus = request.ReleaseToUser
                ? ProjectReportService.ReviewStatusReleased
                : ProjectReportService.ReviewStatusStaffReviewing;
            report.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(request.FeedbackMessage))
            {
                var feedback = new StaffFeedback
                {
                    Id = Guid.NewGuid(),
                    ProjectId = report.ProjectId,
                    ChapterId = null,
                    AuthorId = report.Project.AuthorId,
                    StaffId = staffId,
                    Content = request.FeedbackMessage.Trim(),
                    Status = "Open",
                    StaffNote = "Tạo tự động từ review report phân tích.",
                    CreatedAt = DateTime.UtcNow,
                    ReadAt = null,
                };
                _db.StaffFeedbacks.Add(feedback);
            }

            await _db.SaveChangesAsync();

            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Thiếu cấu hình Security:MasterKey.");
            var projectTitle = "[Encrypted Title]";
            if (!string.IsNullOrWhiteSpace(report.Project?.Author?.DataEncryptionKey))
            {
                var authorDek = EncryptionHelper.DecryptWithMasterKey(report.Project.Author.DataEncryptionKey, masterKey);
                projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, authorDek);
            }
            else if (report.Project != null)
            {
                projectTitle = report.Project.Title;
            }

            return MapReportDetail(report, projectTitle);
        }

        private static HashSet<string> ParseStatuses(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return new HashSet<string>(new[] { "failed", "stale" }, StringComparer.OrdinalIgnoreCase);

            return status
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => s.Trim().ToLowerInvariant())
                .Where(s => s is "failed" or "stale")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
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
                UpdatedAt = feedback.UpdatedAt,
                ReadAt = feedback.ReadAt,
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

        private static StaffReportDetailResponse MapReportDetail(ProjectReport report, string projectTitle)
        {
            // Phân loại điểm số
            var classification = report.TotalScore >= 85 ? "Xuất sắc"
                : report.TotalScore >= 70 ? "Khá"
                : report.TotalScore >= 55 ? "Trung bình"
                : "Cần sửa lớn";

            // Trích overallFeedback từ CriteriaJson nếu có
            var overallFeedback = string.Empty;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(report.CriteriaJson);
                if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object &&
                    doc.RootElement.TryGetProperty("overallFeedback", out var ofProp))
                    overallFeedback = ofProp.GetString() ?? string.Empty;
            }
            catch { /* ignore parse errors */ }

            return new StaffReportDetailResponse
            {
                Id = report.Id,
                ProjectId = report.ProjectId,
                ProjectTitle = projectTitle,
                Status = report.Status,
                ReviewStatus = report.ReviewStatus,
                TotalScore = report.TotalScore,
                Classification = classification,
                OverallFeedback = overallFeedback,
                ProjectVersion = report.ProjectVersion,
                CriteriaJson = report.CriteriaJson,
                StaffEditedCriteriaJson = report.StaffEditedCriteriaJson,
                CreatedAt = report.CreatedAt,
                UpdatedAt = report.UpdatedAt,
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
