namespace Repository.Entities
{
    /// <summary>
    /// Persisted output of Stage 1 (extraction) for the RAG-based project report pipeline.
    /// Stage 2 (judgment/scoring) and the UI read from this table instead of re-extracting.
    ///
    /// Payload JSON schema
    /// -------------------
    /// {
    ///   "characters": [
    ///     {
    ///       "name": "string",           // character name
    ///       "role": "string",           // e.g. "Protagonist" | "Antagonist" | "Supporting"
    ///       "appearances": ["string"]   // chapter IDs or titles where the character appears
    ///     }
    ///   ],
    ///   "chapter_stats": [
    ///     {
    ///       "chapter_id": "uuid",
    ///       "title": "string",
    ///       "word_count": 0,            // approximate word count of active version
    ///       "scene_count": 0            // number of detected scene breaks
    ///     }
    ///   ],
    ///   "plot_events": [
    ///     {
    ///       "chapter_id": "uuid",
    ///       "summary": "string",        // one-sentence event summary extracted by AI
    ///       "type": "string"            // e.g. "Inciting Incident" | "Climax" | "Resolution"
    ///     }
    ///   ],
    ///   "consistency_flags": [
    ///     {
    ///       "type": "string",           // e.g. "CharacterNameVariant" | "TimelineGap" | "SettingContradiction"
    ///       "description": "string",    // human-readable description of the inconsistency
    ///       "chapter_ids": ["uuid"]     // chapters involved in the flag
    ///     }
    ///   ]
    /// }
    /// </summary>
    public class ProjectAnalysisFact
    {
        /// <summary>Primary key (UUID v4).</summary>
        public Guid Id { get; set; }

        /// <summary>FK to Projects.Id.</summary>
        public Guid ProjectId { get; set; }

        /// <summary>
        /// Logical run identifier that groups extraction and judgment for one analysis cycle.
        /// Matches the <see cref="ProjectAnalysisJob.Id"/> that triggered this extraction.
        /// </summary>
        public Guid RunId { get; set; }

        /// <summary>
        /// Extracted facts serialised as JSONB.
        /// See class-level documentation for the full schema.
        /// </summary>
        public string Payload { get; set; } = "{}";

        public DateTime CreatedAt { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
    }
}
