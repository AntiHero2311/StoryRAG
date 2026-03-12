using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddSummaryEmbeddingToProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Vector>(
                name: "SummaryEmbedding",
                table: "Projects",
                type: "vector(768)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BugReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "Bug"),
                    Priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Medium"),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Open"),
                    StaffNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ResolvedById = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BugReports", x => x.Id);
                    table.CheckConstraint("CK_BugReports_Category", "\"Category\" IN ('Bug','UX','Feature','Other')");
                    table.CheckConstraint("CK_BugReports_Priority", "\"Priority\" IN ('Low','Medium','High')");
                    table.CheckConstraint("CK_BugReports_Status", "\"Status\" IN ('Open','InProgress','Resolved','Closed')");
                    table.ForeignKey(
                        name: "FK_BugReports_Users_ResolvedById",
                        column: x => x.ResolvedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_BugReports_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BugReports_ResolvedById",
                table: "BugReports",
                column: "ResolvedById");

            migrationBuilder.CreateIndex(
                name: "IX_BugReports_Status",
                table: "BugReports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_BugReports_UserId",
                table: "BugReports",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BugReports");

            migrationBuilder.DropColumn(
                name: "SummaryEmbedding",
                table: "Projects");
        }
    }
}
