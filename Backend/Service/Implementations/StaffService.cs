using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Repository.Data;
using Repository.Entities;
using Service.DTOs;
using Service.Helpers;
using Service.Interfaces;
using System.Net;
using System.Text.RegularExpressions;

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

        public async Task<StaffPagedResponse<StaffFeedbackResponse>> GetFeedbacksAsync(Guid? projectId, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.StaffFeedbacks
                .AsNoTracking()
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .Include(x => x.Project)
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

            // Load genres for all unique staff in this batch
            var staffIds = entities.Select(e => e.StaffId).Distinct().ToList();
            var genreMap = staffIds.Count > 0
                ? await _db.StaffGenres
                    .AsNoTracking()
                    .Where(sg => staffIds.Contains(sg.StaffId))
                    .Include(sg => sg.Genre)
                    .GroupBy(sg => sg.StaffId)
                    .ToDictionaryAsync(
                        g => g.Key,
                        g => g.OrderBy(sg => sg.Genre.Name)
                              .Select(sg => new GenreResponse
                              {
                                  Id = sg.Genre.Id,
                                  Name = sg.Genre.Name,
                                  Slug = sg.Genre.Slug,
                                  Color = sg.Genre.Color,
                                  Description = sg.Genre.Description
                              }).ToList())
                : new Dictionary<Guid, List<GenreResponse>>();

            var items = entities.Select(e => MapFeedback(e, genreMap)).ToList();

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
                .Include(x => x.Project)
                .FirstAsync(x => x.Id == feedback.Id);

            return MapFeedback(feedback);
        }

        public async Task<StaffFeedbackResponse> CreateFeedbackAsync(Guid staffId, StaffFeedbackRequest request)
        {
            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted)
                ?? throw new KeyNotFoundException("Không tìm thấy dự án.");

            if (request.ProjectReportId.HasValue)
            {
                var reportExists = await _db.ProjectReports.AnyAsync(r =>
                    r.Id == request.ProjectReportId.Value &&
                    r.ProjectId == request.ProjectId);
                if (!reportExists)
                {
                    throw new KeyNotFoundException("Report không thuộc dự án hoặc không tồn tại.");
                }
            }

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
                ProjectReportId = request.ProjectReportId,
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
                .Include(x => x.Project)
                .FirstAsync(x => x.Id == feedback.Id);

            return MapFeedback(feedback);
        }

        public async Task<StaffFeedbackResponse> UpdateFeedbackAsync(Guid feedbackId, Guid staffId, StaffFeedbackRequest request)
        {
            var feedback = await _db.StaffFeedbacks
                .Include(x => x.Author)
                .Include(x => x.Staff)
                .Include(x => x.Project)
                .FirstOrDefaultAsync(x => x.Id == feedbackId)
                ?? throw new KeyNotFoundException("Không tìm thấy feedback.");

            feedback.StaffId = staffId;
            if (request.ProjectReportId.HasValue)
                feedback.ProjectReportId = request.ProjectReportId;
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

        /// <summary>Lấy review theo ProjectReportId (khác với GetAnalysisReviewsAsync filter theo ProjectId).</summary>
        public async Task<StaffAnalysisReviewResponse?> GetAnalysisReviewByReportIdAsync(Guid reportId)
        {
            var entity = await _db.StaffAnalysisReviews
                .AsNoTracking()
                .Where(x => x.ProjectReportId == reportId)
                .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                .FirstOrDefaultAsync();

            return entity == null ? null : MapReview(entity);
        }


        public async Task<StaffPagedResponse<StaffPendingReportItem>> GetPendingReportsAsync(int page, int pageSize, string? status = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.ProjectReports
                .AsNoTracking()
                .Include(r => r.Project)
                    .ThenInclude(p => p.Author)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                // No filter, show all reports
            }
            else if (!string.IsNullOrWhiteSpace(status) && status.Equals("Released", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.ReviewStatus == ProjectReportService.ReviewStatusReleased);
            }
            else
            {
                var pendingStatuses = new[]
                {
                    ProjectReportService.ReviewStatusPendingStaff,
                    ProjectReportService.ReviewStatusStaffReviewing
                };
                query = query.Where(r =>
                    string.IsNullOrWhiteSpace(r.ReviewStatus) ||
                    pendingStatuses.Contains(r.ReviewStatus));
            }

            query = query.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt);

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
                    ReviewStatus = string.IsNullOrWhiteSpace(report.ReviewStatus)
                        ? ProjectReportService.ReviewStatusPendingStaff
                        : report.ReviewStatus!,
                    CreatedAt = report.CreatedAt,
                    UpdatedAt = report.UpdatedAt,
                    Warnings = ExtractWarningCodes(report.CriteriaJson, report.StaffEditedCriteriaJson),
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
                    ProjectTitle = j.Project.Title,
                    RequestedBy = j.UserId,
                    RequestedByName = !string.IsNullOrEmpty(j.User.FullName) ? j.User.FullName : j.User.Email,
                    j.Status,
                    j.ErrorMessage,
                    j.StartedAt,
                    j.UpdatedAt,
                    j.CreatedAt
                })
                .AsQueryable();

            if (statuses.Contains("all"))
            {
                // no filter
            }
            else
            {
                var wantFailed = statuses.Contains("failed");
                var wantStale = statuses.Contains("stale");
                var wantQueued = statuses.Contains("queued");
                var wantProcessing = statuses.Contains("processing");
                var wantCompleted = statuses.Contains("completed");
                var wantCancelled = statuses.Contains("cancelled");

                query = query.Where(x =>
                    (wantFailed && x.Status == "Failed") ||
                    (wantQueued && x.Status == "Queued") ||
                    (wantProcessing && x.Status == "Processing" && (x.UpdatedAt ?? x.StartedAt ?? x.CreatedAt) >= staleBefore) ||
                    (wantStale && x.Status == "Processing" && (x.UpdatedAt ?? x.StartedAt ?? x.CreatedAt) < staleBefore) ||
                    (wantCompleted && x.Status == "Completed") ||
                    (wantCancelled && x.Status == "Cancelled")
                );
            }

            var items = await query
                .OrderByDescending(x => x.UpdatedAt ?? x.StartedAt ?? x.CreatedAt)
                .Take(200)
                .ToListAsync();

            return items.Select(x => new StaffAnalysisJobItem
            {
                Id = x.Id,
                ProjectId = x.ProjectId,
                ProjectTitle = x.ProjectTitle,
                RequestedBy = x.RequestedBy,
                RequestedByName = x.RequestedByName,
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
                .Include(j => j.Project)
                .Include(j => j.User)
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
                ProjectTitle = oldJob.Project?.Title ?? string.Empty,
                RequestedBy = newJob.UserId,
                RequestedByName = oldJob.User != null ? (!string.IsNullOrEmpty(oldJob.User.FullName) ? oldJob.User.FullName : oldJob.User.Email) : string.Empty,
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
            ContentAnalysisResult? contentRes = null;
            if (!string.IsNullOrWhiteSpace(report.Project?.Author?.DataEncryptionKey))
            {
                var authorDek = EncryptionHelper.DecryptWithMasterKey(report.Project.Author.DataEncryptionKey, masterKey);
                projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, authorDek);

                if (!string.IsNullOrWhiteSpace(report.ContentAnalysisJson))
                {
                    var decData = EncryptionHelper.DecryptWithMasterKey(report.ContentAnalysisJson, authorDek);
                    var jsonOpts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    try { contentRes = System.Text.Json.JsonSerializer.Deserialize<ContentAnalysisResult>(decData, jsonOpts); } catch { }
                }
            }
            else if (report.Project != null)
            {
                projectTitle = report.Project.Title;
            }

            return MapReportDetail(report, projectTitle, contentRes);
        }

        public async Task<StaffReportStoryResponse> GetReportStoryAsync(Guid reportId)
        {
            var report = await _db.ProjectReports
                .AsNoTracking()
                .Include(r => r.Project)
                    .ThenInclude(p => p.Author)
                .FirstOrDefaultAsync(r => r.Id == reportId)
                ?? throw new KeyNotFoundException("Không tìm thấy báo cáo phân tích.");

            var masterKey = _config["Security:MasterKey"] ?? throw new InvalidOperationException("Thiếu cấu hình Security:MasterKey.");
            var projectTitle = report.Project?.Title ?? string.Empty;
            string? authorDek = null;

            if (!string.IsNullOrWhiteSpace(report.Project?.Author?.DataEncryptionKey))
            {
                authorDek = EncryptionHelper.DecryptWithMasterKey(report.Project.Author.DataEncryptionKey, masterKey);
                projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, authorDek);
            }

            var chapters = await _db.Chapters
                .AsNoTracking()
                .Include(c => c.CurrentVersion)
                .Where(c => c.ProjectId == report.ProjectId && !c.IsDeleted)
                .OrderBy(c => c.ChapterNumber)
                .ToListAsync();

            var chapterItems = chapters.Select(c =>
            {
                var title = string.IsNullOrWhiteSpace(c.Title) ? $"Chương {c.ChapterNumber}" : c.Title!;
                var plain = string.Empty;
                if (c.CurrentVersion != null && !string.IsNullOrWhiteSpace(c.CurrentVersion.Content))
                {
                    var html = authorDek == null
                        ? c.CurrentVersion.Content
                        : EncryptionHelper.DecryptWithMasterKey(c.CurrentVersion.Content, authorDek);
                    plain = HtmlToPlainText(html);
                }

                return new StaffStoryChapterItem
                {
                    ChapterId = c.Id,
                    ChapterNumber = c.ChapterNumber,
                    Title = title,
                    Content = plain,
                    WordCount = c.WordCount,
                    UpdatedAt = c.UpdatedAt,
                };
            }).ToList();

            return new StaffReportStoryResponse
            {
                ReportId = report.Id,
                ProjectId = report.ProjectId,
                ProjectTitle = projectTitle,
                Chapters = chapterItems,
            };
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

            if (string.Equals(report.ReviewStatus, ProjectReportService.ReviewStatusReleased, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Báo cáo đã được phát hành cho tác giả. Staff không có quyền sửa tiếp.");
            }

            var currentVersion = report.UpdatedAt ?? report.CreatedAt;
            if (request.ExpectedUpdatedAt.HasValue)
            {
                var expected = DateTime.SpecifyKind(request.ExpectedUpdatedAt.Value, DateTimeKind.Utc);
                var actual = DateTime.SpecifyKind(currentVersion, DateTimeKind.Utc);
                
                // Tránh lỗi timezone: Kiểm tra dung sai 15 giây dưới dạng UTC trực tiếp hoặc sau khi gọi ToUniversalTime()
                var diffSecondsDirect = Math.Abs((expected - actual).TotalSeconds);
                var diffSecondsConverted = Math.Abs((request.ExpectedUpdatedAt.Value.ToUniversalTime() - actual).TotalSeconds);
                
                if (diffSecondsDirect > 15 && diffSecondsConverted > 15)
                {
                    throw new InvalidOperationException(
                        "Report đã được staff khác cập nhật trước đó. Vui lòng tải lại dữ liệu mới nhất trước khi lưu.");
                }
            }

            // Parse AI CriteriaJson gốc
            var sourceCriteriaJson = report.StaffEditedCriteriaJson ?? report.CriteriaJson;
            if (string.IsNullOrWhiteSpace(sourceCriteriaJson))
                throw new InvalidOperationException("Report chưa có dữ liệu phân tích (CriteriaJson trống).");

            List<System.Text.Json.Nodes.JsonObject>? criteriaList = null;
            System.Text.Json.Nodes.JsonArray? originalWarnings = null;
            string originalOverallFeedback = string.Empty;

            try
            {
                var parsedNode = System.Text.Json.Nodes.JsonNode.Parse(sourceCriteriaJson);
                if (parsedNode is System.Text.Json.Nodes.JsonArray arr)
                {
                    criteriaList = arr.OfType<System.Text.Json.Nodes.JsonObject>().ToList();
                }
                else if (parsedNode is System.Text.Json.Nodes.JsonObject obj)
                {
                    var criteriaNode = obj["Criteria"] ?? obj["criteria"];
                    if (criteriaNode is System.Text.Json.Nodes.JsonArray criteriaArr)
                    {
                        criteriaList = criteriaArr.OfType<System.Text.Json.Nodes.JsonObject>().ToList();
                    }
                    
                    var warningsNode = obj["Warnings"] ?? obj["warnings"];
                    if (warningsNode is System.Text.Json.Nodes.JsonArray warningsArr)
                    {
                        originalWarnings = warningsArr;
                    }
                    
                    var overallFeedbackNode = obj["OverallFeedback"] ?? obj["overallFeedback"];
                    if (overallFeedbackNode != null)
                    {
                        originalOverallFeedback = overallFeedbackNode.GetValue<string>() ?? string.Empty;
                    }
                }
            }
            catch
            {
                throw new InvalidOperationException("CriteriaJson của report không hợp lệ, không thể chỉnh sửa.");
            }

            if (criteriaList == null)
                throw new InvalidOperationException("CriteriaJson rỗng hoặc không tìm thấy mảng criteria.");

            // Áp dụng các chỉnh sửa của staff
            foreach (var edit in request.EditedCriteria)
            {
                var target = criteriaList.FirstOrDefault(c =>
                    c["key"]?.GetValue<string>() == edit.Key ||
                    c["Key"]?.GetValue<string>() == edit.Key);

                if (target == null) continue;

                if (edit.Feedback != null)
                {
                    if (target["feedback"] != null) target["feedback"] = edit.Feedback;
                    else if (target["Feedback"] != null) target["Feedback"] = edit.Feedback;
                    else target["feedback"] = edit.Feedback;
                }
                if (edit.Evidence != null)
                {
                    if (target["evidence"] != null) target["evidence"] = edit.Evidence;
                    else if (target["Evidence"] != null) target["Evidence"] = edit.Evidence;
                    else target["evidence"] = edit.Evidence;
                }
                if (edit.Errors != null)
                {
                    var newArr = new System.Text.Json.Nodes.JsonArray(
                        edit.Errors.Select(e => (System.Text.Json.Nodes.JsonNode)System.Text.Json.Nodes.JsonValue.Create(e)!).ToArray());
                    if (target["errors"] != null) target["errors"] = newArr;
                    else if (target["Errors"] != null) target["Errors"] = newArr;
                    else target["errors"] = newArr;
                }
                if (edit.Suggestions != null)
                {
                    var newArr = new System.Text.Json.Nodes.JsonArray(
                        edit.Suggestions.Select(s => (System.Text.Json.Nodes.JsonNode)System.Text.Json.Nodes.JsonValue.Create(s)!).ToArray());
                    if (target["suggestions"] != null) target["suggestions"] = newArr;
                    else if (target["Suggestions"] != null) target["Suggestions"] = newArr;
                    else target["suggestions"] = newArr;
                }
            }

            var finalObj = new System.Text.Json.Nodes.JsonObject();
            var criteriaJsonArray = new System.Text.Json.Nodes.JsonArray(
                criteriaList.Select(c => c.DeepClone()).Cast<System.Text.Json.Nodes.JsonNode?>().ToArray()
            );
            finalObj["Criteria"] = criteriaJsonArray;
            finalObj["Warnings"] = originalWarnings?.DeepClone() ?? new System.Text.Json.Nodes.JsonArray();
            finalObj["OverallFeedback"] = originalOverallFeedback;

            var editedJson = finalObj.ToJsonString();

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
                    ProjectReportId = report.Id,
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
            ContentAnalysisResult? contentRes = null;
            if (!string.IsNullOrWhiteSpace(report.Project?.Author?.DataEncryptionKey))
            {
                var authorDek = EncryptionHelper.DecryptWithMasterKey(report.Project.Author.DataEncryptionKey, masterKey);
                projectTitle = EncryptionHelper.DecryptWithMasterKey(report.Project.Title, authorDek);

                if (!string.IsNullOrWhiteSpace(report.ContentAnalysisJson))
                {
                    var decData = EncryptionHelper.DecryptWithMasterKey(report.ContentAnalysisJson, authorDek);
                    var jsonOpts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    try { contentRes = System.Text.Json.JsonSerializer.Deserialize<ContentAnalysisResult>(decData, jsonOpts); } catch { }
                }
            }
            else if (report.Project != null)
            {
                projectTitle = report.Project.Title;
            }

            return MapReportDetail(report, projectTitle, contentRes);
        }

        private static HashSet<string> ParseStatuses(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
                return new HashSet<string>(new[] { "failed", "stale" }, StringComparer.OrdinalIgnoreCase);

            return status
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => s.Trim().ToLowerInvariant())
                .Where(s => s is "failed" or "stale" or "queued" or "processing" or "completed" or "cancelled" or "all")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private static string HtmlToPlainText(string html)
        {
            if (string.IsNullOrWhiteSpace(html))
                return string.Empty;

            var text = html;
            text = Regex.Replace(text, @"(?is)<\s*br\s*/?\s*>", "\n");
            text = Regex.Replace(text, @"(?is)</\s*(p|div|h[1-6]|li|tr|section|article)\s*>", "\n");
            text = Regex.Replace(text, @"(?is)<\s*li[^>]*>", "- ");
            text = Regex.Replace(text, @"(?is)<[^>]+>", string.Empty);
            text = WebUtility.HtmlDecode(text).Replace('\u00A0', ' ');
            text = Regex.Replace(text, @"\r\n|\r", "\n");
            text = Regex.Replace(text, @"\n{3,}", "\n\n");
            return text.Trim();
        }

        private static StaffFeedbackResponse MapFeedback(
            StaffFeedback feedback,
            Dictionary<Guid, List<GenreResponse>>? genreMap = null)
        {
            var genres = genreMap != null && genreMap.TryGetValue(feedback.StaffId, out var g) ? g : new List<GenreResponse>();
            return new StaffFeedbackResponse
            {
                Id = feedback.Id,
                ProjectId = feedback.ProjectId,
                ProjectTitle = feedback.Project?.Title ?? string.Empty,
                ProjectReportId = feedback.ProjectReportId,
                ChapterId = feedback.ChapterId,
                AuthorId = feedback.AuthorId,
                AuthorName = feedback.Author?.FullName ?? string.Empty,
                StaffId = feedback.StaffId,
                StaffName = feedback.Staff?.FullName ?? string.Empty,
                Content = feedback.Content,
                Status = feedback.Status,
                StaffNote = feedback.StaffNote,
                UserReaction = feedback.UserReaction,
                UserFeedback = feedback.UserFeedback,
                UserRespondedAt = feedback.UserRespondedAt,
                CreatedAt = feedback.CreatedAt,
                UpdatedAt = feedback.UpdatedAt,
                ReadAt = feedback.ReadAt,
                StaffGenres = genres,
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

        private static StaffReportDetailResponse MapReportDetail(ProjectReport report, string projectTitle, ContentAnalysisResult? contentAnalysis = null)
        {
            // Phân loại điểm số
            var classification = report.TotalScore >= 85 ? "Xuất sắc"
                : report.TotalScore >= 70 ? "Khá"
                : report.TotalScore >= 55 ? "Trung bình"
                : "Cần sửa lớn";

            // Trích overallFeedback từ StaffEditedCriteriaJson hoặc CriteriaJson nếu có
            var overallFeedback = string.Empty;
            try
            {
                var sourceJson = report.StaffEditedCriteriaJson ?? report.CriteriaJson;
                if (!string.IsNullOrWhiteSpace(sourceJson))
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(sourceJson);
                    if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                    {
                        if (doc.RootElement.TryGetProperty("OverallFeedback", out var ofProp1))
                        {
                            overallFeedback = ofProp1.GetString() ?? string.Empty;
                        }
                        else if (doc.RootElement.TryGetProperty("overallFeedback", out var ofProp2))
                        {
                            overallFeedback = ofProp2.GetString() ?? string.Empty;
                        }
                    }
                }
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
                ContentAnalysis = contentAnalysis,
                AuthorId = report.Project?.AuthorId ?? Guid.Empty,
                AuthorName = report.Project?.Author?.FullName ?? string.Empty,
                AuthorStrikeCount = report.Project?.Author?.StrikeCount ?? 0,
                AuthorIsBanned = report.Project?.Author?.IsBanned ?? false,
                AuthorIsBanRequested = report.Project?.Author?.IsBanRequested ?? false,
                AuthorBanRequestReason = report.Project?.Author?.BanRequestReason,
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

            // Kiểm tra tất cả cờ AI trong CriteriaJson (theo thứ tự ưu tiên nghiêm trọng nhất trước)
            if (!string.IsNullOrWhiteSpace(report.CriteriaJson))
            {
                // ANTI_STATE — nghiêm trọng nhất về pháp lý, ưu tiên cao nhất
                if (report.CriteriaJson.Contains("ANTI_STATE", StringComparison.OrdinalIgnoreCase))
                    return "ANTI_STATE";

                // SEXUAL_CONTENT — vi phạm chính sách nội dung, ưu tiên thứ hai
                if (report.CriteriaJson.Contains("SEXUAL_CONTENT", StringComparison.OrdinalIgnoreCase))
                    return "SEXUAL_CONTENT";

                // PLAGIARISM_RISK — vi phạm bản quyền
                if (report.CriteriaJson.Contains("PLAGIARISM_RISK", StringComparison.OrdinalIgnoreCase))
                    return "PLAGIARISM_RISK";

                // INCOMPLETE — truyện chưa kết thúc
                if (report.CriteriaJson.Contains("\"INCOMPLETE\"", StringComparison.OrdinalIgnoreCase))
                    return "INCOMPLETE_STORY";

                // INCONSISTENCY — mâu thuẫn logic trong truyện
                if (report.CriteriaJson.Contains("INCONSISTENCY", StringComparison.OrdinalIgnoreCase))
                    return "INCONSISTENCY_DETECTED";
            }

            return null;
        }

        private static List<string> ExtractWarningCodes(string? criteriaJson, string? staffEditedCriteriaJson)
        {
            var codes = new List<string>();
            var source = staffEditedCriteriaJson ?? criteriaJson;
            if (string.IsNullOrWhiteSpace(source)) return codes;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(source);
                if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    if (doc.RootElement.TryGetProperty("Warnings", out var warningsProp) ||
                        doc.RootElement.TryGetProperty("warnings", out warningsProp))
                    {
                        if (warningsProp.ValueKind == System.Text.Json.JsonValueKind.Array)
                        {
                            foreach (var item in warningsProp.EnumerateArray())
                            {
                                if (item.TryGetProperty("Code", out var codeProp) ||
                                    item.TryGetProperty("code", out codeProp))
                                {
                                    var code = codeProp.GetString();
                                    if (!string.IsNullOrEmpty(code))
                                    {
                                        codes.Add(code);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch { }
            return codes;
        }
    }
}
