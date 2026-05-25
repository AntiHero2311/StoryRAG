# Tài liệu Luồng Hệ thống (System Flows) - StoryRAG

Tài liệu này ghi chú lại các luồng tính năng (Feature Flows) chính trong hệ thống StoryRAG, mô tả đường đi của dữ liệu từ Frontend (FE) xuống Backend (BE) và cách các tác vụ ngầm (Background Jobs) hoạt động.

---

## 1. Luồng Xác thực và Bảo mật (Authentication & Security Flow)
**Mục tiêu:** Cấp phát token cho người dùng và bảo mật dữ liệu văn bản bằng mã hóa đầu cuối (E2E Encryption).
- **FE:** Gửi yêu cầu Đăng ký / Đăng nhập / Google Login (`AuthPage.tsx`).
- **BE:** `AuthController` tiếp nhận.
  - Sử dụng khóa bí mật (MasterKey) trong C# để tạo **Data Encryption Key (DEK)** riêng biệt cho từng User.
  - Lưu và trả về **JWT Access Token** + **Refresh Token** mang thông tin User cho Frontend.
  - Endpoint `POST /api/Auth/refresh` xoay vòng Refresh Token và cấp Access Token mới khi phiên cũ hết hạn.
- **FE:** Lưu JWT vào Local Storage, tự động đưa vào header `Authorization: Bearer <token>` trong các API gọi sau đó.
- **FE:** Axios interceptor tự gọi refresh và retry request một lần khi nhận `401`.
- **Ghi chú:** Code hiện có `forgot-password` / `reset-password`, nhưng chưa có endpoint xác thực email bắt buộc sau đăng ký.

## 2. Luồng Trình soạn thảo văn bản (Workspace Editor Flow)
**Tên chức năng:** Autosave & Versioning (Tự động lưu và Quản lý phiên bản)
- **FE (`WorkspacePage.tsx`):**
  - Người dùng gõ text vào vùng soạn thảo `contentEditable`.
  - Frontend áp dụng Debounce khoảng 4 giây -> gọi hàm `doSave()`.
  - Content của editor được đọc theo định dạng `innerHTML` để giữ Bold, Italic, v.v.
- **BE (`ChapterService.cs`):** 
  - `UpdateChapterAsync` lấy nội dung từ FE, đem mã hóa bằng DEK của người dùng.
  - Cập nhật số lượng từ (Word Count) và Token.
  - Đặt cờ hiệu `IsChunked = false` và `IsEmbedded = false` để đánh dấu thư mục cập nhật.
  - Dữ liệu mã hóa được đẩy xuống PostgreSQL qua Entity Framework.

## 3. Luồng AI Embedding (Nhúng dữ liệu AI - Background Flow)
**Tên chức năng:** Chunking & Vector Embedding
- **FE:** Sau khi lưu nội dung, `WorkspacePage.tsx` đưa chương vào hàng đợi auto-embed nội bộ khoảng 5 giây, rồi gọi một endpoint duy nhất `POST /api/ai/chapters/{chapterId}/embed`.
- **BE (`AiController.cs`, `EmbeddingService.cs` & `ChapterService.cs`):**
  - **Băm nhỏ văn bản (Chunking):** Lấy đoạn truyện lớn mã hóa -> Giải mã -> Cắt nhỏ thành từng cụm (~1000 - 2000 ký tự) -> Lưu vào bảng `ChapterChunks`.
  - **Nhúng dữ liệu đồng bộ theo request:** API chờ `EmbedChapterAsync` hoàn tất rồi trả `200 OK`, để UI có thể cập nhật trạng thái `Chunked/Embedded` ngay.
  - **BE (`EmbeddingService.cs`):** Gọi Google Gemini Embedding API, có rate limit `AiEmbed` ở API layer.
  - Kết quả Vector (768 chiều) được cập nhật vào `ChapterChunks`, đồng thời active `ChapterVersion` được đánh dấu đã chunk/embed.

## 4. Luồng tính năng Hỗ trợ Cảnh & Mọi thứ AI (AI Native Features)
Hệ thống cung cấp hàng loạt công cụ RAG / AI Writing.

### 4.1. AI Khai triển / Viết tiếp (Continue Writing)
- **FE:** Lấy 1500 ký tự cuối cùng ngay tại con trỏ. Nhấn phím nóng / Nút "AI Viết tiếp".
- **BE (`AiWritingService.cs`):** Truyền prompt "Hãy viết tiếp mạch truyện này một cách tự nhiên" sang LLM (Gemini/OpenAI).
- **FE:** Nhận kết quả trả về từ endpoint `POST /api/ai/{projectId}/continue`, sau đó người dùng có thể chèn vào editor.

### 4.2. Khám phá Cốt truyện (Cliffhanger & Scene Analysis)
- **Tên chức năng:** `AnalyzeScenes` / `AnalyzeCliffhanger`
- **FE (`SceneCliffhangerPanel.tsx`):** Bấm nút phân tích toàn chương. Gọi API `/analyze/scenes`.
- **BE:** Đẩy nội dung cho AI bóc tách Cảnh (Scenes) chứa Quotes (Trích dẫn chính xác).
- **Lịch sử:** Kết quả JSON được lưu vào `AiAnalysisHistory` để người dùng xem lại.
- **Tương tác UI:** FE dùng hàm tìm kiếm `ExactQuote` để tiêm các thẻ Highlight HTML (`mark.ai-highlight`) vào Editor, hỗ trợ click hoặc hover đổi màu giao diện truyện.

### 4.3. Story Bible (Tài liệu cốt truyện)
- Phân hệ gồm: Character, Worldbuilding, Plot Notes, Themes, Style Guides và Timeline Events.
- Tất cả đều được Frontend hiển thị trên Floating Chat (sidebar). Các thẻ này khi được tạo đều được mã hóa bằng thuật toán `EncryptionHelper` qua `DEK` trước khi vào DB, đảm bảo bảo mật ngang hàng với chương chính.

## 5. Luồng Đánh giá Dự án (Big Report Generation Job)
**Tên chức năng:** 100-Point Project Rubric Analysis (Phân tích tổng lực 100 điểm)
- **FE:** ở `AnalysisPage.tsx`, chọn phân tích dự án.
- **BE (`AnalysisJobQueue` & `ProjectAnalysisJobService`):**
  - Đây là Job quá lớn để chạy trực tiếp (kéo dài cả tiếng đồng hồ nếu truyện dài).
  - C# đẩy job vào Background Queue ưu tiên (`AnalysisJobQueue.cs`), mỗi user chỉ có tối đa 1 job active.
  - Worker ưu tiên lấy job theo tier gói subscription trước, sau đó theo thời điểm tạo.
  - Phản hồi `202 Accepted` kèm theo JobId và `ProjectVersionHash` snapshot của toàn bộ bộ truyện.
  - Trước khi chấm rubric, backend chốt snapshot active của toàn bộ truyện; nếu chapter nào chưa chunk/embed đủ thì worker sẽ báo rõ chapter đó, tự repair rồi mới tiếp tục.
  - Trình worker ngầm lấy toàn bộ các chương đã embed của snapshot đó → Tiến hành chấm điểm từng tiêu chí (Character, Plot, Pacing, Style) → Kết xuất Report lớn định dạng JSON.
  - AI phát hiện **6 cảnh báo đặc biệt** (lưu trong mảng `warnings[]` của `CriteriaJson`):
    | Code | Severity | Ý nghĩa |
    |------|----------|----------|
    | `INCOMPLETE` | WARNING | Truyện bị dừng đột ngột, chưa có kết thúc |
    | `REPETITION` | WARNING | Lặp lại đoạn văn y hệt |
    | `PLAGIARISM_RISK` | CRITICAL | Nghi đạo nhái tác phẩm khác |
    | `INCONSISTENCY` | INFO–CRITICAL | Mâu thuẫn logic/nhân vật |
    | `SEXUAL_CONTENT` | WARNING/CRITICAL | Nội dung tình dục không phù hợp |
    | `ANTI_STATE` | CRITICAL | Nội dung chính trị nhạy cảm / xuyên tạc |
- **FE:** Sử dụng cơ chế Long-polling hoặc Fetch lại trạng thái `GetActiveAnalyzeJob` 10s/lần để vẽ thanh ProgressBar, đồng thời hiển thị stage chi tiết khi worker đang repair chunk/embed.
- **Staff Review gate:** Sau khi AI hoàn tất, report vào trạng thái `ReviewStatus = PendingStaffReview`; user nhận thông báo "đang kiểm tra bước cuối cùng".
- **Staff Review — luồng chi tiết:**
  1. Lấy danh sách chờ: `GET /api/staff/analyses/pending`
  2. Xem report + cờ AI: `GET /api/staff/analyses/{reportId}` (criteria, warnings[], overallFeedback)
  3. Đọc bản thảo (**read-only**): `GET /api/staff/analyses/{reportId}/story` — hiển thị qua Wide Reader Modal (3 theme, font controls)
  4. Xem review cũ: `GET /api/staff/analyses/{reportId}/review`
  5. Hành động:
     - **Duyệt OK:** `POST /review` với `Action=Verified` → `ReviewStatus=Released`
     - **Chỉnh sửa văn bản:** `PATCH /edit` + nội dung mới + `releaseToUser=true/false`
     - **Chạy lại AI:** `POST /review` với `Action=RerunRequested` (chỉ dùng khi INCOMPLETE/Failed)
- **GetFlagReason — thứ tự ưu tiên** (xuất hiện ở `/api/staff/manuscripts/flagged`):
  1. `ANTI_STATE` — pháp lý nghiêm trọng nhất
  2. `SEXUAL_CONTENT` — vi phạm chính sách nội dung
  3. `PLAGIARISM_RISK` — vi phạm bản quyền
  4. `INCOMPLETE_STORY` — AI cắm INCOMPLETE
  5. `INCONSISTENCY_DETECTED` — AI cắm INCONSISTENCY
  6. `LOW_QUALITY_SCORE` — Tổng điểm < 60
  7. `INCOMPLETE_ANALYSIS` — Job Failed/Pending
  8. `NO_ANALYSIS` — Chưa có report nào

## 6. Luồng Xóa Dữ Liệu (Deletion Flows)
**Tên chức năng:** Soft Delete vs Hard Delete
- **Xóa Dự án (Delete Project):** Chức năng `Soft Delete`. Hàm `ProjectService.DeleteProjectAsync` chỉ đổi trạng thái `project.IsDeleted = true`. Phục hồi được.
- **Lưu ý hiện tại:** Code có soft delete cho project nhưng chưa có endpoint restore công khai.
- **Xóa Chương / Phiên bản (Delete Chapter/Version):** Chức năng `Hard Delete`. Hàm `DeleteChapterAsync` gọi Entity Framework `.RemoveRange()`, càn quét và xóa vĩnh viễn dữ liệu nhúng (Chunks, Embeddings, Lịch sử) để làm sạch RAG Garbage Context. Không phục hồi được.

---
*Tài liệu này đóng vai trò như một bản thiết kế tóm lược luồng dữ liệu (Data Flow Diagram - Text Version).*
