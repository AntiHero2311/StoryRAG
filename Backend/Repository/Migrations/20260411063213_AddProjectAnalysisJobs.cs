using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectAnalysisJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProjectAnalysisJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Queued"),
                    Stage = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "Queued"),
                    Progress = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    ProjectVersionHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false, defaultValue: ""),
                    ReportId = table.Column<Guid>(type: "uuid", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectAnalysisJobs", x => x.Id);
                    table.CheckConstraint("CK_ProjectAnalysisJobs_Progress", "\"Progress\" >= 0 AND \"Progress\" <= 100");
                    table.CheckConstraint("CK_ProjectAnalysisJobs_Stage", "\"Stage\" IN ('Queued','Preparing','Analyzing','Saving','Completed','Failed','Cancelled')");
                    table.CheckConstraint("CK_ProjectAnalysisJobs_Status", "\"Status\" IN ('Queued','Processing','Completed','Failed','Cancelled')");
                    table.ForeignKey(
                        name: "FK_ProjectAnalysisJobs_ProjectReports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ProjectAnalysisJobs_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectAnalysisJobs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisJobs_ProjectId_UserId_CreatedAt",
                table: "ProjectAnalysisJobs",
                columns: new[] { "ProjectId", "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisJobs_ProjectId_UserId_ProjectVersionHash_Sta~",
                table: "ProjectAnalysisJobs",
                columns: new[] { "ProjectId", "UserId", "ProjectVersionHash", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisJobs_ReportId",
                table: "ProjectAnalysisJobs",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisJobs_UserId",
                table: "ProjectAnalysisJobs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectAnalysisJobs");
        }
    }
}
