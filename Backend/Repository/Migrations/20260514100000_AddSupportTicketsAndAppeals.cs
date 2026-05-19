using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260514100000_AddSupportTicketsAndAppeals")]
    public partial class AddSupportTicketsAndAppeals : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SupportTickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    Category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "Other"),
                    Subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Open"),
                    StaffReply = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportTickets", x => x.Id);
                    table.CheckConstraint("CK_SupportTickets_Category", "\"Category\" IN ('Payment','Subscription','Usage','DataDeletion','BanRecommendation','Other')");
                    table.CheckConstraint("CK_SupportTickets_Status", "\"Status\" IN ('Open','InProgress','Resolved','Closed')");
                    table.ForeignKey(
                        name: "FK_SupportTickets_Users_AssignedStaffId",
                        column: x => x.AssignedStaffId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SupportTickets_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuthorAppeals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "uuid_generate_v4()"),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppealType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Reason = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
                    ReviewedByStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffNote = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuthorAppeals", x => x.Id);
                    table.CheckConstraint("CK_AuthorAppeals_Type", "\"AppealType\" IN ('ProjectFlag','StaffFeedback','ReportReview')");
                    table.CheckConstraint("CK_AuthorAppeals_Status", "\"Status\" IN ('Pending','Approved','Rejected')");
                    table.ForeignKey(
                        name: "FK_AuthorAppeals_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuthorAppeals_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuthorAppeals_Users_ReviewedByStaffId",
                        column: x => x.ReviewedByStaffId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(name: "IX_SupportTickets_UserId", table: "SupportTickets", column: "UserId");
            migrationBuilder.CreateIndex(name: "IX_SupportTickets_Status", table: "SupportTickets", column: "Status");
            migrationBuilder.CreateIndex(name: "IX_SupportTickets_Category", table: "SupportTickets", column: "Category");
            migrationBuilder.CreateIndex(name: "IX_AuthorAppeals_AuthorId", table: "AuthorAppeals", column: "AuthorId");
            migrationBuilder.CreateIndex(name: "IX_AuthorAppeals_ProjectId", table: "AuthorAppeals", column: "ProjectId");
            migrationBuilder.CreateIndex(name: "IX_AuthorAppeals_Status", table: "AuthorAppeals", column: "Status");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AuthorAppeals");
            migrationBuilder.DropTable(name: "SupportTickets");
        }
    }
}
