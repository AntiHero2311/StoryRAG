using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class EnforceSingleActiveAnalysisJob : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                WITH ranked AS (
                    SELECT
                        "Id",
                        "UserId",
                        ROW_NUMBER() OVER (
                            PARTITION BY "UserId"
                            ORDER BY COALESCE("StartedAt", "CreatedAt") DESC, "CreatedAt" DESC
                        ) AS rn
                    FROM "ProjectAnalysisJobs"
                    WHERE "Status" IN ('Queued','Processing')
                )
                UPDATE "ProjectAnalysisJobs" AS j
                SET
                    "Status" = 'Cancelled',
                    "Stage" = 'Cancelled',
                    "Progress" = 100,
                    "ErrorMessage" = COALESCE(j."ErrorMessage", 'Tự động hủy do chuẩn hóa chỉ một job active/user.'),
                    "CompletedAt" = COALESCE(j."CompletedAt", NOW()),
                    "UpdatedAt" = NOW()
                FROM ranked AS r
                WHERE j."Id" = r."Id"
                  AND r.rn > 1;
                """);

            migrationBuilder.DropIndex(
                name: "IX_ProjectAnalysisJobs_UserId",
                table: "ProjectAnalysisJobs");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisJobs_UserId_Active",
                table: "ProjectAnalysisJobs",
                column: "UserId",
                unique: true,
                filter: "\"Status\" IN ('Queued','Processing')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProjectAnalysisJobs_UserId_Active",
                table: "ProjectAnalysisJobs");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisJobs_UserId",
                table: "ProjectAnalysisJobs",
                column: "UserId");
        }
    }
}
