using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Service.Interfaces;

namespace Service.Implementations
{
    public class ReportExportService : IReportExportService
    {
        private readonly IProjectReportService _projectReportService;
        private static readonly object QuestPdfLicenseLock = new();
        private static bool _questPdfLicenseConfigured;

        public ReportExportService(IProjectReportService projectReportService)
        {
            _projectReportService = projectReportService;
            EnsureQuestPdfLicenseConfigured();
        }

        public async Task<byte[]> ExportReportPdfAsync(Guid projectId, Guid reportId, Guid userId)
        {
            var report = await _projectReportService.GetByIdAsync(reportId, projectId, userId)
                ?? throw new KeyNotFoundException("Không tìm thấy báo cáo.");

            var generatedAt = report.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm");

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(28);
                    page.DefaultTextStyle(style => style.FontSize(10));

                    page.Header().Column(column =>
                    {
                        column.Spacing(4);
                        column.Item().Text("StoryRAG - Analysis Report")
                            .FontSize(20)
                            .SemiBold()
                            .FontColor(Colors.Grey.Darken3);
                        column.Item().Text(report.ProjectTitle)
                            .FontSize(14)
                            .SemiBold();
                        column.Item().Text($"Generated at: {generatedAt}")
                            .FontColor(Colors.Grey.Darken1);
                    });

                    page.Content().PaddingTop(12).Column(column =>
                    {
                        column.Spacing(10);

                        column.Item().Background(Colors.Grey.Lighten4).Padding(10).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Total score").Bold();
                                c.Item().Text($"{report.TotalScore:0.0} / 100");
                            });
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Classification").Bold();
                                c.Item().Text(report.Classification);
                            });
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Status").Bold();
                                c.Item().Text(report.Status);
                            });
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Project version").Bold();
                                c.Item().Text(report.ProjectVersion);
                            });
                        });

                        column.Item().Column(overall =>
                        {
                            overall.Spacing(5);
                            overall.Item().Text("Overall feedback").FontSize(12).SemiBold();
                            overall.Item().Text(string.IsNullOrWhiteSpace(report.OverallFeedback)
                                ? "No overall feedback available."
                                : report.OverallFeedback);
                        });

                        if (report.Warnings.Count > 0)
                        {
                            column.Item().Column(warnings =>
                            {
                                warnings.Spacing(4);
                                warnings.Item().Text("Warnings").FontSize(12).SemiBold();

                                foreach (var warning in report.Warnings)
                                {
                                    warnings.Item().Background(Colors.Orange.Lighten5).Padding(8).Column(w =>
                                    {
                                        w.Spacing(3);
                                        w.Item().Text($"{warning.Code} - {warning.Title}")
                                            .SemiBold()
                                            .FontColor(Colors.Orange.Darken2);
                                        w.Item().Text($"Severity: {warning.Severity}");
                                        w.Item().Text(warning.Detail);
                                    });
                                }
                            });
                        }

                        column.Item().Text("Rubric breakdown").FontSize(12).SemiBold();

                        foreach (var group in report.Groups)
                        {
                            column.Item().Column(groupColumn =>
                            {
                                groupColumn.Spacing(4);
                                groupColumn.Item().Text($"{group.Name} ({group.Score:0.0}/{group.MaxScore:0.0})")
                                    .SemiBold()
                                    .FontColor(Colors.Grey.Darken3);

                                groupColumn.Item().Table(table =>
                                {
                                    table.ColumnsDefinition(columns =>
                                    {
                                        columns.ConstantColumn(55);
                                        columns.RelativeColumn(2);
                                        columns.ConstantColumn(60);
                                        columns.RelativeColumn(3);
                                    });

                                    table.Header(header =>
                                    {
                                        header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Key").SemiBold();
                                        header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Criterion").SemiBold();
                                        header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Score").SemiBold();
                                        header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Feedback").SemiBold();
                                    });

                                    foreach (var criterion in group.Criteria)
                                    {
                                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(criterion.Key);
                                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(criterion.CriterionName);
                                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(4).Text($"{criterion.Score:0.0}/{criterion.MaxScore:0.0}");
                                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(criterion.Feedback);
                                    }
                                });
                            });
                        }
                    });

                    page.Footer()
                        .AlignCenter()
                        .Text("StoryRAG analysis export")
                        .FontSize(9)
                        .FontColor(Colors.Grey.Darken1);
                });
            });

            return document.GeneratePdf();
        }

        private static void EnsureQuestPdfLicenseConfigured()
        {
            if (_questPdfLicenseConfigured) return;

            lock (QuestPdfLicenseLock)
            {
                if (_questPdfLicenseConfigured) return;
                QuestPDF.Settings.License = LicenseType.Community;
                _questPdfLicenseConfigured = true;
            }
        }
    }
}
