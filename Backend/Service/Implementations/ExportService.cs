using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Repository.Data;
using Service.Helpers;
using Service.Interfaces;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;

namespace Service.Implementations
{
    public class ExportService : ServiceBase, IExportService
    {
        private readonly IChapterService _chapterService;
        private static readonly object QuestPdfLicenseLock = new();
        private static bool _questPdfLicenseConfigured;

        public ExportService(AppDbContext context, IChapterService chapterService, IConfiguration config)
            : base(context, config)
        {
            _chapterService = chapterService;
        }

        public string GetContentType(string format)
        {
            return format.ToLower() switch
            {
                "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "pdf" => "application/pdf",
                "html" => "text/html",
                "md" => "text/markdown",
                _ => "text/plain",
            };
        }

        public string GetFileExtension(string format)
        {
            return format.ToLower() switch
            {
                "docx" => ".docx",
                "pdf" => ".pdf",
                "html" => ".html",
                "md" => ".md",
                _ => ".txt",
            };
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


        private static string StripHtml(string html)
        {
            if (string.IsNullOrEmpty(html)) return html;
            // Replace block-level closing tags with newlines to preserve paragraph breaks
            var text = Regex.Replace(html, @"</p>|</div>|</h[1-6]>|<br\s*/?>", "\n", RegexOptions.IgnoreCase);
            // Strip all remaining HTML tags
            text = Regex.Replace(text, @"<[^>]+>", string.Empty);
            // Decode HTML entities (&amp; &lt; &nbsp; etc.)
            text = HttpUtility.HtmlDecode(text);
            // Collapse excessive blank lines (keep at most one blank line between paragraphs)
            text = Regex.Replace(text, @"\n{3,}", "\n\n");
            return text.Trim();
        }

        public async Task<byte[]> ExportChapterAsync(Guid projectId, Guid chapterId, Guid userId, string format)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var chapter = await _chapterService.GetChapterDetailAsync(chapterId, userId);
            var versions = await _chapterService.GetVersionsAsync(chapterId, userId);
            var activeVersion = versions.FirstOrDefault(v => v.VersionNumber == chapter.CurrentVersionNum) ?? versions.OrderByDescending(v => v.VersionNumber).FirstOrDefault();
            
            string rawContent = "";
            string title = chapter.Title ?? $"Chương {chapter.ChapterNumber}";
            if (activeVersion != null)
            {
                rawContent = await _chapterService.GetVersionContentAsync(chapterId, activeVersion.VersionNumber, userId);
            }

            string text = format.ToLower() == "html" ? rawContent : StripHtml(rawContent);
            return GenerateFileContent(title, text, format);
        }

        public async Task<byte[]> ExportProjectAsync(Guid projectId, Guid userId, string format)
        {
            await VerifyOwnershipAsync(projectId, userId);

            var project = await _context.Projects.FindAsync(projectId);
            var rawDek = await GetRawDekAsync(userId);
            var chapters = await _chapterService.GetChaptersByProjectAsync(projectId, userId);
            
            var sb = new StringBuilder();
            
            foreach (var ch in chapters.OrderBy(c => c.ChapterNumber))
            {
                var chTitle = ch.Title ?? $"Chương {ch.ChapterNumber}";
                sb.AppendLine($"# {chTitle}");
                sb.AppendLine();
                var versions = await _chapterService.GetVersionsAsync(ch.Id, userId);
                var activeVersion = versions.FirstOrDefault(v => v.VersionNumber == ch.CurrentVersionNum) ?? versions.OrderByDescending(v => v.VersionNumber).FirstOrDefault();
                if (activeVersion != null)
                {
                    var rawContent = await _chapterService.GetVersionContentAsync(ch.Id, activeVersion.VersionNumber, userId);
                    var text = format.ToLower() == "html" ? rawContent : StripHtml(rawContent);
                    sb.AppendLine(text);
                }
                sb.AppendLine();
            }

            string encryptedTitle = project?.Title ?? "";
            string projTitle = string.IsNullOrEmpty(encryptedTitle)
                ? "Story"
                : EncryptionHelper.DecryptWithMasterKey(encryptedTitle, rawDek);
            return GenerateFileContent(projTitle, sb.ToString(), format);
        }

        private byte[] GenerateFileContent(string title, string content, string format)
        {
            switch (format.ToLower())
            {
                case "docx":
                    return GenerateDocx(title, content);
                case "pdf":
                    return GeneratePdf(title, content);
                case "html":
                    var html = $"<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>{title}</title></head><body><h1>{title}</h1>";
                    html += string.Join("", content.Split('\n').Select(line => $"<p>{System.Net.WebUtility.HtmlEncode(line)}</p>"));
                    html += "</body></html>";
                    return Encoding.UTF8.GetBytes(html);
                case "md":
                    var md = $"# {title}\n\n{content}";
                    return Encoding.UTF8.GetBytes(md);
                case "txt":
                default:
                    var txt = $"{title}\n\n{content}";
                    return Encoding.UTF8.GetBytes(txt);
            }
        }

        private byte[] GenerateDocx(string title, string text)
        {
            using var mem = new MemoryStream();
            using (var wordDoc = WordprocessingDocument.Create(mem, WordprocessingDocumentType.Document))
            {
                var mainPart = wordDoc.AddMainDocumentPart();
                mainPart.Document = new DocumentFormat.OpenXml.Wordprocessing.Document();
                var body = new Body();
                mainPart.Document.AppendChild(body);

                // ── Trang bìa ──────────────────────────────────────────────────────
                body.AppendChild(new Paragraph(
                    new ParagraphProperties(
                        new Justification { Val = JustificationValues.Center },
                        new SpacingBetweenLines { Before = "3600", After = "480" }
                    ),
                    new Run(
                        new RunProperties(
                            new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" },
                            new Bold(),
                            new FontSize { Val = "56" }
                        ),
                        new Text(title)
                    )
                ));

                body.AppendChild(new Paragraph(
                    new ParagraphProperties(
                        new Justification { Val = JustificationValues.Center },
                        new SpacingBetweenLines { Before = "0", After = "240" }
                    ),
                    new Run(
                        new RunProperties(
                            new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" },
                            new FontSize { Val = "20" },
                            new Color { Val = "888888" }
                        ),
                        new Text("StoryNest")
                    )
                ));

                // Ngắt trang sang nội dung
                body.AppendChild(new Paragraph(new Run(new Break { Type = BreakValues.Page })));

                // ── Nội dung ───────────────────────────────────────────────────────
                bool firstChapter = true;
                foreach (var rawLine in text.Split('\n'))
                {
                    if (string.IsNullOrWhiteSpace(rawLine)) continue;

                    if (rawLine.TrimStart().StartsWith("# "))
                    {
                        var headingText = rawLine.TrimStart().Substring(2).Trim();

                        if (!firstChapter)
                            body.AppendChild(new Paragraph(new Run(new Break { Type = BreakValues.Page })));
                        firstChapter = false;

                        body.AppendChild(new Paragraph(
                            new ParagraphProperties(
                                new Justification { Val = JustificationValues.Center },
                                new SpacingBetweenLines { Before = "720", After = "480" }
                            ),
                            new Run(
                                new RunProperties(
                                    new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" },
                                    new Bold(),
                                    new FontSize { Val = "40" }
                                ),
                                new Text(headingText)
                            )
                        ));
                    }
                    else
                    {
                        body.AppendChild(new Paragraph(
                            new ParagraphProperties(
                                new Justification { Val = JustificationValues.Both },
                                new SpacingBetweenLines
                                {
                                    Line = "360",
                                    LineRule = LineSpacingRuleValues.Auto,
                                    After = "0"
                                },
                                new Indentation { FirstLine = "720" }
                            ),
                            new Run(
                                new RunProperties(
                                    new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" },
                                    new FontSize { Val = "24" }
                                ),
                                new Text(rawLine) { Space = SpaceProcessingModeValues.Preserve }
                            )
                        ));
                    }
                }

                // Cài đặt trang A4
                body.AppendChild(new SectionProperties(
                    new PageSize { Width = 11906, Height = 16838 },
                    new PageMargin { Top = 1440, Bottom = 1440, Left = 1701, Right = 1701 }
                ));

                mainPart.Document.Save();
            }
            return mem.ToArray();
        }

        private byte[] GeneratePdf(string title, string text)
        {
            EnsureQuestPdfLicenseConfigured();

            var lines = text.Split('\n').Where(l => !string.IsNullOrWhiteSpace(l)).ToList();

            var document = QuestPDF.Fluent.Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.MarginHorizontal(70);
                    page.MarginTop(60);
                    page.MarginBottom(54);
                    page.DefaultTextStyle(s => s.FontSize(12).LineHeight(1.7f).FontFamily("Arial"));

                    // Header: tên tác phẩm + số trang
                    page.Header()
                        .BorderBottom(0.5f).BorderColor("#cccccc")
                        .PaddingBottom(10)
                        .Row(row =>
                        {
                            row.RelativeItem()
                                .Text(title)
                                .FontSize(9).FontColor("#999999").Italic();
                            row.AutoItem()
                                .Text(x =>
                                {
                                    x.CurrentPageNumber();
                                });
                        });

                    page.Content().PaddingTop(24).Column(column =>
                    {
                        column.Spacing(0);

                        // Tiêu đề tác phẩm ở đầu nội dung
                        column.Item()
                            .PaddingBottom(48)
                            .Text(title)
                            .FontSize(26).Bold().AlignCenter();

                        foreach (var line in lines)
                        {
                            if (line.TrimStart().StartsWith("# "))
                            {
                                var headingText = line.TrimStart().Substring(2).Trim();
                                column.Item()
                                    .PaddingTop(32).PaddingBottom(20)
                                    .Text(headingText)
                                    .FontSize(17).Bold().AlignCenter();
                            }
                            else
                            {
                                column.Item()
                                    .PaddingBottom(10)
                                    .Text(line)
                                    .Justify();
                            }
                        }
                    });

                    // Footer: số trang căn giữa
                    page.Footer()
                        .PaddingTop(10)
                        .BorderTop(0.5f).BorderColor("#cccccc")
                        .AlignCenter()
                        .Text(x =>
                        {
                            x.Span("— ");
                            x.CurrentPageNumber();
                            x.Span(" —");
                        });
                });
            });

            return document.GeneratePdf();
        }
    }
}
