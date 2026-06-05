using Service.Helpers;
using Xunit;

namespace Service.Tests
{
    public class HtmlContentCleanerTests
    {
        [Theory]
        [InlineData("<!--StartFragment--><span style=\"letter-spacing: 0.17px;\">Ai ngu&nbsp; lồn&nbsp;</span>", "<p>Ai ngu lồn</p>")]
        [InlineData("<p style=\"color: red;\">Hello  World</p>", "<p>Hello World</p>")]
        [InlineData("<p></p><p><br></p><p>First</p><p><br></p><p><br></p><p>Second</p><p><br></p>", "<p>First</p><p><br></p><p>Second</p>")]
        [InlineData("Just plain text with &nbsp; and \u00A0 spaces", "<p>Just plain text with and spaces</p>")]
        [InlineData("<strong>Bold</strong> <script>alert(1);</script> <i>Italic</i>", "<p><strong>Bold</strong> <i>Italic</i></p>")]
        public void HtmlContentCleaner_CleansHtmlCorrectly(string input, string expected)
        {
            var result = HtmlContentCleaner.Clean(input);
            Assert.Equal(expected, result);
        }
    }
}
