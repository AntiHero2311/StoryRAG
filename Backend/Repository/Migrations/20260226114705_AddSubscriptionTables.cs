using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SubscriptionPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlanName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    MaxAnalysisCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 10),
                    MaxTokenLimit = table.Column<long>(type: "bigint", nullable: false, defaultValue: 50000L),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserSubscriptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Active"),
                    UsedAnalysisCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    UsedTokens = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSubscriptions", x => x.Id);
                    table.CheckConstraint("CK_UserSub_Status", "\"Status\" IN ('Active','Expired','Cancelled')");
                    table.ForeignKey(
                        name: "FK_UserSubscriptions_SubscriptionPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "SubscriptionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserSubscriptions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "SubscriptionPlans",
                columns: new[] { "Id", "Description", "IsActive", "MaxAnalysisCount", "MaxTokenLimit", "PlanName" },
                values: new object[] { 1, "Gói miễn phí – 3 lần phân tích bộ truyện và 20,000 token AI mỗi tháng.", true, 3, 20000L, "Free" });

            migrationBuilder.InsertData(
                table: "SubscriptionPlans",
                columns: new[] { "Id", "Description", "IsActive", "MaxAnalysisCount", "MaxTokenLimit", "PlanName", "Price" },
                values: new object[,]
                {
                    { 2, "Gói cơ bản – 99,000đ/tháng. 20 lần phân tích và 150,000 token AI.", true, 20, 150000L, "Basic", 99000m },
                    { 3, "Gói chuyên nghiệp – 249,000đ/tháng. 100 lần phân tích và 500,000 token AI.", true, 100, 500000L, "Pro", 249000m },
                    { 4, "Gói doanh nghiệp – 699,000đ/tháng. Không giới hạn phân tích và 2,000,000 token AI.", true, 9999, 2000000L, "Enterprise", 699000m }
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserSubscriptions_PlanId",
                table: "UserSubscriptions",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSubscriptions_UserId",
                table: "UserSubscriptions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserSubscriptions");

            migrationBuilder.DropTable(
                name: "SubscriptionPlans");
        }
    }
}
