using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260513231800_AddStaffFeedbackResponseFields")]
    public partial class AddStaffFeedbackResponseFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProjectReportId",
                table: "StaffFeedbacks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserFeedback",
                table: "StaffFeedbacks",
                type: "character varying(3000)",
                maxLength: 3000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UserRespondedAt",
                table: "StaffFeedbacks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserReaction",
                table: "StaffFeedbacks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffFeedbacks_ProjectReportId",
                table: "StaffFeedbacks",
                column: "ProjectReportId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffFeedbacks_UserReaction",
                table: "StaffFeedbacks",
                column: "UserReaction");

            migrationBuilder.AddForeignKey(
                name: "FK_StaffFeedbacks_ProjectReports_ProjectReportId",
                table: "StaffFeedbacks",
                column: "ProjectReportId",
                principalTable: "ProjectReports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StaffFeedbacks_ProjectReports_ProjectReportId",
                table: "StaffFeedbacks");

            migrationBuilder.DropIndex(
                name: "IX_StaffFeedbacks_ProjectReportId",
                table: "StaffFeedbacks");

            migrationBuilder.DropIndex(
                name: "IX_StaffFeedbacks_UserReaction",
                table: "StaffFeedbacks");

            migrationBuilder.DropColumn(
                name: "ProjectReportId",
                table: "StaffFeedbacks");

            migrationBuilder.DropColumn(
                name: "UserFeedback",
                table: "StaffFeedbacks");

            migrationBuilder.DropColumn(
                name: "UserRespondedAt",
                table: "StaffFeedbacks");

            migrationBuilder.DropColumn(
                name: "UserReaction",
                table: "StaffFeedbacks");
        }
    }
}
