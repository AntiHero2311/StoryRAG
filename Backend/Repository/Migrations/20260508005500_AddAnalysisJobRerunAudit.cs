using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260508005500_AddAnalysisJobRerunAudit")]
    public partial class AddAnalysisJobRerunAudit : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RetriedFromId",
                table: "ProjectAnalysisJobs",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "analysis_job_rerun_audits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    OldJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    NewJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_analysis_job_rerun_audits", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAnalysisJobs_RetriedFromId",
                table: "ProjectAnalysisJobs",
                column: "RetriedFromId");

            migrationBuilder.CreateIndex(
                name: "IX_analysis_job_rerun_audits_OldJobId",
                table: "analysis_job_rerun_audits",
                column: "OldJobId");

            migrationBuilder.CreateIndex(
                name: "IX_analysis_job_rerun_audits_NewJobId",
                table: "analysis_job_rerun_audits",
                column: "NewJobId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_analysis_job_rerun_audits_StaffId",
                table: "analysis_job_rerun_audits",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_analysis_job_rerun_audits_CreatedAt",
                table: "analysis_job_rerun_audits",
                column: "CreatedAt");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "analysis_job_rerun_audits");

            migrationBuilder.DropIndex(
                name: "IX_ProjectAnalysisJobs_RetriedFromId",
                table: "ProjectAnalysisJobs");

            migrationBuilder.DropColumn(
                name: "RetriedFromId",
                table: "ProjectAnalysisJobs");
        }
    }
}

