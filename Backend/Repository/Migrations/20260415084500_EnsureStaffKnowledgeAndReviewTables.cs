using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260415084500_EnsureStaffKnowledgeAndReviewTables")]
    public partial class EnsureStaffKnowledgeAndReviewTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "StaffKnowledgeBaseItems" (
                    "Id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "Type" character varying(20) NOT NULL DEFAULT 'FAQ',
                    "Title" character varying(200) NOT NULL,
                    "Content" character varying(5000) NOT NULL,
                    "Tags" character varying(300) NULL,
                    "IsPublished" boolean NOT NULL DEFAULT TRUE,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    "CreatedBy" uuid NOT NULL,
                    "UpdatedBy" uuid NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "UpdatedAt" timestamp with time zone NULL,
                    CONSTRAINT "PK_StaffKnowledgeBaseItems" PRIMARY KEY ("Id"),
                    CONSTRAINT "CK_StaffKnowledgeBaseItems_Type" CHECK ("Type" IN ('FAQ','WritingTip')),
                    CONSTRAINT "FK_StaffKnowledgeBaseItems_Users_CreatedBy"
                        FOREIGN KEY ("CreatedBy") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
                    CONSTRAINT "FK_StaffKnowledgeBaseItems_Users_UpdatedBy"
                        FOREIGN KEY ("UpdatedBy") REFERENCES "Users" ("Id") ON DELETE SET NULL
                );
                """
            );

            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "StaffAnalysisReviews" (
                    "Id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "ProjectReportId" uuid NOT NULL,
                    "ProjectId" uuid NOT NULL,
                    "AuthorId" uuid NOT NULL,
                    "ReviewedBy" uuid NOT NULL,
                    "Action" character varying(20) NOT NULL DEFAULT 'Verified',
                    "Note" character varying(2000) NULL,
                    "RerunReportId" uuid NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "UpdatedAt" timestamp with time zone NULL,
                    CONSTRAINT "PK_StaffAnalysisReviews" PRIMARY KEY ("Id"),
                    CONSTRAINT "CK_StaffAnalysisReview_Action" CHECK ("Action" IN ('Verified','Adjusted','RerunRequested')),
                    CONSTRAINT "FK_StaffAnalysisReviews_Projects_ProjectId"
                        FOREIGN KEY ("ProjectId") REFERENCES "Projects" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_StaffAnalysisReviews_ProjectReports_ProjectReportId"
                        FOREIGN KEY ("ProjectReportId") REFERENCES "ProjectReports" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_StaffAnalysisReviews_ProjectReports_RerunReportId"
                        FOREIGN KEY ("RerunReportId") REFERENCES "ProjectReports" ("Id") ON DELETE SET NULL,
                    CONSTRAINT "FK_StaffAnalysisReviews_Users_AuthorId"
                        FOREIGN KEY ("AuthorId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_StaffAnalysisReviews_Users_ReviewedBy"
                        FOREIGN KEY ("ReviewedBy") REFERENCES "Users" ("Id") ON DELETE RESTRICT
                );
                """
            );

            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffKnowledgeBaseItems_CreatedBy" ON "StaffKnowledgeBaseItems" ("CreatedBy");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffKnowledgeBaseItems_UpdatedBy" ON "StaffKnowledgeBaseItems" ("UpdatedBy");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffKnowledgeBaseItems_Type_IsPublished_SortOrder" ON "StaffKnowledgeBaseItems" ("Type", "IsPublished", "SortOrder");""");

            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffAnalysisReviews_AuthorId" ON "StaffAnalysisReviews" ("AuthorId");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffAnalysisReviews_ProjectId" ON "StaffAnalysisReviews" ("ProjectId");""");
            migrationBuilder.Sql("""CREATE UNIQUE INDEX IF NOT EXISTS "IX_StaffAnalysisReviews_ProjectReportId" ON "StaffAnalysisReviews" ("ProjectReportId");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffAnalysisReviews_RerunReportId" ON "StaffAnalysisReviews" ("RerunReportId");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffAnalysisReviews_ReviewedBy" ON "StaffAnalysisReviews" ("ReviewedBy");""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
