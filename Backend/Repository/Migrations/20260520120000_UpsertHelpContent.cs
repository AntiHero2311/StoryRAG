using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Repository.Data;

#nullable disable

namespace Repository.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260520120000_UpsertHelpContent")]
    public partial class UpsertHelpContent : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                INSERT INTO "faqs" ("Id", "Question", "Answer", "Category", "Order", "Published", "UpdatedAt") VALUES
                ('a1000001-0001-4001-8001-000000000001', 'StoryNest / StoryRAG là gì?',
                 'StoryNest là không gian viết truyện tích hợp AI theo mô hình RAG (Retrieval-Augmented Generation). AI đọc và truy hồi từ chính bản thảo, Story Bible và chương của bạn để chat, rewrite và phân tích — không dựa trên kiến thức chung trên internet.',
                 'Tổng quan', 0, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000002', 'Làm sao tạo dự án và chương đầu tiên?',
                 'Từ Trang chủ: Tạo dự án mới → đặt tên, chọn thể loại → vào Workspace. Trong sidebar chương, bấm thêm chương, nhập tiêu đề và nội dung, rồi Lưu. Bạn có thể import .docx/.txt để tách chương tự động.',
                 'Bắt đầu', 1, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000003', 'Làm sao để AI chat hiểu truyện của tôi?',
                 'Quy trình RAG:' || E'\n' || '1) Lưu chương trong Workspace.' || E'\n' || '2) Hệ thống chunk nội dung phiên bản đang active.' || E'\n' || '3) Chạy Embed (đồng bộ vector) cho chương.' || E'\n' || '4) Mở Chat AI — câu hỏi sẽ truy hồi từ chương, Story Bible (nhân vật, thế giới…) đã embed.',
                 'AI & RAG', 2, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000004', 'Tại sao Chat AI báo chưa embed / chưa sẵn sàng?',
                 'Chat chỉ dùng được khi phiên bản chương active đã chunk và embed xong. Sau khi sửa nội dung lớn, hãy Lưu → đợi chunk → Embed lại. Kiểm tra trạng thái embed trên workspace trước khi hỏi AI.',
                 'AI & RAG', 3, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000005', 'Rewrite, Viết mới và Tiếp nối khác nhau thế nào?',
                 '• Rewrite: chọn đoạn văn, đưa instruction (ví dụ "ngắn gọn hơn", "thêm căng thẳng").' || E'\n' || '• Viết mới: AI soạn từ dàn ý bạn nhập.' || E'\n' || '• Tiếp nối: AI viết tiếp từ đoạn cuối chương, bám mạch truyện hiện có.' || E'\n' || 'Cả ba đều dùng ngữ cảnh dự án và trừ token gói của bạn.',
                 'AI & RAG', 4, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000006', 'Phân tích bộ truyện (Analysis) hoạt động ra sao?',
                 'Vào trang Phân tích của dự án → chạy phân tích. Hệ thống tạo job nền, chấm theo rubric và thể loại (có thể vài phút). Báo cáo có thể chờ staff duyệt trước khi bạn xem bản release. Mỗi gói có giới hạn số lần phân tích/tháng.',
                 'Phân tích', 5, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000007', 'Token AI và gói đăng ký là gì?',
                 'Token là đơn vị tiêu thụ khi dùng chat, rewrite, viết mới, tiếp nối, embed, phân tích… Mỗi gói (Free, Basic, Pro, Enterprise) có hạn mức token và số lần phân tích khác nhau. Xem chi tiết và nâng cấp tại Gói dịch vụ / Bảng giá.',
                 'Gói & thanh toán', 6, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000008', 'Story Bible gồm những gì và dùng thế nào?',
                 'Gồm Worldbuilding, Nhân vật, Ghi chú cốt truyện, Chủ đề, Style guide, Timeline… Cập nhật bible trước khi chat/rewrite giúp AI nhất quán. Các mục quan trọng nên embed để đưa vào truy hồi RAG.',
                 'Workspace', 7, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000009', 'Version chương (pin, diff, restore) là gì?',
                 'Mỗi lần lưu có thể tạo version mới hoặc cập nhật version active. Bạn chuyển version, so sánh diff, khôi phục bản cũ — tương tự Git nhẹ cho từng chương. Đổi version active ảnh hưởng chunk/embed — nhớ embed lại nếu cần AI đọc đúng bản.',
                 'Workspace', 8, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000010', 'Import và Export bản thảo?',
                 'Import: .docx hoặc .txt, có thể tách chương theo tiêu đề. Export: sao lưu hoặc chỉnh ngoài app. Sau import nên kiểm tra từng chương và chạy embed trước khi dùng chat RAG.',
                 'Workspace', 9, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000011', 'Nội dung truyện có được bảo mật không?',
                 'Nội dung nhạy cảm được mã hóa theo từng tài khoản. AI chỉ truy cập dữ liệu trong dự án của bạn khi bạn gọi tính năng. Không chia sẻ bản thảo công khai trừ khi bạn tự export hoặc gửi cho người khác.',
                 'Bảo mật', 10, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000012', 'Tôi báo lỗi ứng dụng ở đâu?',
                 'Tác giả: widget Báo cáo lỗi trên sidebar — mô tả lỗi và bước tái hiện. Phản hồi từ Staff xem tại Feedback. Staff/Admin xử lý tại Báo cáo lỗi app.',
                 'Hỗ trợ', 11, TRUE, NOW()),
                ('a1000001-0001-4001-8001-000000000013', 'Tại sao tài khoản bị hạn chế gọi AI?',
                 'Hệ thống giới hạn tần suất chat/rewrite để chống lạm dụng (bot, spam). Vượt ngưỡng có thể bị cảnh báo hoặc tạm khóa. Nếu bạn viết bình thường mà vẫn bị ảnh hưởng, báo lỗi kèm thời điểm xảy ra.',
                 'Hỗ trợ', 12, TRUE, NOW())
                ON CONFLICT ("Id") DO UPDATE SET
                  "Question" = EXCLUDED."Question",
                  "Answer" = EXCLUDED."Answer",
                  "Category" = EXCLUDED."Category",
                  "Order" = EXCLUDED."Order",
                  "Published" = EXCLUDED."Published",
                  "UpdatedAt" = NOW();
                """
            );

            migrationBuilder.Sql(
                """
                INSERT INTO "writing_tips" ("Id", "Title", "Content", "Tags", "Published", "UpdatedAt") VALUES
                ('b2000002-0002-4002-8002-000000000001', 'Show, don''t tell',
                 'Thay vì "cô ấy rất buồn", hãy cho thấy:' || E'\n' || '• Giọng run, câu ngắt' || E'\n' || '• Tay run, đồ vật rơi' || E'\n' || '• Không gian lạnh, im lặng' || E'\n' || 'Độc giả tự cảm nhận — cảm xúc mạnh và tin cậy hơn.',
                 ARRAY['kỹ-thuật','mô-tả'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000002', 'Giữ nhịp (pacing)',
                 '• Xen cao trào và khoảng thở (nhịp chậm sau shock).' || E'\n' || '• Tránh hội thoại dài 5–6 lượt không đổi bối cảnh.' || E'\n' || '• Kết chương bằng câu hỏi, quyết định hoặc twist nhỏ — giữ người đọc lật trang.',
                 ARRAY['cốt-truyện','nhịp-điệu'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000003', 'Mở đầu chương bằng hook',
                 'Ba câu đầu nên có xung đột, bí ẩn hoặc hành động — tránh mở bằng thời tiết chung chung rồi mới vào cốt. Có thể bắt đầu giữa cảnh (in medias res) rồi lấp lại ngữ cảnh sau.',
                 ARRAY['mở-đầu','hook'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000004', 'Giọng nhân vật nhất quán',
                 'Mỗi nhân vật có từ vựng, nhịp câu và thói quen riêng. Ghi vào Story Bible (tính cách, giọng nói) — khi rewrite hoặc chat AI, nhắc "bám giọng nhân vật X".',
                 ARRAY['nhân-vật','hội-thoại'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000005', 'Hội thoại: ít tag, đủ ngữ cảnh',
                 'Ưu tiên hành động xen kẽ thay vì lặp "anh ta nói / cô ấy đáp". Đọc thử toàn bộ hội thoại không tag — vẫn biết ai nói nhờ giọng và ngữ cảnh.',
                 ARRAY['hội-thoại','kỹ-thuật'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000006', 'Đồng bộ Story Bible trước khi hỏi AI',
                 'Sau khi đổi tên nhân vật, quy tắc thế giới hoặc twist lớn — cập nhật bible và embed lại. AI RAG chỉ "biết" những gì đã nằm trong index vector mới nhất.',
                 ARRAY['AI','Story-Bible'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000007', 'Luôn embed sau khi sửa chương lớn',
                 'Chunk/embed không tự cập nhật tức thì mọi thay đổi nhỏ — sau đoạn sửa dài hoặc đổi version active, kiểm tra trạng thái embed. Chat và phân tích dựa trên vector; bản cũ = câu trả lời sai.',
                 ARRAY['AI','workflow'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000008', 'Dùng phân tích định kỳ',
                 'Sau mỗi arc (3–5 chương) chạy Analysis một lần: bắt lỗi logic, nhịp chậm, nhân vật phẳng sớm. Đừng đợi hết bộ — sửa cấu trúc khi còn ít chương rẻ hơn.',
                 ARRAY['phân-tích','chất-lượng'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000009', 'Cliffhanger có chủ đích',
                 'Kết chương tại điểm thiếu thông tin hoặc quyết định chưa chốt — không phải dừng giữa câu vô nghĩa. Đặt câu hỏi cụ thể ("liệu X có dám mở cánh cửa?") thay vì "và rồi…".',
                 ARRAY['kết-chương','hook'], TRUE, NOW()),
                ('b2000002-0002-4002-8002-000000000010', 'Bám thể loại khi dùng AI',
                 'Chọn đúng thể loại dự án — rubric phân tích và gợi ý AI sẽ khác nhau (kiếm hiệp vs đô thị vs kinh dị). Instruction rewrite nên nhắc tone: "căng thẳng", "nhẹ nhàng", "hài hước châm biếm"…',
                 ARRAY['thể-loại','AI'], TRUE, NOW())
                ON CONFLICT ("Id") DO UPDATE SET
                  "Title" = EXCLUDED."Title",
                  "Content" = EXCLUDED."Content",
                  "Tags" = EXCLUDED."Tags",
                  "Published" = EXCLUDED."Published",
                  "UpdatedAt" = NOW();
                """
            );
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
