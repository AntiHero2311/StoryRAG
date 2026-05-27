using System.Text;
using Service.DTOs;
using Service.Implementations;
using Service.Interfaces;

namespace Service.Tests;

public class PdfExportTests
{
    [Fact]
    public async Task ExportReportPdfAsync_generates_valid_pdf_bytes_and_writes_sample_file()
    {
        var projectId = Guid.Parse("00000000-0000-4000-8000-000000000111");
        var reportId = Guid.Parse("00000000-0000-4000-8000-000000000222");
        var userId = Guid.Parse("00000000-0000-4000-8000-000000000333");

        var fakeReportService = new FakeProjectReportService(CreateSampleReport(projectId, reportId));
        var svc = new ReportExportService(fakeReportService, db: null);

        var bytes = await svc.ExportReportPdfAsync(projectId, reportId, userId);

        // PDF magic header
        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 1000);
        Assert.Equal("%PDF-", Encoding.ASCII.GetString(bytes, 0, 5));

        // Write sample output into repo for manual opening.
        var outDir = Path.Combine(AppContext.BaseDirectory, "artifacts");
        Directory.CreateDirectory(outDir);
        var outPath = Path.Combine(outDir, "sample_analysis_report.pdf");
        await File.WriteAllBytesAsync(outPath, bytes);

        Assert.True(File.Exists(outPath));
    }

    private static ProjectReportResponse CreateSampleReport(Guid projectId, Guid reportId)
    {
        return new ProjectReportResponse
        {
            Id = reportId,
            ProjectId = projectId,
            ProjectTitle = "Sample Project Title",
            Status = "Completed",
            TotalScore = 82.5m,
            Classification = "Khá",
            OverallFeedback = "Đây là phản hồi tổng quan mẫu để kiểm thử export PDF.",
            ProjectVersion = "v1.2.3",
            CreatedAt = DateTime.UtcNow,
            Warnings =
            [
                new StoryWarning
                {
                    Code = "INCOMPLETE",
                    Severity = "WARNING",
                    Title = "Truyện chưa có kết thúc",
                    Detail = "Một số tuyến truyện vẫn còn dang dở — đây là dữ liệu mẫu."
                }
            ],
            Groups =
            [
                new GroupResult
                {
                    Name = "Cốt truyện & Cấu trúc",
                    Score = 24m,
                    MaxScore = 30m,
                    Criteria =
                    [
                        new CriterionResult
                        {
                            Key = "1.1",
                            GroupName = "Cốt truyện & Cấu trúc",
                            CriterionName = "Diễn biến cốt truyện",
                            Score = 7.5m,
                            MaxScore = 10m,
                            Feedback = "Nhịp truyện ổn, có cao trào.",
                            Evidence = "Trích dẫn mẫu..."
                        },
                        new CriterionResult
                        {
                            Key = "1.2",
                            GroupName = "Cốt truyện & Cấu trúc",
                            CriterionName = "Mạch logic",
                            Score = 8m,
                            MaxScore = 10m,
                            Feedback = "Logic nhìn chung nhất quán.",
                            Evidence = "Trích dẫn mẫu..."
                        }
                    ]
                },
                new GroupResult
                {
                    Name = "Nhân vật",
                    Score = 18m,
                    MaxScore = 20m,
                    Criteria =
                    [
                        new CriterionResult
                        {
                            Key = "2.1",
                            GroupName = "Nhân vật",
                            CriterionName = "Tính cách",
                            Score = 9m,
                            MaxScore = 10m,
                            Feedback = "Nhân vật có động cơ rõ.",
                            Evidence = "Trích dẫn mẫu..."
                        }
                    ]
                }
            ]
        };
    }

    private sealed class FakeProjectReportService : IProjectReportService
    {
        private readonly ProjectReportResponse _report;

        public FakeProjectReportService(ProjectReportResponse report)
        {
            _report = report;
        }

        public Task<ProjectReportResponse> AnalyzeAsync(Guid projectId, Guid userId, Func<int, string?, CancellationToken, Task>? progressCallback = null, CancellationToken cancellationToken = default, Guid? analysisJobId = null)
            => throw new NotImplementedException();

        public Task<ProjectReportResponse?> GetLatestAsync(Guid projectId, Guid userId)
            => throw new NotImplementedException();

        public Task<List<ProjectReportSummary>> GetAllAsync(Guid projectId, Guid userId)
            => throw new NotImplementedException();

        public Task<ProjectReportResponse?> GetByIdAsync(Guid reportId, Guid projectId, Guid userId)
        {
            if (reportId != _report.Id || projectId != _report.ProjectId)
                return Task.FromResult<ProjectReportResponse?>(null);
            return Task.FromResult<ProjectReportResponse?>(_report);
        }

        public Task<List<EvidenceChunkItemDto>> GetProjectEvidenceChunksAsync(Guid projectId, Guid userId, string? ids, string? ordinals, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<List<ProjectReportSnapshotItem>> GetReportSnapshotsAsync(Guid reportId, Guid projectId, Guid userId, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();
    }
}

