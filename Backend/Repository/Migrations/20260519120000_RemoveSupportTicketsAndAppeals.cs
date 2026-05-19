using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260519120000_RemoveSupportTicketsAndAppeals")]
    public partial class RemoveSupportTicketsAndAppeals : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "AuthorAppeals";""");
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "SupportTickets";""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
