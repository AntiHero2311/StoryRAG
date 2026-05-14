using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260514104000_AddNotifications")]
    public partial class AddNotifications : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "info"),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: false),
                    Tag = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_CreatedByUserId",
                table: "Notifications",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_CreatedAt",
                table: "Notifications",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsRead",
                table: "Notifications",
                columns: new[] { "UserId", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_Tag",
                table: "Notifications",
                columns: new[] { "UserId", "Tag" },
                filter: "\"Tag\" IS NOT NULL");

            migrationBuilder.Sql(
                "ALTER TABLE \"Notifications\" ADD CONSTRAINT \"CK_Notifications_Type\" CHECK (\"Type\" IN ('success','error','info','warning'));");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");
        }
    }
}
