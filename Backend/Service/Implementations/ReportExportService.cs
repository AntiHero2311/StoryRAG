using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.Interfaces;

namespace Service.Implementations
{
    public class ReportExportService : IReportExportService
    {
        private readonly IProjectReportService _projectReportService;
        private readonly AppDbContext? _db;
        private static readonly object QuestPdfLicenseLock = new();
        private static bool _questPdfLicenseConfigured;

        public ReportExportService(IProjectReportService projectReportService, AppDbContext? db = null)
        {
            _projectReportService = projectReportService;
            _db = db;
            EnsureQuestPdfLicenseConfigured();
        }

        public async Task<byte[]> ExportReportPdfAsync(Guid projectId, Guid reportId, Guid userId)
        {
            var report = await _projectReportService.GetByIdAsync(reportId, projectId, userId)
                ?? throw new KeyNotFoundException("Không tìm thấy báo cáo.");

            var authorName = await TryGetAuthorNameAsync(projectId);
            var generatedAt = report.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm");

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(28);
                    page.DefaultTextStyle(style => style.FontSize(10).FontFamily(GetPreferredFontFamily()));

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
                        column.Item().Text($"Author: {authorName}")
                            .FontColor(Colors.Grey.Darken1);
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

                        if (report.ContentAnalysis != null)
                        {
                            column.Item().PageBreak();
                            column.Item().Text("STORY BIBLE (CẨM NANG TRUYỆN)")
                                .FontSize(16)
                                .Bold()
                                .FontColor(Colors.Purple.Darken2);

                            // 1. World settings
                            if (report.ContentAnalysis.WorldSettings != null && report.ContentAnalysis.WorldSettings.Count > 0)
                            {
                                column.Item().PaddingTop(8).Text("World Settings (Bối cảnh thế giới)")
                                    .FontSize(12)
                                    .SemiBold()
                                    .FontColor(Colors.Purple.Medium);

                                foreach (var ws in report.ContentAnalysis.WorldSettings)
                                {
                                    column.Item().Background(Colors.Grey.Lighten5).Padding(8).Column(wsCol =>
                                    {
                                        wsCol.Spacing(2);
                                        wsCol.Item().Text($"{ws.Title} [{ws.Category}]").Bold();
                                        wsCol.Item().Text($"Importance: {ws.Importance} | Chapters: {string.Join(", ", ws.SourceChapters)}").Italic().FontSize(9).FontColor(Colors.Grey.Darken1);
                                        wsCol.Item().Text(ws.Description);
                                    });
                                }
                            }

                            // 2. Characters
                            if (report.ContentAnalysis.Characters != null && report.ContentAnalysis.Characters.Count > 0)
                            {
                                column.Item().PaddingTop(8).Text("Characters (Nhân vật)")
                                    .FontSize(12)
                                    .SemiBold()
                                    .FontColor(Colors.Purple.Medium);

                                foreach (var c in report.ContentAnalysis.Characters)
                                {
                                    column.Item().Background(Colors.Grey.Lighten5).Padding(8).Column(cCol =>
                                    {
                                        cCol.Spacing(2);
                                        cCol.Item().Text($"{c.Name} [{c.Role}]").Bold();
                                        cCol.Item().Text($"First Appearance: Chapter {c.FirstAppearance} | Traits: {string.Join(", ", c.Traits ?? new List<string>())}").Italic().FontSize(9).FontColor(Colors.Grey.Darken1);
                                        if (!string.IsNullOrWhiteSpace(c.Background))
                                        {
                                            cCol.Item().Text($"Background: {c.Background}");
                                        }
                                        if (c.Relationships != null && c.Relationships.Count > 0)
                                        {
                                            cCol.Item().Text("Relationships:").SemiBold().FontSize(9);
                                            foreach (var r in c.Relationships)
                                            {
                                                cCol.Item().PaddingLeft(8).Text($"• {r.TargetName} ({r.Type}): {r.Description}").FontSize(9);
                                            }
                                        }
                                    });
                                }
                            }

                            // 3. Timeline Events
                            if (report.ContentAnalysis.TimelineEvents != null && report.ContentAnalysis.TimelineEvents.Count > 0)
                            {
                                column.Item().PaddingTop(8).Text("Timeline Events (Dòng thời gian & Sự kiện)")
                                    .FontSize(12)
                                    .SemiBold()
                                    .FontColor(Colors.Purple.Medium);

                                foreach (var te in report.ContentAnalysis.TimelineEvents.OrderBy(e => e.SortOrder))
                                {
                                    column.Item().Background(Colors.Grey.Lighten5).Padding(8).Column(teCol =>
                                    {
                                        teCol.Spacing(2);
                                        teCol.Item().Text($"{te.TimeLabel}: {te.Title}").Bold();
                                        teCol.Item().Text($"Importance: {te.Importance} | Category: {te.Category}").Italic().FontSize(9).FontColor(Colors.Grey.Darken1);
                                        teCol.Item().Text(te.Description);
                                    });
                                }
                            }

                            // 4. Themes
                            if (report.ContentAnalysis.Themes != null && report.ContentAnalysis.Themes.Count > 0)
                            {
                                column.Item().PaddingTop(8).Text("Themes (Chủ đề & Thông điệp)")
                                    .FontSize(12)
                                    .SemiBold()
                                    .FontColor(Colors.Purple.Medium);

                                foreach (var t in report.ContentAnalysis.Themes)
                                {
                                    column.Item().Background(Colors.Grey.Lighten5).Padding(8).Column(tCol =>
                                    {
                                        tCol.Spacing(2);
                                        tCol.Item().Text(t.Title).Bold();
                                        tCol.Item().Text(t.Description);
                                        if (!string.IsNullOrWhiteSpace(t.Evidence))
                                        {
                                            tCol.Item().Text($"Evidence: \"{t.Evidence}\"").Italic().FontSize(9).FontColor(Colors.Grey.Darken2);
                                        }
                                    });
                                }
                            }

                            // 5. Analysis Note
                            if (!string.IsNullOrWhiteSpace(report.ContentAnalysis.AnalysisNote))
                            {
                                column.Item().PaddingTop(8).Text("Story Bible Analysis Notes (Ghi chú phân tích)")
                                    .FontSize(12)
                                    .SemiBold()
                                    .FontColor(Colors.Purple.Medium);

                                column.Item().Text(report.ContentAnalysis.AnalysisNote).Italic();
                            }
                        }

                        if (report.EmotionPacing != null)
                        {
                            column.Item().PageBreak();
                            column.Item().Text("NARRATIVE PACING & EMOTION (NHỊP ĐỘ & CẢM XÚC)")
                                .FontSize(16)
                                .Bold()
                                .FontColor(Colors.Teal.Darken2);

                            // 1. Overall Profiles
                            column.Item().PaddingTop(8).Background(Colors.Grey.Lighten5).Padding(10).Row(row =>
                            {
                                row.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Pacing Profile").Bold().FontColor(Colors.Teal.Darken1);
                                    c.Item().Text(string.IsNullOrWhiteSpace(report.EmotionPacing.OverallPacingProfile) ? "N/A" : report.EmotionPacing.OverallPacingProfile);
                                });
                                row.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Emotion Profile").Bold().FontColor(Colors.Teal.Darken1);
                                    c.Item().Text(string.IsNullOrWhiteSpace(report.EmotionPacing.DominantEmotionProfile) ? "N/A" : report.EmotionPacing.DominantEmotionProfile);
                                });
                            });

                            // 2. Insights
                            if (report.EmotionPacing.Insights != null && report.EmotionPacing.Insights.Count > 0)
                            {
                                column.Item().PaddingTop(12).Text("Literary & Narrative Insights (Nhận xét chuyên sâu từ AI)")
                                    .FontSize(12)
                                    .SemiBold()
                                    .FontColor(Colors.Teal.Darken2);

                                foreach (var rawInsight in report.EmotionPacing.Insights)
                                {
                                    if (string.IsNullOrWhiteSpace(rawInsight)) continue;
                                    if (rawInsight.Contains("PHÂN TÍCH CHUYÊN SÂU")) continue;

                                    var cleaned = rawInsight.Trim();

                                    // Replace curly quotes with straight quotes for consistent trimming
                                    cleaned = cleaned
                                        .Replace('“', '"')
                                        .Replace('”', '"')
                                        .Replace('‘', '\'')
                                        .Replace('’', '\'');

                                    // Trim outer quotes, commas, colons, braces, backslashes, but leave tag brackets [ ]
                                    char[] charsToTrim = { ' ', '"', '\'', ',', '{', '}', ':', '\\', '/' };
                                    cleaned = cleaned.Trim(charsToTrim).Trim();

                                    // Skip JSON structural markers and boilerplate lines
                                    if (string.IsNullOrWhiteSpace(cleaned) ||
                                        cleaned.Equals("[") ||
                                        cleaned.Equals("]") ||
                                        cleaned.Equals("insights", StringComparison.OrdinalIgnoreCase) ||
                                        cleaned.Contains("insights\":", StringComparison.OrdinalIgnoreCase) ||
                                        cleaned.Contains("insights\" :", StringComparison.OrdinalIgnoreCase))
                                    {
                                        continue;
                                    }

                                    column.Item().PaddingLeft(8).Row(r =>
                                    {
                                        r.ConstantItem(12).Text("•");
                                        r.RelativeItem().Text(cleaned);
                                    });
                                }
                            }
                        }
                    });

                    page.Footer()
                        .AlignCenter()
                        .Text(text =>
                        {
                            text.Span("StoryRAG analysis export · Page ").FontSize(9).FontColor(Colors.Grey.Darken1);
                            text.CurrentPageNumber().FontSize(9).FontColor(Colors.Grey.Darken1);
                            text.Span(" / ").FontSize(9).FontColor(Colors.Grey.Darken1);
                            text.TotalPages().FontSize(9).FontColor(Colors.Grey.Darken1);
                        });
                });
            });

            return document.GeneratePdf();
        }

        private async Task<string> TryGetAuthorNameAsync(Guid projectId)
        {
            if (_db == null) return "—";

            var authorName = await _db.Projects
                .AsNoTracking()
                .Where(p => p.Id == projectId)
                .Join(_db.Users.AsNoTracking(),
                    p => p.AuthorId,
                    u => u.Id,
                    (_, u) => u.FullName)
                .FirstOrDefaultAsync();

            return string.IsNullOrWhiteSpace(authorName) ? "—" : authorName;
        }

        private static string GetPreferredFontFamily()
        {
            // Avoid bundling font binaries in repo; use widely available system fonts.
            // On Windows: Segoe UI. On Linux: DejaVu Sans is common.
            return OperatingSystem.IsWindows() ? "Segoe UI" : "DejaVu Sans";
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
