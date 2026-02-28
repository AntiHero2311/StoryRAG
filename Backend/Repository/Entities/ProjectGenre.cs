namespace Repository.Entities
{
    public class ProjectGenre
    {
        public Guid ProjectId { get; set; }
        public int GenreId { get; set; }

        // Navigation
        public Project Project { get; set; } = null!;
        public Genre Genre { get; set; } = null!;
    }
}
