using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260520140000_DropStaffKnowledgeBaseItems")]
    public partial class DropStaffKnowledgeBaseItems : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Chuyển nội dung còn sót sang faqs / writing_tips trước khi xóa bảng cũ
            migrationBuilder.Sql(
                """
                INSERT INTO "faqs" ("Id", "Question", "Answer", "Category", "Order", "Published", "UpdatedAt")
                SELECT
                    kb."Id",
                    kb."Title",
                    kb."Content",
                    COALESCE(NULLIF(TRIM(kb."Tags"), ''), 'General'),
                    kb."SortOrder",
                    kb."IsPublished",
                    COALESCE(kb."UpdatedAt", kb."CreatedAt")
                FROM "StaffKnowledgeBaseItems" kb
                WHERE kb."Type" = 'FAQ'
                  AND NOT EXISTS (SELECT 1 FROM "faqs" f WHERE f."Id" = kb."Id");
                """
            );

            migrationBuilder.Sql(
                """
                INSERT INTO "writing_tips" ("Id", "Title", "Content", "Tags", "Published", "UpdatedAt")
                SELECT
                    kb."Id",
                    kb."Title",
                    kb."Content",
                    CASE
                        WHEN kb."Tags" IS NULL OR TRIM(kb."Tags") = '' THEN ARRAY[]::text[]
                        ELSE (
                            SELECT COALESCE(array_agg(TRIM(t)), ARRAY[]::text[])
                            FROM unnest(string_to_array(kb."Tags", ',')) AS t
                            WHERE TRIM(t) <> ''
                        )
                    END,
                    kb."IsPublished",
                    COALESCE(kb."UpdatedAt", kb."CreatedAt")
                FROM "StaffKnowledgeBaseItems" kb
                WHERE kb."Type" = 'WritingTip'
                  AND NOT EXISTS (SELECT 1 FROM "writing_tips" w WHERE w."Id" = kb."Id");
                """
            );

            migrationBuilder.Sql("""DROP TABLE IF EXISTS "StaffKnowledgeBaseItems";""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "StaffKnowledgeBaseItems" (
                    "Id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "Type" character varying(20) NOT NULL DEFAULT 'FAQ',
                    "Title" character varying(200) NOT NULL,
                    "Content" character varying(5000) NOT NULL,
                    "Tags" character varying(300) NULL,
                    "IsPublished" boolean NOT NULL DEFAULT TRUE,
                    "SortOrder" integer NOT NULL DEFAULT 0,
                    "CreatedBy" uuid NOT NULL,
                    "UpdatedBy" uuid NULL,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                    "UpdatedAt" timestamp with time zone NULL,
                    CONSTRAINT "PK_StaffKnowledgeBaseItems" PRIMARY KEY ("Id"),
                    CONSTRAINT "CK_StaffKnowledgeBaseItems_Type" CHECK ("Type" IN ('FAQ','WritingTip')),
                    CONSTRAINT "FK_StaffKnowledgeBaseItems_Users_CreatedBy" FOREIGN KEY ("CreatedBy")
                        REFERENCES "Users" ("Id") ON DELETE RESTRICT,
                    CONSTRAINT "FK_StaffKnowledgeBaseItems_Users_UpdatedBy" FOREIGN KEY ("UpdatedBy")
                        REFERENCES "Users" ("Id") ON DELETE SET NULL
                );
                CREATE INDEX IF NOT EXISTS "IX_StaffKnowledgeBaseItems_CreatedBy" ON "StaffKnowledgeBaseItems" ("CreatedBy");
                CREATE INDEX IF NOT EXISTS "IX_StaffKnowledgeBaseItems_UpdatedBy" ON "StaffKnowledgeBaseItems" ("UpdatedBy");
                CREATE INDEX IF NOT EXISTS "IX_StaffKnowledgeBaseItems_Type_IsPublished_SortOrder"
                    ON "StaffKnowledgeBaseItems" ("Type", "IsPublished", "SortOrder");
                """
            );
        }
    }
}
