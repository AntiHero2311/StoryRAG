using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectAbuseFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProjectAbuseFlags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlagReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Warning"),
                    FlaggedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectAbuseFlags", x => x.Id);
                    table.CheckConstraint("CK_ProjectAbuseFlags_Severity", "\"Severity\" IN ('Warning','Critical')");
                    table.ForeignKey(
                        name: "FK_ProjectAbuseFlags_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectAbuseFlags_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAbuseFlags_FlaggedAt",
                table: "ProjectAbuseFlags",
                column: "FlaggedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAbuseFlags_ProjectId",
                table: "ProjectAbuseFlags",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAbuseFlags_UserId",
                table: "ProjectAbuseFlags",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectAbuseFlags");
        }
    }
}
