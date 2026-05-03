namespace Service.Helpers
{
    /// <summary>
    /// Câu truy vấn cố định (M2) để embed và cosine top-K trên ChapterChunks — không dùng dynamic query embedding.
    /// </summary>
    public static class RubricQueryTemplates
    {
        /// <summary>Truy vấn tiếng Anh ngắn, tối ưu cho embedding retrieval theo từng key rubric.</summary>
        public static string GetRetrievalQuery(string rubricKey) =>
            Templates.TryGetValue(rubricKey.Trim(), out var q)
                ? q
                : $"Literary fiction excerpt relevant to story quality criterion {rubricKey}: narrative craft, prose, and reader experience.";

        /// <summary>Đủ 20 key rubric (khớp ProjectReportService).</summary>
        public static IReadOnlyCollection<string> AllKeys => Templates.Keys;

        private static readonly Dictionary<string, string> Templates = new(StringComparer.Ordinal)
        {
            ["1.1"] = "Genre expectations and conventions: romance fantasy thriller tone pacing tropes fulfillment reader promise",
            ["1.2"] = "Premise hook setup opening conflict stakes introduction compelling first act",
            ["2.1"] = "Character development arc motivation growth backstory change over time",
            ["2.2"] = "Character personality charm voice distinctiveness reader empathy believable traits",
            ["2.3"] = "Relationships dialogue chemistry conflict interactions supporting cast dynamics",
            ["2.4"] = "Character diversity antagonist foil side characters variety not one-dimensional",
            ["3.1"] = "Plot progression pacing tension twists reveals cause effect scene transitions rhythm",
            ["3.2"] = "Story structure organization rising action climax foreshadowing coherence chapters",
            ["3.3"] = "Ending resolution payoff closure emotional satisfaction sequel hooks finale",
            ["4.1"] = "Writing style voice tone atmosphere literary devices imagery figurative language",
            ["4.2"] = "Grammar spelling fluency sentence clarity mechanics errors readability",
            ["4.3"] = "Readability flow clarity confusing sentences pacing on sentence level ambiguity",
            ["5.1"] = "Interest fun entertainment curiosity engaging scenes boredom vs excitement",
            ["5.2"] = "Page-turner hook momentum suspense desire to continue cliffhanger investment",
            ["6.1"] = "Emotional empathy connection feelings reader care sad happy tension catharsis",
            ["6.2"] = "Emotional depth nuance subtext interiority grief joy complex feelings not shallow",
            ["7.1"] = "Theme exploration ideas moral social questions symbolism motifs argument",
            ["7.2"] = "Theme depth philosophy commentary worldview lesson subtle layered meaning",
            ["8.1"] = "Worldbuilding setting rules magic system geography culture consistency immersion",
            ["8.2"] = "Context accuracy historical cultural sensory detail place time atmosphere realism",
        };
    }
}
