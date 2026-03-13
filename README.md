# StoryRAG

Nền tảng hỗ trợ sáng tác truyện tích hợp AI, sử dụng kỹ thuật **RAG (Retrieval-Augmented Generation)** — lưu nội dung dưới dạng vector embedding để AI có thể trả lời câu hỏi chính xác về bối cảnh, nhân vật, cốt truyện của chính tác giả.

---

## 📌 Trạng thái: Những thứ đã làm

### ✅ Backend (ASP.NET Core 8 — 3 Layers)

| Tính năng | Controller | Service | Trạng thái |
|-----------|------------|---------|------------|
| **Auth** (đăng ký/đăng nhập/JWT/refresh token) | `AuthController` | `AuthService` | ✅ Hoàn thành |
| **Quên/Reset mật khẩu** (Gmail SMTP) | `AuthController` | `EmailService` | ✅ Hoàn thành |
| **User profile** | `UserController` | `UserService` | ✅ Hoàn thành |
| **User settings** (font, size editor) | `UserSettingsController` | `UserSettingsService` | ✅ Hoàn thành |
| **CRUD dự án** + stats + export | `ProjectController` | `ProjectService` | ✅ Hoàn thành |
| **Chương + Phiên bản** (CRUD, pin, diff, import/export) | `ChapterController` | `ChapterService` | ✅ Hoàn thành |
| **Chunking** (cắt text ~1500 ký tự, overlap 150) | — | `ChunkingService` | ✅ Hoàn thành |
| **Embedding** (Gemini batchEmbedContents, vector 768) | — | `EmbeddingService` | ✅ Hoàn thành |
| **AI Chat RAG** (cosine search + Gemini) | `AiController` | `AiChatService` | ✅ Hoàn thành |
| **AI Rewrite** (viết lại đoạn văn) | `AiController` | `AiRewriteService` | ✅ Hoàn thành |
| **Phân tích AI** (rubric 100 điểm, 14 tiêu chí) | `AiController` | `ProjectReportService` | ✅ Hoàn thành |
| **Worldbuilding** (bối cảnh + embed) | `WorldbuildingController` | `WorldbuildingService` | ✅ Hoàn thành |
| **Characters** (nhân vật + embed) | `CharacterController` | `CharacterService` | ✅ Hoàn thành |
| **Subscription Plans** (CRUD gói, đăng ký, kiểm tra quota) | `SubscriptionController` | `SubscriptionService` | ✅ Hoàn thành |
| **Payment** (tạo, cập nhật status, lịch sử, refund) | `PaymentController` | `PaymentService` | ✅ Hoàn thành |
| **Bug Reports** (user gửi, staff xử lý) | `BugReportController` | `BugReportService` | ✅ Hoàn thành |
| **Admin** (thống kê user, project, subscription) | `AdminController` | `AdminService` | ✅ Hoàn thành |
| **Thể loại truyện** | `GenreController` | `GenreService` | ✅ Hoàn thành |
| **AES-256 Encryption** (mã hóa nội dung truyện) | — | Helpers | ✅ Hoàn thành |
| **Rate Limiting** (AI endpoints: chat/rewrite/analyze/embed) | `Program.cs` | — | ✅ Hoàn thành |
| **LM Studio fallback** (khi Gemini lỗi non-429) | — | `AiChatService` | ✅ Hoàn thành |
| **Swagger + JWT Auth** | `Program.cs` | — | ✅ Hoàn thành |
| **Deploy config** (Render + Docker) | `render.yaml`, `Dockerfile` | — | ✅ Hoàn thành |
| **Database** (PostgreSQL + pgvector trên Supabase) | — | EF Core 9 + 17 Migrations | ✅ Hoàn thành |

### ✅ Frontend (React 19 + TypeScript + Vite 7)

| Tính năng | Page/Component | Trạng thái |
|-----------|----------------|------------|
| **Landing Page** | `LandingPage.tsx` | ✅ Hoàn thành |
| **Auth** (Login + Register — chung 1 page) | `AuthPage.tsx` | ✅ Hoàn thành |
| **Quên mật khẩu** | `ForgotPasswordPage.tsx` | ✅ Hoàn thành |
| **Reset mật khẩu** | `ResetPasswordPage.tsx` | ✅ Hoàn thành |
| **Trang chủ / Dashboard** | `HomePage.tsx` | ✅ Hoàn thành |
| **Danh sách dự án** (card kiểu sách) | `ProjectsPage.tsx` | ✅ Hoàn thành |
| **Workspace Editor** (auto-save, rich text, word count) | `WorkspacePage.tsx` | ✅ Hoàn thành |
| **AI Chat panel** (trong Workspace) | `WorkspacePage.tsx` | ✅ Hoàn thành |
| **Version History** (pin, compare diff, switch) | `WorkspacePage.tsx` | ✅ Hoàn thành |
| **AI Rewrite** (bôi đen → viết lại) | `RewritePanel.tsx` | ✅ Hoàn thành |
| **Worldbuilding + Characters** (trong Workspace) | `WorkspacePage.tsx` | ✅ Hoàn thành |
| **Phân tích AI** (rubric 100 điểm) | `AnalysisPage.tsx` | ✅ Hoàn thành |
| **Subscription** (xem gói hiện tại) | `SubscriptionPage.tsx` | ✅ Hoàn thành |
| **Plans** (chọn gói) | `PlansPage.tsx` | ✅ Hoàn thành |
| **Profile** | `ProfilePage.tsx` | ✅ Hoàn thành |
| **Settings** (cài đặt editor) | `SettingsPage.tsx` | ✅ Hoàn thành |
| **Admin Dashboard** (thống kê + quản lý user) | `AdminDashboardPage.tsx` | ✅ Hoàn thành |
| **Admin Subscription** (quản lý gói) | `AdminSubscriptionPage.tsx` | ✅ Hoàn thành |
| **Staff Dashboard** (xử lý bug reports) | `StaffDashboardPage.tsx` | ✅ Hoàn thành |
| **Privacy Policy** | `PrivacyPolicyPage.tsx` | ✅ Hoàn thành |
| **404 Not Found** | `NotFoundPage.tsx` | ✅ Hoàn thành |
| **Sidebar + Topbar** (collapse/expand, theme toggle) | `Sidebar.tsx`, `Topbar.tsx` | ✅ Hoàn thành |
| **Toast notifications** | `Toast.tsx` | ✅ Hoàn thành |
| **Dark/Light theme** (Warm Parchment × Midnight Ink) | CSS Variables | ✅ Hoàn thành |
| **14 API services** | `services/*.ts` | ✅ Hoàn thành |

### ✅ Hạ tầng & Bảo mật

- ✅ JWT Bearer Token + Refresh Token
- ✅ AES-256 encryption cho nội dung truyện (mỗi user 1 DEK)
- ✅ Rate Limiting (SlidingWindow) cho tất cả AI endpoints
- ✅ CORS cấu hình linh hoạt
- ✅ Render deploy config (Docker)
- ✅ Retry logic cho Gemini API (backoff 10s → 30s → 65s khi 429)
- ✅ Roles: Author / Staff / Admin

---

## 🔲 Trạng thái: Những thứ CẦN LÀM

### 🔴 Ưu tiên cao

| # | Tính năng | Mô tả | Nơi ảnh hưởng |
|---|-----------|-------|---------------|
| 1 | **Route Guards / Protected Routes** | Chưa có kiểm tra auth ở frontend routes — ai cũng vào được bất kỳ trang nào | `App.tsx` |
| 2 | **Refresh Token handling** ở Frontend | Backend hỗ trợ refresh token nhưng frontend chưa tự động refresh khi token hết hạn — user bị logout đột ngột | `api.ts` (interceptor) |
| 3 | **Payment integration thực tế** | Backend có `PaymentController` + `PaymentService` đầy đủ nhưng frontend **chưa có** `paymentService.ts` — chưa tích hợp cổng thanh toán nào (VNPay/Momo/Stripe) | Frontend + Backend |
| 4 | **Tách `WorkspacePage.tsx`** | File ~176KB, quá lớn — nên tách thành sub-components (EditorPanel, ChapterSidebar, AiChatPanel, VersionHistoryPanel, WorldbuildingPanel...) | `WorkspacePage.tsx` |
| 5 | **Dọn dẹp file trùng lặp** | Có cả `LoginPage.tsx` (16KB) và `RegisterPage.tsx` (28KB) nhưng không dùng — `App.tsx` chỉ dùng `AuthPage.tsx` | `pages/` |

### 🟡 Ưu tiên trung bình

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 6 | **Admin route protection** | Admin đã ẩn sidebar items cho "Projects"/"Analysis" nhưng chưa block truy cập trực tiếp qua URL |
| 7 | **Error handling thống nhất** | Frontend chưa có global error boundary, mỗi page tự handle error riêng |
| 8 | **Loading states / Skeleton UI** | Một số page chưa có loading skeleton khi fetch data |
| 9 | **Responsive design** | Một số page có thể chưa tối ưu cho mobile |
| 10 | **Import/Export toàn bộ dự án** | Backend hỗ trợ export project nhưng frontend chưa có UI rõ ràng |

### 🟢 Ưu tiên thấp (Nice-to-have)

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 11 | **Unit Tests / Integration Tests** | Chưa có test nào (cả backend lẫn frontend) |
| 12 | **CI/CD Pipeline** | Chưa có GitHub Actions hoặc pipeline tự động nào |
| 13 | **Logging & Monitoring** | Chỉ có logging cơ bản qua `ILogger`, chưa có monitoring/alerting |
| 14 | **PWA / Offline support** | Chưa hỗ trợ offline editing |
| 15 | **Collaboration** (multi-user editing) | Chưa hỗ trợ nhiều người cùng chỉnh sửa |
| 16 | **Notification system** (in-app) | Chưa có hệ thống thông báo real-time |
| 17 | **Dọn file tạm** | `Frontend/temp.py`, `Frontend/temp.cjs`, `Frontend/front_build*.log` — nên xóa hoặc thêm vào `.gitignore` |

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite 7, TailwindCSS 4, Axios, Framer Motion, Lucide React, React Router DOM 7, React Hook Form |
| **Backend** | ASP.NET Core (.NET 8), Entity Framework Core 9, Swashbuckle (Swagger) |
| **Database** | PostgreSQL + pgvector (Supabase) |
| **AI** | Google Gemini API (primary), LM Studio (fallback) |
| **Auth** | JWT Bearer + Refresh Token |
| **Security** | AES-256 encryption, Rate Limiting |
| **Email** | MailKit (Gmail SMTP) |
| **Deploy** | Render (Docker) |

---

## 🔄 RAG Pipeline

```
Ctrl+S / Lưu
    ↓
[1] Lưu nội dung chương (active version)
    ↓ (ngầm)
[2] Chunk — cắt text thành đoạn ~1500 ký tự, overlap 150
    ↓
[3] Embed — batchEmbedContents → vector 768 chiều → lưu pgvector

Hỏi AI
    ↓
[4] Embed câu hỏi → vector
    ↓
[5] Cosine search — TopK chunks chỉ của active version
         + worldbuilding + characters
    ↓
[6] Gemini trả lời dựa trên context chunks
```

---

## 📊 Database Schema

```
Users ──< Projects ──< Chapters ──< ChapterVersions ──< ChapterChunks (vector 768)
  │           │              └── [IsPinned, IsChunked, IsEmbedded]
  │           ├──< ProjectGenres >── Genres
  │           ├──< WorldbuildingEntries  (vector 768)
  │           ├──< CharacterEntries     (vector 768)
  │           ├──< ProjectReports       (rubric 100 điểm)
  │           ├──< AiChatMessages       (mã hóa)
  │           └──< RewriteHistories     (mã hóa)
  │
  ├──< UserSubscriptions >── SubscriptionPlans
  ├──< Payments
  ├──< BugReports
  └──1 UserSettings
```

---

## 🚀 Khởi chạy

```bash
# Backend
cd Backend
dotnet restore
dotnet ef database update --project Repository --startup-project Api
dotnet run --project Api
# → http://localhost:5105 | Swagger: http://localhost:5105/swagger

# Frontend
cd Frontend
npm install
npm run dev
# → http://localhost:5173
```

> **LM Studio (tuỳ chọn):** Chỉ cần nếu muốn có fallback khi Gemini gặp lỗi non-429. Tải model, bật server tại `http://localhost:1234`.
