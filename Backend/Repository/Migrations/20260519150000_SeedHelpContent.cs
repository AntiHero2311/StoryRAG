using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260519150000_SeedHelpContent")]
    public partial class SeedHelpContent : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migrate legacy StaffKnowledgeBaseItems → faqs / writing_tips (if new tables empty)
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
                  AND NOT EXISTS (SELECT 1 FROM "faqs" LIMIT 1)
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
                  AND NOT EXISTS (SELECT 1 FROM "writing_tips" LIMIT 1)
                  AND NOT EXISTS (SELECT 1 FROM "writing_tips" w WHERE w."Id" = kb."Id");
                """
            );

            // Default published FAQs (only if still empty)
            migrationBuilder.Sql(
                """
                INSERT INTO "faqs" ("Id", "Question", "Answer", "Category", "Order", "Published", "UpdatedAt")
                SELECT * FROM (VALUES
                    ('a1000001-0001-4001-8001-000000000001'::uuid,
                     'StoryNest / StoryRAG là gì?',
                     'Nền tảng hỗ trợ sáng tác truyện tích hợp AI theo mô hình RAG: AI trả lời và phân tích dựa trên nội dung chương, Story Bible và bản thảo của bạn — không phải kiến thức chung trên internet.',
                     'Tổng quan', 0, TRUE, NOW()),
                    ('a1000001-0001-4001-8001-000000000002'::uuid,
                     'Làm sao để AI chat hiểu truyện của tôi?',
                     '1) Lưu chương trong Workspace.\n2) Hệ thống tự chunk nội dung.\n3) Chạy Embed cho chương (tab AI / nút đồng bộ vector).\n4) Khi chương đã embedded, mở Chat AI trong workspace — AI sẽ truy hồi ngữ cảnh từ bản thảo và Story Bible.',
                     'AI & RAG', 1, TRUE, NOW()),
                    ('a1000001-0001-4001-8001-000000000003'::uuid,
                     'Tại sao Chat AI báo chưa sẵn sàng / chưa embed?',
                     'Chat RAG chỉ hoạt động khi phiên bản chương đang active đã được chunk và embed. Hãy lưu chương, đợi chunk xong, rồi chạy Embed. Nếu vừa sửa nội dung lớn, cần embed lại.',
                     'AI & RAG', 2, TRUE, NOW()),
                    ('a1000001-0001-4001-8001-000000000004'::uuid,
                     'Phân tích bộ truyện (Analysis) hoạt động thế nào?',
                     'Bạn chạy phân tích từ trang Phân tích của dự án. Hệ thống tạo job nền, chấm theo rubric và thể loại, có thể mất vài phút. Kết quả có thể ở trạng thái chờ staff duyệt trước khi bạn xem bản release.',
                     'Phân tích', 3, TRUE, NOW()),
                    ('a1000001-0001-4001-8001-000000000005'::uuid,
                     'Token AI và gói đăng ký là gì?',
                     'Mỗi gói (Free, Basic, Pro, …) có giới hạn token AI và số lần phân tích/tháng. Chat, rewrite và các tác vụ AI đều trừ token. Xem chi tiết tại trang Gói dịch vụ.',
                     'Gói & thanh toán', 4, TRUE, NOW()),
                    ('a1000001-0001-4001-8001-000000000006'::uuid,
                     'Story Bible gồm những gì?',
                     'Worldbuilding, nhân vật, ghi chú cốt truyện, chủ đề, style guide… Các mục có thể được embed để AI chat và rewrite bám sát thiết lập của bạn.',
                     'Workspace', 5, TRUE, NOW()),
                    ('a1000001-0001-4001-8001-000000000007'::uuid,
                     'Tôi báo lỗi ứng dụng ở đâu?',
                     'Dùng widget Báo cáo lỗi trên sidebar (tác giả) hoặc mô tả lỗi kèm bước tái hiện. Staff/Admin xử lý tại mục Báo cáo lỗi app.',
                     'Hỗ trợ', 6, TRUE, NOW()),
                    ('a1000001-0001-4001-8001-000000000008'::uuid,
                     'Import / Export bản thảo?',
                     'Hỗ trợ .docx và .txt; import có thể tách chương theo tiêu đề. Export giúp sao lưu hoặc chỉnh sửa ngoài app.',
                     'Workspace', 7, TRUE, NOW())
                ) AS v("Id", "Question", "Answer", "Category", "Order", "Published", "UpdatedAt")
                WHERE NOT EXISTS (SELECT 1 FROM "faqs" LIMIT 1)
                  AND NOT EXISTS (SELECT 1 FROM "faqs" f WHERE f."Id" = v."Id");
                """
            );

            migrationBuilder.Sql(
                """
                INSERT INTO "writing_tips" ("Id", "Title", "Content", "Tags", "Published", "UpdatedAt")
                SELECT * FROM (VALUES
                    ('b2000002-0002-4002-8002-000000000001'::uuid,
                     'Show, don''t tell',
                     'Thay vì nói "cô ấy buồn", hãy cho độc giả thấy: giọng run, tay run, ánh mắt tránh. Cảm xúc mạnh hơn khi được suy ra từ hành động và chi tiết giác quan.',
                     ARRAY['kỹ-thuật','mô-tả']::text[], TRUE, NOW()),
                    ('b2000002-0002-4002-8002-000000000002'::uuid,
                     'Giữ nhịp (pacing)',
                     'Xen kẽ cảnh cao điểm và khoảng thở. Đoạn hội thoại dài liên tiếp làm chậm nhịp; sau cao trào nên có beat ngắn để độc giả "thở".',
                     ARRAY['cốt-truyện','nhịp-điệu']::text[], TRUE, NOW()),
                    ('b2000002-0002-4002-8002-000000000003'::uuid,
                     'Đồng bộ Story Bible trước khi hỏi AI',
                     'Cập nhật nhân vật, thế giới và ghi chú cốt truyện trước khi chat/rewrite. AI RAG sẽ ít mâu thuẫn hơn khi bible khớp bản thảo mới nhất.',
                     ARRAY['AI','Story-Bible']::text[], TRUE, NOW()),
                    ('b2000002-0002-4002-8002-000000000004'::uuid,
                     'Luôn embed sau khi sửa chương lớn',
                     'Mỗi lần lưu chương quan trọng, kiểm tra trạng thái chunk/embed. Chat và phân tích dựa trên vector — nội dung cũ trong index sẽ làm AI trả lời lệch.',
                     ARRAY['AI','workflow']::text[], TRUE, NOW()),
                    ('b2000002-0002-4002-8002-000000000005'::uuid,
                     'Dùng phân tích định kỳ',
                     'Chạy Analysis sau khi hoàn thành arc hoặc 3–5 chương để bắt lỗi logic, nhịp chậm, hoặc nhân vật phẳng sớm — đừng đợi hết bộ mới chấm.',
                     ARRAY['phân-tích','chất-lượng']::text[], TRUE, NOW())
                ) AS v("Id", "Title", "Content", "Tags", "Published", "UpdatedAt")
                WHERE NOT EXISTS (SELECT 1 FROM "writing_tips" LIMIT 1)
                  AND NOT EXISTS (SELECT 1 FROM "writing_tips" w WHERE w."Id" = v."Id");
                """
            );
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM "faqs"
                WHERE "Id" IN (
                    'a1000001-0001-4001-8001-000000000001',
                    'a1000001-0001-4001-8001-000000000002',
                    'a1000001-0001-4001-8001-000000000003',
                    'a1000001-0001-4001-8001-000000000004',
                    'a1000001-0001-4001-8001-000000000005',
                    'a1000001-0001-4001-8001-000000000006',
                    'a1000001-0001-4001-8001-000000000007',
                    'a1000001-0001-4001-8001-000000000008'
                );
                """
            );

            migrationBuilder.Sql(
                """
                DELETE FROM "writing_tips"
                WHERE "Id" IN (
                    'b2000002-0002-4002-8002-000000000001',
                    'b2000002-0002-4002-8002-000000000002',
                    'b2000002-0002-4002-8002-000000000003',
                    'b2000002-0002-4002-8002-000000000004',
                    'b2000002-0002-4002-8002-000000000005'
                );
                """
            );
        }
    }
}
