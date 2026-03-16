# StoryRAG

Nền tảng hỗ trợ sáng tác truyện tích hợp AI, sử dụng kỹ thuật **RAG (Retrieval-Augmented Generation)** — lưu nội dung dưới dạng vector embedding để AI có thể trả lời câu hỏi chính xác về bối cảnh, nhân vật, cốt truyện của chính tác giả.

---

## 🚀 Khởi chạy nhanh

```bash
# Backend
cd Backend
dotnet restore
dotnet run --project Api
# → http://localhost:5105 | Swagger: http://localhost:5105/swagger

# Frontend
cd Frontend
npm install
npm run dev
# → http://localhost:5173
```

> **Database:** Chạy `Backend/supabase_full_reset.sql` trên Supabase SQL Editor để khởi tạo toàn bộ schema + seed data. EF Migrations history đã được ghi sẵn, không cần chạy `dotnet ef database update`.

> **LM Studio (tuỳ chọn):** Fallback khi Gemini gặp lỗi non-429. Tải model, bật server tại `http://localhost:1234`.

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite 7, TailwindCSS 4, Axios, Lucide React, React Router DOM 7 |
| **Backend** | ASP.NET Core (.NET 8), Entity Framework Core 9 |
| **Database** | PostgreSQL + pgvector (Supabase) |
| **AI** | Google Gemini API (primary), LM Studio (fallback) |
| **Auth** | JWT Bearer + Refresh Token |
| **Security** | AES-256 encryption, Rate Limiting (SlidingWindow) |
| **Email** | MailKit (Gmail SMTP) |
| **Deploy** | Render (Docker) |

---

## 📊 Database Schema

```
Users ──< Projects ──< Chapters ──< ChapterVersions ──< ChapterChunks (vector 768)
  │           │
  │           ├──< ProjectGenres >── Genres
  │           ├──< WorldbuildingEntries  (vector 768)  — Bối cảnh thế giới
  │           ├──< CharacterEntries      (vector 768)  — Nhân vật
  │           ├──< StyleGuideEntries     (vector 768)  — Phong cách viết
  │           ├──< ThemeEntries          (vector 768)  — Chủ đề tác phẩm
  │           ├──< PlotNoteEntries       (vector 768)  — Ghi chú cốt truyện
  │           ├──< ProjectReports        — Rubric 100 điểm
  │           ├──< ChatMessages          — Lịch sử AI chat
  │           └──< RewriteHistories      — Lịch sử viết lại
  │
  ├──< UserSubscriptions >── SubscriptionPlans
  ├──< Payments
  ├──< BugReports
  └──1 UserSettings
```

---

## 🔄 RAG Pipeline

```
Ctrl+S / Lưu
    ↓
[1] Lưu nội dung chương
    ↓ (ngầm)
[2] Chunk — cắt text thành đoạn ~1500 ký tự, overlap 150
    ↓
[3] Embed — batchEmbedContents → vector 768 chiều → lưu pgvector

Hỏi AI
    ↓
[4] Embed câu hỏi → vector
    ↓
[5] Cosine search — TopK chunks của active version
          + worldbuilding + characters + StyleGuide + Theme + PlotNote
    ↓
[6] Gemini trả lời dựa trên context chunks
```

**Context Tables cho AI Phân tích:**

| Bảng | Hỗ trợ tiêu chí | Ví dụ dữ liệu |
|------|-----------------|---------------|
| `WorldbuildingEntries` | Nhóm 8 — Xây dựng thế giới | Địa điểm, ma thuật, lịch sử |
| `CharacterEntries` | Nhóm 2 — Nhân vật | Tính cách, backstory, quan hệ |
| `StyleGuideEntries` | Nhóm 4 — Ngôn ngữ & phong cách | POV, giọng văn, từ vựng |
| `ThemeEntries` | Nhóm 7 — Chủ đề | Chủ đề trọng tâm, cách thể hiện |
| `PlotNoteEntries` | Nhóm 3, 5 — Cốt truyện & Cuốn hút | Arc, conflict, foreshadowing |

---

## ✅ Tính năng đã hoàn thành

### Backend (ASP.NET Core 8)

| Tính năng | Controller | Service |
|-----------|------------|---------|
| Auth (đăng ký/đăng nhập/JWT/refresh token) | `AuthController` | `AuthService` |
| Quên/Reset mật khẩu (Gmail SMTP) | `AuthController` | `EmailService` |
| User profile + settings | `UserController` | `UserService`, `UserSettingsService` |
| CRUD dự án + stats | `ProjectController` | `ProjectService` |
| Chương + Phiên bản (CRUD, diff, import/export) | `ChapterController` | `ChapterService` |
| Chunking (~1500 ký tự, overlap 150) | — | `ChunkingService` |
| Embedding (Gemini batchEmbedContents, vector 768) | — | `EmbeddingService` |
| AI Chat RAG | `AiController` | `AiChatService` |
| AI Rewrite | `AiController` | `AiRewriteService` |
| Phân tích AI (rubric 100 điểm, 8 nhóm tiêu chí) | `AiController` | `ProjectReportService` |
| Worldbuilding + embed | `WorldbuildingController` | `WorldbuildingService` |
| Characters + embed | `CharacterController` | `CharacterService` |
| **StyleGuide + embed** | `StyleGuideController` | `StyleGuideService` |
| **Theme + embed** | `ThemeController` | `ThemeService` |
| **PlotNote + embed** | `PlotNoteController` | `PlotNoteService` |
| Subscription Plans | `SubscriptionController` | `SubscriptionService` |
| Payment (tạo, lịch sử, refund) | `PaymentController` | `PaymentService` |
| Bug Reports | `BugReportController` | `BugReportService` |
| Admin (thống kê, quản lý user) | `AdminController` | `AdminService` |
| Thể loại truyện (Genres) | `GenreController` | `GenreService` |
| AES-256 Encryption + Rate Limiting | `Program.cs` | Helpers |

### Frontend (React 19 + TypeScript + Vite 7)

| Tính năng | File |
|-----------|------|
| Landing Page | `LandingPage.tsx` |
| Auth (Login/Register) | `AuthPage.tsx` |
| Quên/Reset mật khẩu | `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` |
| Trang chủ / Dashboard | `HomePage.tsx` |
| Danh sách dự án | `ProjectsPage.tsx` |
| Workspace Editor (auto-save, rich text) | `WorkspacePage.tsx` |
| AI Chat panel + Lịch sử | `ChatPanel.tsx`, `ChatHistoryPanel.tsx` |
| Version History (compare diff) | `WorkspacePage.tsx` |
| AI Rewrite (bôi đen → viết lại) | `RewritePanel.tsx` |
| Worldbuilding, Characters panels | `WorkspacePage.tsx` |
| **StyleGuide, Theme, PlotNote panels** | `WorkspacePage.tsx` |
| Phân tích AI (rubric 100 điểm) | `AnalysisPage.tsx` |
| Subscription + Plans | `SubscriptionPage.tsx`, `PlansPage.tsx` |
| Profile, Settings, Privacy Policy | `ProfilePage.tsx`, `SettingsPage.tsx` |
| Admin Dashboard + Subscription | `AdminDashboardPage.tsx`, `AdminSubscriptionPage.tsx` |
| Staff Dashboard (bug reports) | `StaffDashboardPage.tsx` |
| Dark/Light theme | CSS Variables |

---

## 🔲 Cần làm

### 🔴 Ưu tiên cao

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1 | **Route Guards** | Frontend chưa kiểm tra auth; ai cũng vào được mọi route |
| 2 | **Refresh Token (Frontend)** | Backend hỗ trợ nhưng frontend chưa tự động refresh — user bị logout đột ngột |
| 3 | **Payment Integration** | `PaymentController` có sẵn nhưng chưa tích hợp cổng nào (VNPay/Momo/Stripe) |

### 🟡 Ưu tiên trung bình

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 4 | **Admin route protection** | Ẩn sidebar items nhưng chưa block truy cập trực tiếp qua URL |
| 5 | **Global error boundary** | Mỗi page tự handle error riêng |
| 6 | **Responsive design** | Một số page chưa tối ưu cho mobile |
| 7 | **Dọn file trùng lặp** | `LoginPage.tsx`, `RegisterPage.tsx` không dùng; `temp.py`, `temp.cjs`, log files |

### 🟢 Nice-to-have

| # | Tính năng |
|---|-----------|
| 8 | Unit Tests / Integration Tests |
| 9 | CI/CD Pipeline (GitHub Actions) |
| 10 | Logging & Monitoring |
| 11 | PWA / Offline support |
| 12 | Collaboration (multi-user editing) |

---

## 🏗️ Cấu trúc thư mục

```
StoryRAG/
├── Backend/
│   ├── Api/              — Controllers, Program.cs, appsettings
│   ├── Service/          — Business logic (Interfaces + Implementations + DTOs)
│   ├── Repository/       — Entities, DbContext, Migrations
│   └── supabase_full_reset.sql  — Schema + seed data (chạy 1 lần trên Supabase)
└── Frontend/
    └── src/
        ├── pages/        — Các trang chính
        ├── components/   — Components tái sử dụng
        ├── services/     — API client (axios)
        ├── hooks/        — Custom hooks
        └── utils/        — JWT helper, formatters
```
