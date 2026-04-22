# Tài liệu Luồng Hệ thống (System Flows) - StoryRAG

Tài liệu này ghi chú lại các luồng tính năng (Feature Flows) chính trong hệ thống StoryRAG, mô tả đường đi của dữ liệu từ Frontend (FE) xuống Backend (BE) và cách các tác vụ ngầm (Background Jobs) hoạt động.

---

## 1. Luồng Xác thực và Bảo mật (Authentication & Security Flow)
**Mục tiêu:** Cấp phát token cho người dùng và bảo mật dữ liệu văn bản bằng mã hóa đầu cuối (E2E Encryption).
- **FE:** Gửi yêu cầu Đăng ký / Đăng nhập (`AuthPage.tsx`).
- **BE:** `AuthController` tiếp nhận.
  - Sử dụng khóa bí mật (MasterKey) trong C# để tạo **Data Encryption Key (DEK)** riêng biệt cho từng User.
  - Lưu và trả về **JWT Token** mang thông tin User cho Frontend.
- **FE:** Lưu JWT vào Local Storage, tự động đưa vào header `Authorization: Bearer <token>` trong các API gọi sau đó.

## 2. Luồng Trình soạn thảo văn bản (Workspace Editor Flow)
**Tên chức năng:** Autosave & Versioning (Tự động lưu và Quản lý phiên bản)
- **FE (`WorkspacePage.tsx`):**
  - Người dùng gõ text vào vùng soạn thảo `contentEditable`.
  - Frontend áp dụng Debounce (đợi người dùng ngưng gõ vài giây) -> gọi hàm `doSave()`.
  - Content của editor được đọc theo định dạng `innerHTML` để giữ Bold, Italic, v.v.
- **BE (`ChapterService.cs`):** 
  - `UpdateChapterAsync` lấy nội dung từ FE, đem mã hóa bằng DEK của người dùng.
  - Cập nhật số lượng từ (Word Count) và Token.
  - Đặt cờ hiệu `IsChunked = false` và `IsEmbedded = false` để đánh dấu thư mục cập nhật.
  - Dữ liệu mã hóa được đẩy xuống PostgreSQL qua Entity Framework.

## 3. Luồng AI Embedding (Nhúng dữ liệu AI - Background Flow)
**Tên chức năng:** Chunking & Vector Embedding
- **FE:** Nhận lại chu kỳ `Math.max(45000, thời_gian_trễ)`, tự động gọi API `/chunk` và `/embed` để báo server đồng bộ hóa AI.
- **BE (`AiController.cs` & `ChapterService.cs`):**
  - **Băm nhỏ văn bản (Chunking):** Lấy đoạn truyện lớn mã hóa -> Giải mã -> Cắt nhỏ thành từng cụm (~1000 - 2000 ký tự) -> Lưu vào bảng `ChapterChunks`.
  - **Nhúng dữ liệu ngầm (Fire-and-forget Background Task):** API Controller phản hồi lập tức dạng `202 Accepted` cho Frontend để tránh bị Timeout ngắt kết nối.
  - **BE (`EmbeddingService.cs`):** Tiến trình ngầm gọi API lên Google Gemini, kết hợp với cơ chế Khóa vòng lặp (`EmbeddingQuotaLock`) và tính toán `ReserveEmbeddingQuota` qua Time Window để không vượt qua Limit (Ví dụ 60.000 TPM của Gemini).
  - Kết quả Vector (768 chiều) được âm thầm cập nhật vào `ChapterChunks` dưới database.

## 4. Luồng tính năng Hỗ trợ Cảnh & Mọi thứ AI (AI Native Features)
Hệ thống cung cấp hàng loạt công cụ RAG / AI Writing.

### 4.1. AI Khai triển / Viết tiếp (Continue Writing)
- **FE:** Lấy 1500 ký tự cuối cùng ngay tại con trỏ. Nhấn phím nóng / Nút "AI Viết tiếp".
- **BE (`AiWritingService.cs`):** Truyền prompt "Hãy viết tiếp mạch truyện này một cách tự nhiên" sang LLM (Gemini/OpenAI).
- **FE:** Streamed hoặc hiển thị chèn trực tiếp câu chữ mới vào editor.

### 4.2. Khám phá Cốt truyện (Cliffhanger & Scene Analysis)
- **Tên chức năng:** `AnalyzeScenes` / `AnalyzeCliffhanger`
- **FE (`SceneCliffhangerPanel.tsx`):** Bấm nút phân tích toàn chương. Gọi API `/analyze/scenes`.
- **BE:** Đẩy nội dung cho AI bóc tách Cảnh (Scenes) chứa Quotes (Trích dẫn chính xác).
- **Lịch sử:** Kết quả JSON được lưu vào `AiAnalysisHistory` để người dùng xem lại.
- **Tương tác UI:** FE dùng hàm tìm kiếm `ExactQuote` để tiêm các thẻ Highlight HTML (`mark.ai-highlight`) vào Editor, hỗ trợ click hoặc hover đổi màu giao diện truyện.

### 4.3. Story Bible (Tài liệu cốt truyện)
- Phân hệ gồm: Character, Worldbuilding, Timeline Event, Idea Note.
- Tất cả đều được Frontend hiển thị trên Floating Chat (sidebar). Các thẻ này khi được tạo đều được mã hóa bằng thuật toán `EncryptionHelper` qua `DEK` trước khi vào DB, đảm bảo bảo mật ngang hàng với chương chính.

## 5. Luồng Đánh giá Dự án (Big Report Generation Job)
**Tên chức năng:** 100-Point Project Rubric Analysis (Phân tích tổng lực 100 điểm)
- **FE:** Ở trang Dashboard, chọn "Phân tích Dự án".
- **BE (`AnalysisJobQueue` & `ProjectAnalysisJobService`):**
  - Đây là Job quá lớn để chạy trực tiếp (kéo dài cả tiếng đồng hồ nếu truyện dài).
  - C# đẩy job vào Background Channel (`AnalysisJobQueue.cs`).
  - Phản hồi `202 Accepted` kèm theo JobId.
  - Trình worker ngầm lấy toàn bộ các chương đã Embed -> Tiến hành chấm dứt điểm từng tiêu chí (Character, Plot, Pacing, Style) -> Kết xuất Report lớn định dạng JSON.
- **FE:** Sử dụng cơ chế Long-polling hoặc Fetch lại trạng thái `GetActiveAnalyzeJob` 10s/lần để vẽ thanh ProgressBar.

## 6. Luồng Xóa Dữ Liệu (Deletion Flows)
**Tên chức năng:** Soft Delete vs Hard Delete
- **Xóa Dự án (Delete Project):** Chức năng `Soft Delete`. Hàm `ProjectService.DeleteProjectAsync` chỉ đổi trạng thái `project.IsDeleted = true`. Phục hồi được.
- **Xóa Chương / Phiên bản (Delete Chapter/Version):** Chức năng `Hard Delete`. Hàm `DeleteChapterAsync` gọi Entity Framework `.RemoveRange()`, càn quét và xóa vĩnh viễn dữ liệu nhúng (Chunks, Embeddings, Lịch sử) để làm sạch RAG Garbage Context. Không phục hồi được.

---
*Tài liệu này đóng vai trò như một bản thiết kế tóm lược luồng dữ liệu (Data Flow Diagram - Text Version).*
