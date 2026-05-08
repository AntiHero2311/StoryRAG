using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260508004000_EnsureWritingTipsTable")]
    public partial class EnsureWritingTipsTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "writing_tips" (
                    "Id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "Title" character varying(200) NOT NULL,
                    "Content" character varying(8000) NOT NULL,
                    "Tags" text[] NOT NULL DEFAULT '{}'::text[],
                    "Published" boolean NOT NULL DEFAULT FALSE,
                    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "PK_writing_tips" PRIMARY KEY ("Id")
                );
                """
            );

            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_writing_tips_Published" ON "writing_tips" ("Published");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_writing_tips_UpdatedAt" ON "writing_tips" ("UpdatedAt");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_writing_tips_Tags_gin" ON "writing_tips" USING GIN ("Tags");""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}

