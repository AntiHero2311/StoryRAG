namespace Repository.Entities
{
    public class UserSettings
    {
        /// <summary>PK + FK to Users.Id (1-to-1)</summary>
        public Guid UserId { get; set; }

        /// <summary>Font family name, e.g. "Be Vietnam Pro"</summary>
        public string EditorFont { get; set; } = "Be Vietnam Pro";

        /// <summary>Font size in pixels, e.g. 17</summary>
        public int EditorFontSize { get; set; } = 17;

        // Navigation
        public User User { get; set; } = null!;
    }
}
