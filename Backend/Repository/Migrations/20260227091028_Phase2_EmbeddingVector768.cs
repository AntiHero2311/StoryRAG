using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Repository.Migrations
{
    /// <inheritdoc />
    public partial class Phase2_EmbeddingVector768 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Enable vector extension (idempotent)
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:uuid-ossp", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:uuid-ossp", ",,");

            // Xoá embedding cũ (vector(1536)) trước khi đổi type
            migrationBuilder.Sql(@"UPDATE ""ChapterChunks"" SET ""Embedding"" = NULL WHERE ""Embedding"" IS NOT NULL;");

            // Đổi Embedding column từ vector(1536) → vector(768) cho nomic-embed-text
            migrationBuilder.Sql(@"ALTER TABLE ""ChapterChunks"" ALTER COLUMN ""Embedding"" TYPE vector(768);");

            // Reset IsEmbedded vì embedding cũ không còn hợp lệ
            migrationBuilder.Sql(@"UPDATE ""ChapterVersions"" SET ""IsEmbedded"" = FALSE WHERE ""IsEmbedded"" = TRUE;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"UPDATE ""ChapterChunks"" SET ""Embedding"" = NULL WHERE ""Embedding"" IS NOT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""ChapterChunks"" ALTER COLUMN ""Embedding"" TYPE vector(1536);");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:uuid-ossp", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:uuid-ossp", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
