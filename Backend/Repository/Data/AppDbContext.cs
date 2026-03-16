using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pgvector.EntityFrameworkCore;
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
        public DbSet<Genre> Genres { get; set; }
        public DbSet<ProjectGenre> ProjectGenres { get; set; }
        public DbSet<SubscriptionPlan> SubscriptionPlans { get; set; }
        public DbSet<UserSubscription> UserSubscriptions { get; set; }
        public DbSet<Payment> Payments { get; set; }

        // Chapter system
        public DbSet<Chapter> Chapters { get; set; }
        public DbSet<ChapterVersion> ChapterVersions { get; set; }
        public DbSet<ChapterChunk> ChapterChunks { get; set; }

        // AI Reports
        public DbSet<ProjectReport> ProjectReports { get; set; }

        // Chat History
        public DbSet<AiChatMessage> ChatMessages { get; set; }

        // Rewrite History
        public DbSet<RewriteHistory> RewriteHistories { get; set; }

        // User Settings
        public DbSet<UserSettings> UserSettings { get; set; }

        // Worldbuilding & Characters & Other Notes
        public DbSet<WorldbuildingEntry> WorldbuildingEntries { get; set; }
        public DbSet<CharacterEntry> CharacterEntries { get; set; }
        public DbSet<StyleGuideEntry> StyleGuideEntries { get; set; }
        public DbSet<ThemeEntry> ThemeEntries { get; set; }
        public DbSet<PlotNoteEntry> PlotNoteEntries { get; set; }

        // Bug Reports
        public DbSet<BugReport> BugReports { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasPostgresExtension("uuid-ossp");
            modelBuilder.HasPostgresExtension("vector");

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
                entity.Property(e => e.SummaryEmbedding).HasColumnType("vector(768)");
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

            // ── Payment ────────────────────────────────────────────────────────────
            modelBuilder.Entity<Payment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Amount).HasPrecision(18, 2);
                entity.Property(e => e.Currency).IsRequired().HasMaxLength(10).HasDefaultValue("VND");
                entity.Property(e => e.PaymentMethod).IsRequired().HasMaxLength(50).HasDefaultValue("Card");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("Pending");
                entity.ToTable(t => t.HasCheckConstraint("CK_Payment_Status", "\"Status\" IN ('Pending','Completed','Failed','Refunded','Cancelled')"));
                entity.Property(e => e.TransactionId).HasMaxLength(255);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                // Unique index on TransactionId (when not null)
                entity.HasIndex(e => e.TransactionId).IsUnique().HasFilter("\"TransactionId\" IS NOT NULL");

                // FK → Users
                entity.HasOne(p => p.User)
                      .WithMany()
                      .HasForeignKey(p => p.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                // FK → SubscriptionPlans
                entity.HasOne(p => p.Plan)
                      .WithMany()
                      .HasForeignKey(p => p.PlanId)
                      .OnDelete(DeleteBehavior.Restrict);

                // FK → UserSubscriptions (optional)
                entity.HasOne(p => p.Subscription)
                      .WithMany()
                      .HasForeignKey(p => p.SubscriptionId)
                      .OnDelete(DeleteBehavior.SetNull)
                      .IsRequired(false);
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
                entity.Property(e => e.Title).HasMaxLength(255);
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

                // Embedding vector(768) — nomic-embed-text-v1.5 (LM Studio)
                entity.Property(e => e.Embedding).HasColumnType("vector(768)");

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

            // ── Genre ─────────────────────────────────────────────────────────────
            modelBuilder.Entity<Genre>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Slug).IsRequired().HasMaxLength(100);
                entity.HasIndex(e => e.Slug).IsUnique();
                entity.Property(e => e.Color).IsRequired().HasMaxLength(20).HasDefaultValue("#6366f1");
                entity.Property(e => e.Description).HasMaxLength(500);

                // Seed 14 thể loại
                entity.HasData(
                    new Genre { Id = 1,  Name = "Tiểu thuyết",           Slug = "tieu-thuyet",      Color = "#6366f1", Description = "Tác phẩm văn xuôi dài" },
                    new Genre { Id = 2,  Name = "Ngắn truyện",           Slug = "ngan-truyen",      Color = "#8b5cf6", Description = "Truyện ngắn, truyện vừa" },
                    new Genre { Id = 3,  Name = "Kiếm hiệp",             Slug = "kiem-hiep",        Color = "#ef4444", Description = "Võ hiệp, kiếm khách" },
                    new Genre { Id = 4,  Name = "Tiên hiệp",             Slug = "tien-hiep",        Color = "#f59e0b", Description = "Tu tiên, luyện khí" },
                    new Genre { Id = 5,  Name = "Huyền huyễn",           Slug = "huyen-huyen",      Color = "#10b981", Description = "Fantasy, thế giới ảo" },
                    new Genre { Id = 6,  Name = "Khoa học viễn tưởng",   Slug = "khoa-hoc-vien-tuong", Color = "#3b82f6", Description = "Sci-Fi, tương lai" },
                    new Genre { Id = 7,  Name = "Lãng mạn",              Slug = "lang-man",         Color = "#ec4899", Description = "Tình cảm, lãng mạn" },
                    new Genre { Id = 8,  Name = "Trinh thám",            Slug = "trinh-tham",       Color = "#64748b", Description = "Điều tra, phá án" },
                    new Genre { Id = 9,  Name = "Kinh dị",               Slug = "kinh-di",          Color = "#dc2626", Description = "Horror, ma quái" },
                    new Genre { Id = 10, Name = "Lịch sử",               Slug = "lich-su",          Color = "#92400e", Description = "Bối cảnh lịch sử" },
                    new Genre { Id = 11, Name = "Đô thị",                Slug = "do-thi",           Color = "#0891b2", Description = "Cuộc sống hiện đại" },
                    new Genre { Id = 12, Name = "Xuyên không",           Slug = "xuyen-khong",      Color = "#7c3aed", Description = "Isekai, xuyên thời gian" },
                    new Genre { Id = 13, Name = "Hệ thống",              Slug = "he-thong",         Color = "#059669", Description = "LitRPG, hệ thống cấp bậc" },
                    new Genre { Id = 14, Name = "Gia đình",              Slug = "gia-dinh",         Color = "#d97706", Description = "Tình cảm gia đình" }
                );
            });

            // ── ProjectGenre (join) ───────────────────────────────────────────────
            modelBuilder.Entity<ProjectGenre>(entity =>
            {
                entity.HasKey(pg => new { pg.ProjectId, pg.GenreId });

                entity.HasOne(pg => pg.Project)
                      .WithMany(p => p.ProjectGenres)
                      .HasForeignKey(pg => pg.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(pg => pg.Genre)
                      .WithMany(g => g.ProjectGenres)
                      .HasForeignKey(pg => pg.GenreId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            // ── ProjectReport ─────────────────────────────────────────────────────
            modelBuilder.Entity<ProjectReport>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("Pending");
                entity.ToTable(t => t.HasCheckConstraint("CK_ProjectReports_Status", "\"Status\" IN ('Pending','Completed','Failed','MockData')"));
                entity.Property(e => e.TotalScore).HasPrecision(5, 2).HasDefaultValue(0m);
                entity.Property(e => e.CriteriaJson).HasColumnType("jsonb").HasDefaultValue("[]");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasOne(r => r.Project)
                      .WithMany()
                      .HasForeignKey(r => r.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(r => r.User)
                      .WithMany()
                      .HasForeignKey(r => r.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── UserSettings ──────────────────────────────────────────────────────
            modelBuilder.Entity<UserSettings>(entity =>
            {
                entity.HasKey(e => e.UserId);
                entity.Property(e => e.EditorFont).IsRequired().HasMaxLength(100).HasDefaultValue("Be Vietnam Pro");
                entity.Property(e => e.EditorFontSize).HasDefaultValue(17);

                entity.HasOne(s => s.User)
                      .WithOne()
                      .HasForeignKey<UserSettings>(s => s.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── WorldbuildingEntry ────────────────────────────────────────────────
            modelBuilder.Entity<WorldbuildingEntry>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Title).IsRequired();
                entity.Property(e => e.Content).IsRequired().HasDefaultValue(string.Empty);
                entity.Property(e => e.Category).IsRequired().HasMaxLength(50).HasDefaultValue("Other");
                entity.Property(e => e.Embedding).HasColumnType("vector(768)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasOne(w => w.Project)
                      .WithMany()
                      .HasForeignKey(w => w.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── ChatMessage ───────────────────────────────────────────────────────
            modelBuilder.Entity<AiChatMessage>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Question).IsRequired();
                entity.Property(e => e.Answer).IsRequired();
                entity.Property(e => e.InputTokens).HasDefaultValue(0);
                entity.Property(e => e.OutputTokens).HasDefaultValue(0);
                entity.Property(e => e.TotalTokens).HasDefaultValue(0);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasIndex(e => new { e.ProjectId, e.UserId });

                entity.HasOne(m => m.Project)
                      .WithMany()
                      .HasForeignKey(m => m.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(m => m.User)
                      .WithMany()
                      .HasForeignKey(m => m.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── CharacterEntry ────────────────────────────────────────────────────
            modelBuilder.Entity<CharacterEntry>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Name).IsRequired();
                entity.Property(e => e.Role).IsRequired().HasMaxLength(50).HasDefaultValue("Supporting");
                entity.Property(e => e.Description).IsRequired().HasDefaultValue(string.Empty);
                entity.Property(e => e.Embedding).HasColumnType("vector(768)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasOne(c => c.Project)
                      .WithMany()
                      .HasForeignKey(c => c.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── StyleGuideEntry ───────────────────────────────────────────────────
            modelBuilder.Entity<StyleGuideEntry>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Aspect).IsRequired().HasMaxLength(50).HasDefaultValue("Other");
                entity.Property(e => e.Content).IsRequired().HasDefaultValue(string.Empty);
                entity.Property(e => e.Embedding).HasColumnType("vector(768)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasOne(s => s.Project)
                      .WithMany()
                      .HasForeignKey(s => s.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── ThemeEntry ────────────────────────────────────────────────────────
            modelBuilder.Entity<ThemeEntry>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Title).IsRequired();
                entity.Property(e => e.Description).IsRequired().HasDefaultValue(string.Empty);
                entity.Property(e => e.Embedding).HasColumnType("vector(768)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasOne(t => t.Project)
                      .WithMany()
                      .HasForeignKey(t => t.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── PlotNoteEntry ─────────────────────────────────────────────────────
            modelBuilder.Entity<PlotNoteEntry>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Type).IsRequired().HasMaxLength(50).HasDefaultValue("Other");
                entity.Property(e => e.Title).IsRequired();
                entity.Property(e => e.Content).IsRequired().HasDefaultValue(string.Empty);
                entity.Property(e => e.Embedding).HasColumnType("vector(768)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasOne(p => p.Project)
                      .WithMany()
                      .HasForeignKey(p => p.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── RewriteHistory ─────────────────────────────────────────────────────
            modelBuilder.Entity<RewriteHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.OriginalText).IsRequired();
                entity.Property(e => e.RewrittenText).IsRequired();
                entity.Property(e => e.Instruction).IsRequired().HasDefaultValue(string.Empty);
                entity.Property(e => e.TotalTokens).HasDefaultValue(0);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.HasIndex(e => new { e.ProjectId, e.UserId });
                entity.HasIndex(e => e.ChapterId);

                entity.HasOne(r => r.Project)
                      .WithMany()
                      .HasForeignKey(r => r.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(r => r.Chapter)
                      .WithMany()
                      .HasForeignKey(r => r.ChapterId)
                      .OnDelete(DeleteBehavior.SetNull)
                      .IsRequired(false);

                entity.HasOne(r => r.User)
                      .WithMany()
                      .HasForeignKey(r => r.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── BugReport ──────────────────────────────────────────────────────────
            modelBuilder.Entity<BugReport>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasDefaultValueSql("uuid_generate_v4()");
                entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Description).IsRequired();
                entity.Property(e => e.Category).IsRequired().HasMaxLength(30).HasDefaultValue("Bug");
                entity.Property(e => e.Priority).IsRequired().HasMaxLength(20).HasDefaultValue("Medium");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("Open");
                entity.Property(e => e.StaffNote).HasMaxLength(1000);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_BugReports_Category", "\"Category\" IN ('Bug','UX','Feature','Other')");
                    t.HasCheckConstraint("CK_BugReports_Priority", "\"Priority\" IN ('Low','Medium','High')");
                    t.HasCheckConstraint("CK_BugReports_Status", "\"Status\" IN ('Open','InProgress','Resolved','Closed')");
                });

                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.UserId);

                entity.HasOne(b => b.User)
                      .WithMany()
                      .HasForeignKey(b => b.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(b => b.ResolvedBy)
                      .WithMany()
                      .HasForeignKey(b => b.ResolvedById)
                      .OnDelete(DeleteBehavior.SetNull)
                      .IsRequired(false);
            });
        }
    }
}
