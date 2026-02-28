namespace Repository.Entities
{
    public class Genre
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string Color { get; set; } = "#6366f1";
        public string? Description { get; set; }

        // Navigation
        public ICollection<ProjectGenre> ProjectGenres { get; set; } = new List<ProjectGenre>();
    }
}
