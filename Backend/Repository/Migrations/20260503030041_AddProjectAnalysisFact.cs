using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectAnalysisFact : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // UserSubscriptions.NextPlanId: có thể đã tồn tại trên DB (tạo thủ công / SQL) trước khi có migration — tránh 42701.
            migrationBuilder.Sql("""
                DO $ef$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'UserSubscriptions'
                          AND column_name = 'NextPlanId'
                    ) THEN
                        ALTER TABLE "UserSubscriptions" ADD "NextPlanId" integer NULL;
                    END IF;
                END $ef$;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_UserSubscriptions_NextPlanId"
                ON "UserSubscriptions" ("NextPlanId");
                """);

            migrationBuilder.Sql("""
                DO $ef$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_UserSubscriptions_SubscriptionPlans_NextPlanId'
                    ) THEN
                        ALTER TABLE "UserSubscriptions"
                        ADD CONSTRAINT "FK_UserSubscriptions_SubscriptionPlans_NextPlanId"
                        FOREIGN KEY ("NextPlanId") REFERENCES "SubscriptionPlans" ("Id");
                    END IF;
                END $ef$;
                """);

            migrationBuilder.CreateTable(
                name: "ProjectAnalysisFacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    Payload = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectAnalysisFacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectAnalysisFacts_ProjectAnalysisJobs_RunId",
                        column: x => x.RunId,
                        principalTable: "ProjectAnalysisJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectAnalysisFacts_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisFacts_ProjectId_RunId",
                table: "ProjectAnalysisFacts",
                columns: new[] { "ProjectId", "RunId" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisFacts_RunId",
                table: "ProjectAnalysisFacts",
                column: "RunId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectAnalysisFacts");

            // Không gỡ NextPlanId: cột có thể đã có trước migration này; SubscriptionService phụ thuộc cột.
        }
    }
}
