using Microsoft.EntityFrameworkCore;
using Repository.Entities;

namespace Repository.Data
{
      public class AppDbContext : DbContext
      {
            public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
            {
            }

            public DbSet<User> Users { get; set; }
            public DbSet<Project> Projects { get; set; }

            protected override void OnModelCreating(ModelBuilder modelBuilder)
            {
                  base.OnModelCreating(modelBuilder);

                  modelBuilder.HasPostgresExtension("uuid-ossp");

                  modelBuilder.Entity<User>(entity =>
                  {
                        entity.HasKey(e => e.Id);

                        entity.Property(e => e.Id)
                        .HasDefaultValueSql("uuid_generate_v4()");

                        entity.Property(e => e.FullName)
                        .IsRequired()
                        .HasMaxLength(100);

                        entity.HasIndex(e => e.Email)
                        .IsUnique();

                        entity.Property(e => e.Email)
                        .IsRequired()
                        .HasMaxLength(100);

                        entity.Property(e => e.PasswordHash)
                        .IsRequired();

                        entity.Property(e => e.PasswordSalt)
                        .IsRequired();

                        entity.Property(e => e.AvatarURL)
                        .HasMaxLength(500);

                        entity.Property(e => e.Role)
                        .IsRequired()
                        .HasMaxLength(20);

                        // EF Core Check constraint for Role IN ('Admin', 'Author', 'Staff')
                        entity.ToTable(t => t.HasCheckConstraint("CK_Users_Role", "\"Role\" IN ('Admin','Author','Staff')"));

                        entity.Property(e => e.IsActive)
                        .HasDefaultValue(true);

                        entity.Property(e => e.CreatedAt)
                        .HasDefaultValueSql("NOW()");
                  });

                  modelBuilder.Entity<Project>(entity =>
                  {
                        entity.HasKey(e => e.Id);

                        entity.Property(e => e.Id)
                        .HasDefaultValueSql("uuid_generate_v4()");

                        entity.Property(e => e.Title)
                        .IsRequired();

                        entity.Property(e => e.CoverImageURL)
                        .HasMaxLength(500);

                        entity.Property(e => e.Status)
                        .IsRequired()
                        .HasMaxLength(20)
                        .HasDefaultValue("Draft");

                        entity.ToTable(t => t.HasCheckConstraint("CK_Projects_Status", "\"Status\" IN ('Draft','Published','Archived')"));

                        entity.Property(e => e.IsDeleted)
                        .HasDefaultValue(false);

                        entity.Property(e => e.CreatedAt)
                        .HasDefaultValueSql("NOW()");

                        entity.HasOne(p => p.Author)
                        .WithMany()
                        .HasForeignKey(p => p.AuthorId)
                        .OnDelete(DeleteBehavior.Cascade);
                  });
            }
      }
}
