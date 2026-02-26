using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class RenameProjectColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "EncryptedTitle",
                table: "Projects",
                newName: "Title");

            migrationBuilder.RenameColumn(
                name: "EncryptedSummary",
                table: "Projects",
                newName: "Summary");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Title",
                table: "Projects",
                newName: "EncryptedTitle");

            migrationBuilder.RenameColumn(
                name: "Summary",
                table: "Projects",
                newName: "EncryptedSummary");
        }
    }
}
