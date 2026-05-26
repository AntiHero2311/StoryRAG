-- Chuyển dữ liệu còn lại (nếu có) rồi xóa bảng legacy FAQ/WritingTip.
-- Thay thế bởi faqs + writing_tips. Chạy trên Supabase nếu chưa apply EF migration DropStaffKnowledgeBaseItems.

INSERT INTO "faqs" ("Id", "Question", "Answer", "Category", "Order", "Published", "UpdatedAt")
SELECT kb."Id", kb."Title", kb."Content",
       COALESCE(NULLIF(TRIM(kb."Tags"), ''), 'General'),
       kb."SortOrder", kb."IsPublished", COALESCE(kb."UpdatedAt", kb."CreatedAt")
FROM "StaffKnowledgeBaseItems" kb
WHERE kb."Type" = 'FAQ'
  AND NOT EXISTS (SELECT 1 FROM "faqs" f WHERE f."Id" = kb."Id");

INSERT INTO "writing_tips" ("Id", "Title", "Content", "Tags", "Published", "UpdatedAt")
SELECT kb."Id", kb."Title", kb."Content",
       CASE WHEN kb."Tags" IS NULL OR TRIM(kb."Tags") = '' THEN ARRAY[]::text[]
            ELSE (SELECT COALESCE(array_agg(TRIM(t)), ARRAY[]::text[])
                  FROM unnest(string_to_array(kb."Tags", ',')) AS t WHERE TRIM(t) <> '') END,
       kb."IsPublished", COALESCE(kb."UpdatedAt", kb."CreatedAt")
FROM "StaffKnowledgeBaseItems" kb
WHERE kb."Type" = 'WritingTip'
  AND NOT EXISTS (SELECT 1 FROM "writing_tips" w WHERE w."Id" = kb."Id");

DROP TABLE IF EXISTS "StaffKnowledgeBaseItems";
