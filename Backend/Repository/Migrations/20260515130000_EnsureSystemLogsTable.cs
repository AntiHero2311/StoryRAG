using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260515130000_EnsureSystemLogsTable")]
    public partial class EnsureSystemLogsTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS system_logs (
                    "Id" uuid NOT NULL,
                    "Level" character varying(20) NOT NULL,
                    "Category" character varying(50) NOT NULL,
                    "Action" character varying(100) NOT NULL,
                    "Message" character varying(1000) NOT NULL,
                    "ActorId" uuid NULL,
                    "MetadataJson" jsonb NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT "PK_system_logs" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_system_logs_Users_ActorId" FOREIGN KEY ("ActorId") REFERENCES "Users" ("Id") ON DELETE SET NULL
                );
                """
            );

            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_system_logs_CreatedAt" ON system_logs ("CreatedAt");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_system_logs_Category" ON system_logs ("Category");""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_system_logs_ActorId" ON system_logs ("ActorId");""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
