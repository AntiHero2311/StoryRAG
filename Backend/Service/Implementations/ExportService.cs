using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;
using Repository.Data;
using Service.Interfaces;
using System.Text;

namespace Service.Implementations
{
    public class ExportService : IExportService
    {
        private readonly AppDbContext _context;
        private readonly IChapterService _chapterService;

        public ExportService(AppDbContext context, IChapterService chapterService)
        {
            _context = context;
            _chapterService = chapterService;
        }

        public string GetContentType(string format)
        {
            return format.ToLower() switch
            {
                "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
                "html" => ".html",
                "md" => ".md",
                _ => ".txt",
            };
        }

        private async Task ValidateAccessAsync(Guid projectId, Guid userId)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted && p.AuthorId == userId);
            if (project == null)
                throw new UnauthorizedAccessException("Bạn không có quyền truy cập dự án này.");
        }

        public async Task<byte[]> ExportChapterAsync(Guid projectId, Guid chapterId, Guid userId, string format)
        {
            await ValidateAccessAsync(projectId, userId);

            var chapter = await _chapterService.GetChapterDetailAsync(chapterId, userId);
            var versions = await _chapterService.GetVersionsAsync(chapterId, userId);
            var activeVersion = versions.FirstOrDefault(v => v.VersionNumber == chapter.CurrentVersionNum) ?? versions.OrderByDescending(v => v.VersionNumber).FirstOrDefault();
            
            string text = "";
            string title = chapter.Title ?? $"Chương {chapter.ChapterNumber}";
            if (activeVersion != null)
            {
                text = await _chapterService.GetVersionContentAsync(chapterId, activeVersion.VersionNumber, userId);
            }

            return GenerateFileContent(title, text, format);
        }

        public async Task<byte[]> ExportProjectAsync(Guid projectId, Guid userId, string format)
        {
            await ValidateAccessAsync(projectId, userId);

            var project = await _context.Projects.FindAsync(projectId);
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
                    var text = await _chapterService.GetVersionContentAsync(ch.Id, activeVersion.VersionNumber, userId);
                    sb.AppendLine(text);
                }
                sb.AppendLine();
            }

            string projTitle = project?.Title ?? "Story";
            return GenerateFileContent(projTitle, sb.ToString(), format);
        }

        private byte[] GenerateFileContent(string title, string content, string format)
        {
            switch (format.ToLower())
            {
                case "docx":
                    return GenerateDocx(title, content);
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
            using (var mem = new MemoryStream())
            {
                using (var wordDoc = WordprocessingDocument.Create(mem, WordprocessingDocumentType.Document))
                {
                    var mainPart = wordDoc.AddMainDocumentPart();
                    mainPart.Document = new Document(new Body());
                    var body = mainPart.Document.Body;

                    // Add Title
                    Paragraph paraTitle = new Paragraph(new Run(new Text(title)) 
                    { 
                        RunProperties = new RunProperties(new Bold(), new FontSize { Val = "48" }) // 24pt
                    });
                    body.AppendChild(paraTitle);

                    // Add content
                    foreach(var line in text.Split('\n'))
                    {
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        var p = new Paragraph(new Run(new Text(line)));
                        body.AppendChild(p);
                    }
                }
                return mem.ToArray();
            }
        }
    }
}
