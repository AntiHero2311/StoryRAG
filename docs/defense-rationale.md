# Defense Rationale — Tech Stack Deviations & Overscope

> **Mục đích tài liệu:** Chuẩn bị trả lời câu hỏi hội đồng về các quyết định thiết kế kỹ thuật
> khác với capstone spec chuẩn. Mỗi mục ghi rõ quyết định, lý do, đánh đổi được chấp nhận và
> tham chiếu code thực tế.
>
> **Document purpose:** Prepare responses for panel questions on technical design decisions that
> deviate from the standard capstone spec. Each entry states the decision, rationale, accepted
> trade-offs, and real code references.

---

## Bảng tóm tắt / Summary Table

| # | Deviation | Thay thế được kỳ vọng | Lựa chọn thực tế | Tác động |
|---|---|---|---|---|
| 1 | Vector store | Weaviate / Pinecone | pgvector (PostgreSQL) | Giảm infra, đủ cho scope |
| 2 | Cache layer | Redis | Không có (EF Core pool) | Chấp nhận được ở capstone scale |
| 3 | Frontend framework | Next.js (SSR) | React 19 + Vite (SPA) | Dev speed ↑, SEO không cần |
| 4 | Scope | Core writing tool | + Payment gateway | Overscope có chủ đích, SaaS demo |

---

## 1. pgvector thay vì Weaviate (hoặc vector store chuyên dụng)

**Quyết định:** Lưu vector embeddings trực tiếp trong PostgreSQL thông qua extension `pgvector`
thay vì triển khai Weaviate, Pinecone hoặc Qdrant riêng biệt.

**Lý do:**

1. **Giảm operational overhead:** Toàn bộ dữ liệu — relational và vector — nằm trong cùng một
   instance Supabase. Không cần vận hành, monitor hoặc bảo trì thêm dịch vụ ngoài; connection pool
   EF Core được tái sử dụng hoàn toàn (`Repository/AppDbContext.cs`).

2. **Năng lực phù hợp với scope capstone:** `pgvector` xử lý hiệu quả dưới 1 triệu vector với
   HNSW/IVFFlat index — đủ cho tập dữ liệu 6 loại Story Bible + toàn bộ chapter chunks của người
   dùng thực tế trong giai đoạn demo. Vector dimension cố định là 768 (Gemini text-embedding-004).

3. **Tránh vendor lock-in và chi phí:** Weaviate Cloud và Pinecone có tier miễn phí giới hạn và
   tính phí theo vector count ở scale-up. pgvector không phát sinh chi phí riêng khi đã có
   Supabase; migration về sau sang dedicated vector store vẫn thực hiện được nếu vượt ngưỡng.

**Đánh đổi được chấp nhận:** ANN search của pgvector chậm hơn Weaviate ở hàng triệu vector, nhưng
trong scope capstone (< 100.000 vector mỗi project), latency < 200 ms là đủ.

**Tham chiếu code:** `Backend/Service/Implementations/EmbeddingService.cs`,
`Backend/Repository/Entities/ChapterChunk.cs` (cột `vector(768)`).

---

## 2. Không dùng Redis

**Quyết định:** Không tích hợp Redis làm cache layer hay session store.

**Lý do:**

1. **Không có hot read path lặp lại:** Mỗi AI request mang context mới (nội dung chương, lịch sử
   chat theo session). Không tồn tại query giống hệt nhau được gọi nhiều lần liên tiếp — đây là
   điều kiện cần thiết để Redis mang lại lợi ích thực sự.

2. **Chi phí vận hành vượt lợi ích:** Thêm Redis instance trên Render/Railway tốn thêm ~$7–15/tháng
   và một service cần monitor riêng. Ở tải capstone demo (< 50 concurrent users), EF Core
   connection pooling và Npgsql đủ đáp ứng mục tiêu latency < 500 ms cho non-AI endpoints.

3. **Scope tăng thêm mà không có yêu cầu:** Capstone spec không yêu cầu cache layer; bổ sung Redis
   sẽ tăng độ phức tạp mà không làm thay đổi kết quả chấm điểm. Redis có thể được thêm vào sau
   defense khi scale-up production cần cache embedding results hoặc rate-limit state.

**Đánh đổi được chấp nhận:** Không có distributed locking cho embedding quota ngoài in-memory
`SemaphoreSlim`; chấp nhận được khi chỉ deploy single-instance.

**Tham chiếu code:** `Backend/Service/Implementations/EmbeddingService.cs`
(`EmbeddingQuotaLock` — in-memory `SemaphoreSlim`).

---

## 3. Vite + React (SPA) thay vì Next.js (SSR)

**Quyết định:** Frontend là Single-Page Application xây bằng React 19 + Vite 7 thay vì Next.js
với Server-Side Rendering.

**Lý do:**

1. **Không cần SSR cho author tool:** StoryRAG là ứng dụng phức tạp phía client — rich-text editor
   (`contentEditable`), real-time AI streaming, floating sidebar panels, drag-and-drop timeline.
   Đây là admin/author tool, không phải public content site; SEO không phải yêu cầu, và tất cả
   route đều được bảo vệ bởi JWT (`RouteGuard`, `RoleGuard`).

2. **Dev iteration nhanh hơn trong sprint ngắn:** Vite HMR (Hot Module Replacement) reload < 50 ms
   so với Next.js dev server thường > 2–3 giây cho project cùng size. Điều này quan trọng khi
   timeline sprint ngắn trước deadline capstone.

3. **Tránh abstraction không cần thiết:** Next.js App Router, server actions, và RSC (React Server
   Components) thêm learning curve và pattern phức tạp mà không mang lợi ích thực cho luồng
   backend-API-driven (`src/services/*.ts` → ASP.NET Core). Vite + React Router 7 đủ để implement
   toàn bộ routing và code-splitting cần thiết.

**Đánh đổi được chấp nhận:** First Contentful Paint (FCP) chậm hơn so với SSR do client-side
hydration; chấp nhận được vì target users là authors đã đăng nhập, không phải cold-visit từ
search engine.

**Tham chiếu code:** `Frontend/vite.config.ts`, `Frontend/src/App.tsx` (React Router),
`Frontend/src/components/RouteGuard.tsx`.

---

## 4. Payment System (PayOS / VNPay) — Overscope có chủ đích

**Quyết định:** Tích hợp payment gateway (PayOS + VNPay) vào capstone project, nằm ngoài
yêu cầu cứng của spec.

**Lý do:**

1. **SaaS-readiness demo:** Payment được đưa vào để chứng minh rằng sản phẩm có thể monetize thực
   tế ngay sau khi ra thị trường, không chỉ là prototype học thuật. Demo cho thấy luồng đầy đủ:
   chọn plan → tạo payment → webhook xác nhận → cập nhật subscription → giới hạn feature theo tier.

2. **Overscope có chủ đích và minh bạch:** Phần payment được nhận biết rõ là vượt requirement cứng
   và không được tính vào rubric điểm cốt lõi. Hội đồng được thông báo trước qua tài liệu này;
   nếu bị hỏi, câu trả lời là "bổ sung để demonstrate production-readiness, không phải để thay thế
   core requirement."

3. **Kiến trúc production-grade làm bằng chứng kỹ thuật:** Tích hợp bao gồm webhook signature
   verification, idempotency guard (`PaymentService`), trạng thái đơn đầy đủ (Pending → Completed
   → Refunded), và subscription tier enforcement — không phải mock stub. Đây là bằng chứng cụ thể
   cho khả năng xây dựng feature phức tạp ngoài scope.

**Đánh đổi được chấp nhận:** Tốn thêm ~1.5–2 ngày dev; không có automated test cho payment flow
do sandbox credential restrictions. Hội đồng có thể đặt câu hỏi tại sao overscope — tài liệu này
là câu trả lời chuẩn bị sẵn.

**Tham chiếu code:** `Backend/Api/Controllers/PaymentController.cs`,
`Backend/Service/Implementations/PaymentService.cs`,
`Backend/API_PAYMENT_DOCS.md`.

---

## Kết luận / Conclusion

Mỗi quyết định kỹ thuật ở trên đều được đưa ra với lý do rõ ràng dựa trên:
- **Scope thực tế của capstone** (< 1M vector, < 50 concurrent users, sprint 2–3 tháng)
- **Trade-off tường minh** giữa operational complexity và business value
- **Khả năng scale-up** sau defense nếu sản phẩm tiến vào production thực sự

Các quyết định này phản ánh tư duy engineering thực tế: chọn công cụ vừa đủ cho bài toán, không
over-engineer, và để lại con đường mở để nâng cấp khi có nhu cầu thực sự.

---

*Tài liệu này là phần bổ sung cho báo cáo capstone — phục vụ buổi bảo vệ.*  
*Phiên bản: 1.0 — Cập nhật: Tháng 4/2026*
