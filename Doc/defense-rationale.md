# Defense Rationale — Tech Stack Deviations

Tài liệu này giải thích lý do chọn các công nghệ khác so với yêu cầu mặc định của capstone spec,
phục vụ câu hỏi hội đồng trong buổi bảo vệ.

---

## 1. pgvector thay vì Weaviate (hoặc vector store chuyên dụng)

**Quyết định**: Lưu vector embeddings trực tiếp trong PostgreSQL thông qua extension `pgvector`.

**Lý do**:
- Giảm thiểu operational overhead: toàn bộ dữ liệu (relational + vector) nằm cùng một instance
  Supabase, không cần vận hành thêm dịch vụ ngoài.
- Năng lực phù hợp với scope capstone: `pgvector` xử lý hiệu quả dưới 1 triệu vector — đủ cho
  tập dữ liệu truyện của người dùng thực tế trong giai đoạn demo/production sớm.
- Tránh vendor lock-in và chi phí phát sinh của Weaviate Cloud; kết nối tái dùng connection pool
  EF Core đã có.

---

## 2. Không dùng Redis

**Quyết định**: Không tích hợp Redis làm cache layer.

**Lý do**:
- Chưa có luồng nào trong capstone cần cross-request cache đáng kể: mỗi AI request đều mang
  context mới (chương văn bản, lịch sử chat), không có hot read path lặp lại.
- Chi phí vận hành (thêm Redis instance trên Render/Railway) vượt lợi ích thực tế ở giai đoạn
  này; có thể bổ sung ở production scale-up sau defense.
- EF Core second-level cache và connection pooling đủ đáp ứng latency mục tiêu cho capstone demo.

---

## 3. Vite + React (SPA) thay vì Next.js (SSR)

**Quyết định**: Frontend là Single-Page Application xây bằng React 19 + Vite.

**Lý do**:
- StoryRAG là ứng dụng phức tạp phía client (rich-text editor, real-time sync, AI panels) không
  cần SSR cho SEO — đây là admin/author tool, không phải public content site.
- Vite Hot Module Replacement nhanh hơn đáng kể so với Next.js dev server, tăng tốc iteration
  trong sprint ngắn trước deadline.
- Tránh Next.js-specific abstractions (server actions, App Router) không thêm giá trị cho luồng
  backend-API-driven đã có.

---

## 4. Payment System (VNPay)

**Quyết định**: Tích hợp payment gateway vào capstone project.

**Lý do**:
- Payment được đưa vào để thể hiện **SaaS-readiness**: demo cho thấy sản phẩm có thể monetize
  thực tế ngay sau khi ra thị trường, không chỉ là prototype học thuật.
- Đây là overscope có chủ đích và đã được thừa nhận: hội đồng được thông báo phần này vượt
  requirement cứng và không ảnh hưởng điểm cốt lõi.
- Tích hợp hoàn chỉnh (webhook, idempotency, trạng thái đơn) giúp demo kiến trúc production-grade
  so với mock payment stub.
