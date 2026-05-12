using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;

namespace Service.Helpers
{
    /// <summary>
    /// Tách biệt logic đọc file bản thảo (.txt, .docx, .pdf) ra khỏi ChapterService
    /// để các service khác (ProjectImportService) có thể tái sử dụng.
    /// </summary>
    public static class ManuscriptExtractorHelper
    {
        public sealed class ManuscriptChapterPart
        {
            public string? Title { get; init; }
            public string Content { get; init; } = string.Empty;
        }

        /// <summary>Trích xuất văn bản thuần từ file, xác định định dạng qua extension + content-type.</summary>
        public static (string DetectedFormat, string Text) ExtractText(string fileName, string? contentType, byte[] fileBytes)
        {
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            var detectedFormat = extension switch
            {
                ".txt" => "txt",
                ".docx" => "docx",
                ".pdf" => "pdf",
                _ when !string.IsNullOrWhiteSpace(contentType) && contentType.Contains("pdf", StringComparison.OrdinalIgnoreCase) => "pdf",
                _ when !string.IsNullOrWhiteSpace(contentType) && contentType.Contains("wordprocessingml", StringComparison.OrdinalIgnoreCase) => "docx",
                _ when !string.IsNullOrWhiteSpace(contentType) && contentType.Contains("text/plain", StringComparison.OrdinalIgnoreCase) => "txt",
                _ => throw new Exception("Định dạng file không được hỗ trợ. Chỉ hỗ trợ .txt, .docx, .pdf."),
            };

            var text = detectedFormat switch
            {
                "txt" => Encoding.UTF8.GetString(fileBytes),
                "docx" => ExtractDocxText(fileBytes),
                "pdf" => ExtractPdfText(fileBytes),
                _ => string.Empty,
            };

            return (detectedFormat, NormalizeText(text));
        }

        /// <summary>Chia văn bản thành các Chương dựa trên tiêu đề heading.</summary>
        public static List<ManuscriptChapterPart> SplitIntoChapterParts(string extractedText, bool splitByHeadings = true)
        {
            var normalized = extractedText
                .Replace("\r\n", "\n")
                .Replace('\r', '\n')
                .Normalize(NormalizationForm.FormC)
                .Trim();

            if (string.IsNullOrWhiteSpace(normalized))
                return new List<ManuscriptChapterPart>();

            if (!splitByHeadings)
                return new List<ManuscriptChapterPart> { new() { Content = normalized } };

            var chapterHeadingRegex = new Regex(
                @"(?im)^\s*(chapter|ch(?:u|ư)(?:o|ơ)ng)\s+([0-9ivxlcdm]+)\b(?:[^\n]*)$",
                RegexOptions.Compiled);

            var matches = chapterHeadingRegex.Matches(normalized);
            if (matches.Count == 0)
                return new List<ManuscriptChapterPart> { new() { Content = normalized } };

            var chapterParts = new List<ManuscriptChapterPart>();
            for (var i = 0; i < matches.Count; i++)
            {
                var currentMatch = matches[i];
                var contentStart = currentMatch.Index + currentMatch.Length;
                if (contentStart < normalized.Length && normalized[contentStart] == '\n')
                    contentStart++;

                var contentEnd = i + 1 < matches.Count ? matches[i + 1].Index : normalized.Length;
                if (contentStart >= contentEnd) continue;

                var content = normalized[contentStart..contentEnd].Trim();
                if (string.IsNullOrWhiteSpace(content)) continue;

                var headingTitle = currentMatch.Value.Trim();
                if (headingTitle.Length > 255) headingTitle = headingTitle[..255];

                chapterParts.Add(new ManuscriptChapterPart { Title = headingTitle, Content = content });
            }

            if (chapterParts.Count == 0)
                chapterParts.Add(new ManuscriptChapterPart { Content = normalized });

            return chapterParts;
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        private static string ExtractDocxText(byte[] fileBytes)
        {
            using var stream = new MemoryStream(fileBytes);
            using var document = WordprocessingDocument.Open(stream, false);
            var body = document.MainDocumentPart?.Document?.Body;
            if (body == null) return string.Empty;

            var paragraphs = body
                .Descendants<Paragraph>()
                .Select(p => p.InnerText?.Trim())
                .Where(p => !string.IsNullOrWhiteSpace(p));

            return string.Join("\n\n", paragraphs!);
        }

        private static string ExtractPdfText(byte[] fileBytes)
        {
            using var stream = new MemoryStream(fileBytes);
            using var document = PdfDocument.Open(stream);
            var builder = new StringBuilder();

            foreach (var page in document.GetPages())
            {
                if (string.IsNullOrWhiteSpace(page.Text)) continue;
                builder.AppendLine(page.Text.Trim());
                builder.AppendLine();
            }

            return builder.ToString().Trim();
        }

        private static string NormalizeText(string rawText)
        {
            if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;

            var normalized = rawText
                .Replace("\uFEFF", string.Empty)
                .Replace("\r\n", "\n")
                .Replace('\r', '\n');

            if (LooksLikeClipboardHtml(normalized))
                normalized = ConvertHtmlToPlainText(normalized);

            normalized = StripControlCharacters(normalized);
            normalized = Regex.Replace(normalized, @"\n{3,}", "\n\n");

            return normalized.Trim();
        }

        private static bool LooksLikeClipboardHtml(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return false;
            if (!text.Contains('<') || !text.Contains('>')) return false;

            return text.Contains("<!--StartFragment", StringComparison.OrdinalIgnoreCase)
                || text.Contains("<!--EndFragment", StringComparison.OrdinalIgnoreCase)
                || text.Contains("docs-internal-guid", StringComparison.OrdinalIgnoreCase)
                || Regex.IsMatch(text, @"(?is)<\s*(span|div|p|h[1-6]|br|meta|style|script)\b");
        }

        private static string ConvertHtmlToPlainText(string html)
        {
            if (string.IsNullOrWhiteSpace(html)) return string.Empty;

            var text = Regex.Replace(html, @"(?is)<!--.*?-->", string.Empty);
            text = Regex.Replace(text, @"(?is)<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>", string.Empty);
            text = Regex.Replace(text, @"(?is)<\s*br\s*/?s*>", "\n");
            text = Regex.Replace(text, @"(?is)</\s*(p|div|h[1-6]|li|tr|section|article)\s*>", "\n");
            text = Regex.Replace(text, @"(?is)<\s*li[^>]*>", "- ");
            text = Regex.Replace(text, @"(?is)<[^>]+>", string.Empty);
            text = WebUtility.HtmlDecode(text).Replace('\u00A0', ' ');

            return text;
        }

        private static string StripControlCharacters(string text)
        {
            var builder = new StringBuilder(text.Length);
            foreach (var ch in text)
            {
                if (!char.IsControl(ch) || ch is '\n' or '\t')
                    builder.Append(ch);
            }
            return builder.ToString();
        }
    }
}
