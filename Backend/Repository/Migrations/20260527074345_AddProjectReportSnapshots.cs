using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectReportSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentAnalysisJson",
                table: "ProjectReports",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmotionPacingJson",
                table: "ProjectReports",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectReportSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChapterNumber = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    WordCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectReportSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectReportSnapshots_ProjectReports_ProjectReportId",
                        column: x => x.ProjectReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectReportSnapshots_ProjectReportId",
                table: "ProjectReportSnapshots",
                column: "ProjectReportId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectReportSnapshots");

            migrationBuilder.DropColumn(
                name: "ContentAnalysisJson",
                table: "ProjectReports");

            migrationBuilder.DropColumn(
                name: "EmotionPacingJson",
                table: "ProjectReports");
        }
    }
}
