using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260508003000_EnsureFaqsTable")]
    public partial class EnsureFaqsTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "faqs" (
                    "Id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "Question" character varying(300) NOT NULL,
                    "Answer" character varying(5000) NOT NULL,
                    "Category" character varying(50) NOT NULL DEFAULT 'General',
                    "Order" integer NOT NULL DEFAULT 0,
                    "Published" boolean NOT NULL DEFAULT FALSE,
                    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "PK_faqs" PRIMARY KEY ("Id")
                );
                """
            );

            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_faqs_Category_Published_Order" ON "faqs" ("Category","Published","Order");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_faqs_UpdatedAt" ON "faqs" ("UpdatedAt");""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}

