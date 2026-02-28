using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class AddGenres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Genres",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "#6366f1"),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Genres", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProjectGenres",
                columns: table => new
                {
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    GenreId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectGenres", x => new { x.ProjectId, x.GenreId });
                    table.ForeignKey(
                        name: "FK_ProjectGenres_Genres_GenreId",
                        column: x => x.GenreId,
                        principalTable: "Genres",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectGenres_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Genres",
                columns: new[] { "Id", "Color", "Description", "Name", "Slug" },
                values: new object[,]
                {
                    { 1, "#6366f1", "Tác phẩm văn xuôi dài", "Tiểu thuyết", "tieu-thuyet" },
                    { 2, "#8b5cf6", "Truyện ngắn, truyện vừa", "Ngắn truyện", "ngan-truyen" },
                    { 3, "#ef4444", "Võ hiệp, kiếm khách", "Kiếm hiệp", "kiem-hiep" },
                    { 4, "#f59e0b", "Tu tiên, luyện khí", "Tiên hiệp", "tien-hiep" },
                    { 5, "#10b981", "Fantasy, thế giới ảo", "Huyền huyễn", "huyen-huyen" },
                    { 6, "#3b82f6", "Sci-Fi, tương lai", "Khoa học viễn tưởng", "khoa-hoc-vien-tuong" },
                    { 7, "#ec4899", "Tình cảm, lãng mạn", "Lãng mạn", "lang-man" },
                    { 8, "#64748b", "Điều tra, phá án", "Trinh thám", "trinh-tham" },
                    { 9, "#dc2626", "Horror, ma quái", "Kinh dị", "kinh-di" },
                    { 10, "#92400e", "Bối cảnh lịch sử", "Lịch sử", "lich-su" },
                    { 11, "#0891b2", "Cuộc sống hiện đại", "Đô thị", "do-thi" },
                    { 12, "#7c3aed", "Isekai, xuyên thời gian", "Xuyên không", "xuyen-khong" },
                    { 13, "#059669", "LitRPG, hệ thống cấp bậc", "Hệ thống", "he-thong" },
                    { 14, "#d97706", "Tình cảm gia đình", "Gia đình", "gia-dinh" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Genres_Slug",
                table: "Genres",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectGenres_GenreId",
                table: "ProjectGenres",
                column: "GenreId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectGenres");

            migrationBuilder.DropTable(
                name: "Genres");
        }
    }
}
