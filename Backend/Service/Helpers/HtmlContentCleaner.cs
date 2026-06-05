using System;
using System.Text.RegularExpressions;

namespace Service.Helpers
{
    public static class HtmlContentCleaner
    {
        private static readonly Regex CommentRegex = new Regex(@"<!--.*?-->", RegexOptions.Compiled | RegexOptions.Singleline);
        private static readonly Regex ScriptsStylesRegex = new Regex(@"<(script|style|iframe|object|embed|head|title)\b[^>]*>.*?<\/\1>", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline);
        private static readonly Regex TagRemovalRegex = new Regex(@"<(?!/?(p|br|b|strong|i|em|u)\b)[^>]+>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex AttributeRemovalRegex = new Regex(@"<(p|br|b|strong|i|em|u)\b[^>]*>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex MultipleSpacesRegex = new Regex(@" {2,}", RegexOptions.Compiled);
        
        // Clean empty paragraphs: E.g. <p></p> or <p><br></p> or <p>&nbsp;</p>
        private static readonly Regex EmptyParagraphRegex = new Regex(@"<p>\s*(?:<br\s*/?>)?\s*</p>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        
        // Normalize line breaks
        private static readonly Regex MultipleBrsRegex = new Regex(@"(?:<br\s*/?>\s*){2,}", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public static string Clean(string? html)
        {
            if (string.IsNullOrWhiteSpace(html))
                return "<p></p>";

            // 1. Remove script/style tags and their inner content
            string cleaned = ScriptsStylesRegex.Replace(html, string.Empty);

            // 2. Remove comments
            cleaned = CommentRegex.Replace(cleaned, string.Empty);

            // 3. Convert non-breaking space characters/entities to regular space
            // \u00A0 is the non-breaking space character. &nbsp; is the HTML entity.
            cleaned = cleaned.Replace("\u00A0", " ");
            cleaned = cleaned.Replace("&nbsp;", " ");

            // 4. Remove all elements EXCEPT allowed tags: p, br, b, strong, i, em, u
            cleaned = TagRemovalRegex.Replace(cleaned, string.Empty);

            // 5. Strip all attributes from allowed tags. E.g. <p style="margin: 0"> -> <p>, <strong class="foo"> -> <strong>
            cleaned = AttributeRemovalRegex.Replace(cleaned, m =>
            {
                var tagName = m.Groups[1].Value.ToLower();
                if (tagName == "br")
                    return "<br>";
                return $"<{tagName}>";
            });

            // 6. Replace multiple consecutive spaces with a single space
            cleaned = MultipleSpacesRegex.Replace(cleaned, " ");

            // 7. Clean up empty paragraphs
            cleaned = EmptyParagraphRegex.Replace(cleaned, "<p><br></p>");

            // 8. Limit consecutive empty paragraphs <p><br></p> to maximum 1
            cleaned = Regex.Replace(cleaned, @"(?:<p><br></p>\s*){2,}", "<p><br></p>", RegexOptions.IgnoreCase);

            // 9. Limit consecutive <br> to maximum 1
            cleaned = MultipleBrsRegex.Replace(cleaned, "<br>");

            // 10. Trim leading and trailing empty paragraphs/whitespace
            cleaned = cleaned.Trim();
            while (cleaned.StartsWith("<p><br></p>", StringComparison.OrdinalIgnoreCase))
            {
                cleaned = cleaned.Substring("<p><br></p>".Length).Trim();
            }
            while (cleaned.EndsWith("<p><br></p>", StringComparison.OrdinalIgnoreCase))
            {
                cleaned = cleaned.Substring(0, cleaned.Length - "<p><br></p>".Length).Trim();
            }

            if (string.IsNullOrWhiteSpace(cleaned))
                return "<p></p>";

            // If the content is simple text without wrapping paragraphs, wrap it
            if (!cleaned.StartsWith("<p>", StringComparison.OrdinalIgnoreCase) && !cleaned.EndsWith("</p>", StringComparison.OrdinalIgnoreCase))
            {
                cleaned = $"<p>{cleaned}</p>";
            }

            return cleaned;
        }
    }
}
