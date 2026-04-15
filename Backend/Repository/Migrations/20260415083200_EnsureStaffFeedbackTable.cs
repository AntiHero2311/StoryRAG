using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260415083200_EnsureStaffFeedbackTable")]
    public partial class EnsureStaffFeedbackTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "StaffFeedbacks" (
                    "Id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "ProjectId" uuid NOT NULL,
                    "ChapterId" uuid NULL,
                    "AuthorId" uuid NOT NULL,
                    "StaffId" uuid NOT NULL,
                    "Content" character varying(3000) NOT NULL,
                    "Status" character varying(20) NOT NULL DEFAULT 'Open',
                    "StaffNote" character varying(3000) NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "UpdatedAt" timestamp with time zone NULL,
                    CONSTRAINT "PK_StaffFeedbacks" PRIMARY KEY ("Id"),
                    CONSTRAINT "CK_StaffFeedback_Status" CHECK ("Status" IN ('Open','Resolved')),
                    CONSTRAINT "FK_StaffFeedbacks_Chapters_ChapterId"
                        FOREIGN KEY ("ChapterId") REFERENCES "Chapters" ("Id") ON DELETE SET NULL,
                    CONSTRAINT "FK_StaffFeedbacks_Projects_ProjectId"
                        FOREIGN KEY ("ProjectId") REFERENCES "Projects" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_StaffFeedbacks_Users_AuthorId"
                        FOREIGN KEY ("AuthorId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_StaffFeedbacks_Users_StaffId"
                        FOREIGN KEY ("StaffId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
                );
                """
            );

            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffFeedbacks_AuthorId" ON "StaffFeedbacks" ("AuthorId");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffFeedbacks_ChapterId" ON "StaffFeedbacks" ("ChapterId");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffFeedbacks_ProjectId" ON "StaffFeedbacks" ("ProjectId");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_StaffFeedbacks_StaffId" ON "StaffFeedbacks" ("StaffId");""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
