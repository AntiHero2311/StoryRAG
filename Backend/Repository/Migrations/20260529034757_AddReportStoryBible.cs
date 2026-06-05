using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddReportStoryBible : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReportCharacterEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Supporting"),
                    Description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    Background = table.Column<string>(type: "text", nullable: true),
                    TraitsJson = table.Column<string>(type: "text", nullable: true),
                    RelationshipsJson = table.Column<string>(type: "text", nullable: true),
                    FirstAppearance = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportCharacterEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReportCharacterEntries_ProjectReports_ProjectReportId",
                        column: x => x.ProjectReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReportThemeEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    Evidence = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportThemeEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReportThemeEntries_ProjectReports_ProjectReportId",
                        column: x => x.ProjectReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReportTimelineEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Story"),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    TimeLabel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Importance = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Normal"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportTimelineEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReportTimelineEvents_ProjectReports_ProjectReportId",
                        column: x => x.ProjectReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReportWorldbuildingEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Other"),
                    Importance = table.Column<string>(type: "text", nullable: true),
                    SourceChaptersJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportWorldbuildingEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReportWorldbuildingEntries_ProjectReports_ProjectReportId",
                        column: x => x.ProjectReportId,
                        principalTable: "ProjectReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReportCharacterEntries_ProjectReportId",
                table: "ReportCharacterEntries",
                column: "ProjectReportId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportThemeEntries_ProjectReportId",
                table: "ReportThemeEntries",
                column: "ProjectReportId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportTimelineEvents_ProjectReportId",
                table: "ReportTimelineEvents",
                column: "ProjectReportId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportWorldbuildingEntries_ProjectReportId",
                table: "ReportWorldbuildingEntries",
                column: "ProjectReportId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReportCharacterEntries");

            migrationBuilder.DropTable(
                name: "ReportThemeEntries");

            migrationBuilder.DropTable(
                name: "ReportTimelineEvents");

            migrationBuilder.DropTable(
                name: "ReportWorldbuildingEntries");
        }
    }
}
