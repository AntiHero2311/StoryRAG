using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
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
        public DbSet<SubscriptionPlan> SubscriptionPlans { get; set; }
        public DbSet<UserSubscription> UserSubscriptions { get; set; }

        // Chapter system
        public DbSet<Chapter> Chapters { get; set; }
        public DbSet<ChapterVersion> ChapterVersions { get; set; }
        public DbSet<ChapterChunk> ChapterChunks { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasPostgresExtension("uuid-ossp");

            // ── User ─────────────────────────────────────────────────────────────
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.FullName).IsRequired().HasMaxLength(100);
                entity.HasIndex(e => e.Email).IsUnique();
                entity.Property(e => e.Email).IsRequired().HasMaxLength(100);
                entity.Property(e => e.PasswordHash).IsRequired();
                entity.Property(e => e.PasswordSalt).IsRequired();
                entity.Property(e => e.AvatarURL).HasMaxLength(500);
                entity.Property(e => e.Role).IsRequired().HasMaxLength(20);
                entity.ToTable(t => t.HasCheckConstraint("CK_Users_Role", "\"Role\" IN ('Admin','Author','Staff')"));
                entity.Property(e => e.IsActive).HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            });

            // ── Project ───────────────────────────────────────────────────────────
            modelBuilder.Entity<Project>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Title).IsRequired();
                entity.Property(e => e.CoverImageURL).HasMaxLength(500);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("Draft");
                entity.ToTable(t => t.HasCheckConstraint("CK_Projects_Status", "\"Status\" IN ('Draft','Published','Archived')"));
                entity.Property(e => e.IsDeleted).HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
                entity.HasOne(p => p.Author).WithMany().HasForeignKey(p => p.AuthorId).OnDelete(DeleteBehavior.Cascade);
            });

            // ── SubscriptionPlan ──────────────────────────────────────────────────
            modelBuilder.Entity<SubscriptionPlan>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();
                entity.Property(e => e.PlanName).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Price).HasPrecision(18, 2).HasDefaultValue(0m);
                entity.Property(e => e.MaxAnalysisCount).HasDefaultValue(10);
                entity.Property(e => e.MaxTokenLimit).HasDefaultValue(50000L);
                entity.Property(e => e.IsActive).HasDefaultValue(true);

                // Seed 4 plan mẫu
                entity.HasData(
                    new SubscriptionPlan { Id = 1, PlanName = "Free", Price = 0, MaxAnalysisCount = 3, MaxTokenLimit = 20000, Description = "Gói miễn phí – 3 lần phân tích bộ truyện và 20,000 token AI mỗi tháng.", IsActive = true },
                    new SubscriptionPlan { Id = 2, PlanName = "Basic", Price = 99000, MaxAnalysisCount = 20, MaxTokenLimit = 150000, Description = "Gói cơ bản – 99,000đ/tháng. 20 lần phân tích và 150,000 token AI.", IsActive = true },
                    new SubscriptionPlan { Id = 3, PlanName = "Pro", Price = 249000, MaxAnalysisCount = 100, MaxTokenLimit = 500000, Description = "Gói chuyên nghiệp – 249,000đ/tháng. 100 lần phân tích và 500,000 token AI.", IsActive = true },
                    new SubscriptionPlan { Id = 4, PlanName = "Enterprise", Price = 699000, MaxAnalysisCount = 9999, MaxTokenLimit = 2000000, Description = "Gói doanh nghiệp – 699,000đ/tháng. Không giới hạn phân tích và 2,000,000 token AI.", IsActive = true }
                );
            });

            // ── UserSubscription ──────────────────────────────────────────────────
            modelBuilder.Entity<UserSubscription>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("Active");
                entity.ToTable(t => t.HasCheckConstraint("CK_UserSub_Status", "\"Status\" IN ('Active','Expired','Cancelled')"));
                entity.Property(e => e.UsedAnalysisCount).HasDefaultValue(0);
                entity.Property(e => e.UsedTokens).HasDefaultValue(0L);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasOne(s => s.User)
                      .WithMany()
                      .HasForeignKey(s => s.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(s => s.Plan)
                      .WithMany(p => p.UserSubscriptions)
                      .HasForeignKey(s => s.PlanId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // ── Chapter ───────────────────────────────────────────────────────────
            modelBuilder.Entity<Chapter>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Title).HasMaxLength(255);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("Draft");
                entity.ToTable(t => t.HasCheckConstraint("CK_Chapters_Status", "\"Status\" IN ('Draft','Final','Archived')"));
                entity.Property(e => e.WordCount).HasDefaultValue(0);
                entity.Property(e => e.CurrentVersionNum).HasDefaultValue(0);
                entity.Property(e => e.IsDeleted).HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                // Unique: (ProjectId, ChapterNumber)
                entity.HasIndex(e => new { e.ProjectId, e.ChapterNumber }).IsUnique();

                // FK → Projects
                entity.HasOne(c => c.Project)
                      .WithMany()
                      .HasForeignKey(c => c.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);

                // FK → CurrentVersion (optional, set after version is created)
                entity.HasOne(c => c.CurrentVersion)
                      .WithMany()
                      .HasForeignKey(c => c.CurrentVersionId)
                      .OnDelete(DeleteBehavior.SetNull)
                      .IsRequired(false);
            });

            // ── ChapterVersion ────────────────────────────────────────────────────
            modelBuilder.Entity<ChapterVersion>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Content).IsRequired();
                entity.Property(e => e.WordCount).HasDefaultValue(0);
                entity.Property(e => e.TokenCount).HasDefaultValue(0);
                entity.Property(e => e.IsChunked).HasDefaultValue(false);
                entity.Property(e => e.IsEmbedded).HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                // Unique: (ChapterId, VersionNumber)
                entity.HasIndex(e => new { e.ChapterId, e.VersionNumber }).IsUnique();

                // FK → Chapters (all versions of a chapter)
                entity.HasOne(v => v.Chapter)
                      .WithMany(c => c.Versions)
                      .HasForeignKey(v => v.ChapterId)
                      .OnDelete(DeleteBehavior.Cascade);

                // FK → Users (creator)
                entity.HasOne(v => v.Creator)
                      .WithMany()
                      .HasForeignKey(v => v.CreatedBy)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // ── ChapterChunk ──────────────────────────────────────────────────────
            modelBuilder.Entity<ChapterChunk>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Content).IsRequired();
                entity.Property(e => e.TokenCount).HasDefaultValue(0);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");


                entity.HasIndex(e => e.VersionId);
                entity.HasIndex(e => e.ProjectId);

                // FK → ChapterVersions
                entity.HasOne(ch => ch.Version)
                      .WithMany(v => v.Chunks)
                      .HasForeignKey(ch => ch.VersionId)
                      .OnDelete(DeleteBehavior.Cascade);

                // FK → Projects (denormalized)
                entity.HasOne(ch => ch.Project)
                      .WithMany()
                      .HasForeignKey(ch => ch.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
