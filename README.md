# StoryRAG

Nền tảng hỗ trợ sáng tác truyện tích hợp AI, sử dụng kỹ thuật **RAG (Retrieval-Augmented Generation)** — lưu nội dung dưới dạng vector embedding để AI có thể trả lời câu hỏi chính xác về bối cảnh, nhân vật, cốt truyện của chính tác giả.

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **Editor** | Workspace soạn thảo với auto-save, rich text (bold/italic/underline), word count |
| **Lịch sử phiên bản** | Git-style versioning — tạo, ghim, so sánh diff, khôi phục các version của chương |
| **Auto Embed** | Lưu chương → tự động chunk + embed ngầm → AI sẵn sàng ngay |
| **AI Chat (RAG)** | Hỏi AI về nội dung truyện dựa trên vector search — chỉ tốn token, không tốn lượt phân tích |
| **AI Rewrite** | Bôi đen đoạn văn → nhờ AI viết lại → xem lịch sử thay đổi |
| **Phân tích AI** | Chấm điểm bản thảo theo rubric 100 điểm (14 tiêu chí, 5 nhóm) có tính mức độ hoàn thiện |
| **Worldbuilding** | Quản lý bối cảnh, nhân vật — được embed vector và đưa vào context khi hỏi AI |
| **Import / Export** | Import `.txt` vào chương, export chương hoặc toàn bộ dự án ra file |
| **Báo cáo lỗi** | User gửi bug report → Staff xử lý qua dashboard riêng |
| **Quên mật khẩu** | Gửi link reset qua email (Gmail SMTP / MailKit) |
| **Admin thống kê** | Tổng quan hệ thống: users, projects, subscriptions |
| **Gói đăng ký** | Free / Basic / Pro / Enterprise với giới hạn phân tích và token |

---

## 🤖 AI Providers

| Provider | Vai trò | Model |
|----------|---------|-------|
| **Gemini API** (primary) | Chat + Embedding | `gemini-2.0-flash` / `gemini-embedding-001` |
| **LM Studio** (fallback) | Chat khi Gemini lỗi non-429 | tùy chọn, OpenAI-compatible |

> **Free tier Gemini:** ~15 RPM cho chat, 100 RPM cho embedding. Backend tự động retry với backoff [10s → 30s → 65s] khi gặp 429. Embedding dùng `batchEmbedContents` — toàn bộ chunks trong 1 HTTP call.

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

> **Quan trọng:** RAG chỉ tìm trong chunks của **active version** hiện tại của mỗi chương. Khi switch version, AI tự động dùng chunks của version đó.

---

## 🔧 Backend

### Công nghệ

- **Framework:** ASP.NET Core (.NET 8)
- **Database:** PostgreSQL + pgvector extension (Supabase)
- **ORM:** Entity Framework Core 9
- **Auth:** JWT Bearer Token + Refresh Token
- **AI Primary:** Google Gemini API
- **AI Fallback:** LM Studio (OpenAI-compatible local server)
- **Email:** MailKit (Gmail SMTP)

### Cấu trúc 3 layers

| Layer | Thư mục | Vai trò |
|-------|---------|---------|
| API | `Api/Controllers/` | HTTP endpoints, routing, DI |
| Service | `Service/` | Business logic, AI integration, DTOs |
| Repository | `Repository/` | Entities, DbContext, Migrations |

### Controllers

| Controller | Route | Mô tả |
|------------|-------|-------|
| `AuthController` | `/api/auth` | Đăng ký, đăng nhập, đổi mật khẩu, quên/reset mật khẩu |
| `UserController` | `/api/user` | Profile |
| `UserSettingsController` | `/api/settings` | Cài đặt editor (font, size) |
| `ProjectController` | `/api/project` | CRUD dự án + stats + export |
| `ChapterController` | `/api/project/{id}/chapters` | Chương, phiên bản (chunk/embed/pin/diff/import/export) |
| `AiController` | `/api/ai` | Chat RAG, Rewrite, Phân tích, Lịch sử |
| `WorldbuildingController` | `/api/project/{id}/worldbuilding` | Quản lý bối cảnh + embed |
| `CharacterController` | `/api/project/{id}/character` | Quản lý nhân vật + embed |
| `SubscriptionController` | `/api/subscription` | Gói đăng ký |
| `GenreController` | `/api/genre` | Thể loại truyện |
| `BugReportController` | `/api/bug-reports` | Báo cáo lỗi (user gửi, staff xử lý) |
| `AdminController` | `/api/admin` | Thống kê tổng quan + users |

### Roles

| Role | Mô tả |
|------|-------|
| `Author` | Mặc định khi đăng ký |
| `Staff` | Xử lý bug reports, được tạo bởi Admin |
| `Admin` | Toàn quyền |

### Database Schema

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
  ├──< BugReports
  └──1 UserSettings
```

### Bảo mật nội dung

Toàn bộ nội dung truyện được **mã hóa AES-256** trong database:
- Mỗi user có **DEK** (Data Encryption Key) riêng, mã hóa bằng **MasterKey** từ config.
- Nội dung chỉ giải mã trong memory khi cần xử lý.

### Cấu hình (`appsettings.Development.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=...;Database=storyrag;Username=postgres;Password=..."
  },
  "Jwt": {
    "Key": "your-secret-key-min-32-chars",
    "Issuer": "StoryRAG",
    "Audience": "StoryRAG"
  },
  "Gemini": {
    "ChatApiKey": "AIza...",
    "EmbedApiKey": "AIza...",
    "ChatModel": "gemini-2.0-flash",
    "EmbeddingModel": "gemini-embedding-001",
    "EmbeddingDimensions": "768"
  },
  "AI": {
    "BaseUrl": "http://localhost:1234/v1",
    "ApiKey": "lm-studio",
    "ChatModel": "your-local-model"
  },
  "Security": {
    "MasterKey": "your-master-key-min-32-chars"
  },
  "Email": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "Username": "your@gmail.com",
    "Password": "gmail-app-password",
    "FromName": "StoryRAG"
  }
}
```

### Chạy Backend

```bash
cd Backend
dotnet restore
dotnet ef database update --project Repository --startup-project Api
dotnet run --project Api
```

API: `http://localhost:5105` · Swagger: `http://localhost:5105/swagger`

---

## 🎨 Frontend

### Công nghệ

- **Framework:** React 19 + TypeScript
- **Build:** Vite 7
- **Styling:** TailwindCSS 4 + CSS Variables (design tokens)
- **HTTP:** Axios
- **Icons:** Lucide React
- **Routing:** React Router DOM 7
- **Diff:** `diff` npm package (word-level diff cho version comparison)

### Pages

| Page | Route | Mô tả |
|------|-------|-------|
| `LandingPage` | `/` | Trang giới thiệu |
| `AuthPage` | `/login`, `/register` | Đăng nhập / Đăng ký |
| `ForgotPasswordPage` | `/forgot-password` | Yêu cầu reset mật khẩu qua email |
| `ResetPasswordPage` | `/reset-password` | Đặt mật khẩu mới (từ link email) |
| `HomePage` | `/home` | Dashboard cá nhân |
| `ProjectsPage` | `/projects` | Danh sách dự án |
| `WorkspacePage` | `/workspace/:projectId` | Editor + AI Chat + Rewrite + Worldbuilding + Version History |
| `AnalysisPage` | `/analysis` | Phân tích AI — chấm điểm 100 điểm |
| `SubscriptionPage` | `/subscription` | Subscription hiện tại |
| `PlansPage` | `/plans` | Xem và chọn gói |
| `ProfilePage` | `/profile` | Thông tin cá nhân |
| `SettingsPage` | `/settings` | Cài đặt editor |
| `AdminDashboardPage` | `/admin` | Quản trị user + thống kê |
| `AdminSubscriptionPage` | `/admin/subscription` | Quản trị gói đăng ký |
| `StaffDashboardPage` | `/staff` | Xử lý bug reports |

### WorkspacePage — UX chính

```
Ctrl+S hoặc nút "Lưu"
  → Lưu nội dung ngay
  → Toast "✅ Đã lưu"
  → Ngầm: Chunk → Embed (indicator trên navbar)
    "⏳ Đồng bộ AI..." → "✨ AI sẵn sàng"
```

**Panels:**
- **Left** — Danh sách chương, thêm/xóa chương, Import `.txt`
- **Center** — Editor contentEditable: font tùy chỉnh, bold/italic/underline, word count, Export chương
- **Right** — AI Chat / Lịch sử phiên bản (Pin, Compare diff, Switch) / Chat cũ
- **Floating toolbar** — Bôi đen văn bản → nút "✨ Viết lại" → `RewritePanel`

### Design System

**Theme:** Warm Parchment (Light) × Midnight Ink (Dark)

| Token | Light | Dark |
|-------|-------|------|
| `--bg-app` | `#ede8e1` | `#0d0b12` |
| `--bg-surface` | `#f5f1ec` | `#1d1a2a` |
| `--bg-sidebar` | `#e4ddd5` | `#161320` |
| `--accent` | `#7c3aed` | `#8b5cf6` |
| `--text-primary` | `#1c1611` | `#f0ecf8` |
| `--text-secondary` | `#6b5f54` | `#9b93ab` |

### Chạy Frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

---

## 📊 Rubric chấm điểm AI (100 điểm)

| # | Nhóm | Điểm |
|---|------|------|
| 1 | Cốt truyện & Mạch lạc (nhất quán, nhân quả, nút thắt) | 25 |
| 2 | Xây dựng Nhân vật (động cơ, chiều sâu, đối thoại) | 25 |
| 3 | Ngôn từ & Văn phong (ngữ pháp, cấu trúc câu, tránh sáo ngữ) | 20 |
| 4 | Sáng tạo & Thể loại (độ sáng tạo, đặc trưng thể loại, sức cuốn hút) | 20 |
| 5 | Tuân thủ & Hoàn thiện (mức độ hoàn thiện, định dạng) | 10 |

> Điểm 5.1 (Hoàn thiện) tự động bị phạt nếu tác phẩm còn ít chương hoặc ít từ. Cần ≥3 lỗi + ≥3 gợi ý cho mỗi tiêu chí.

| Điểm | Kết quả |
|------|---------|
| > 85 | ✅ Xuất sắc |
| 71–85 | 🟢 Khá |
| 51–70 | 🟡 Trung bình |
| ≤ 50 | 🔴 Cần sửa lớn |

---

## 💰 Gói đăng ký

| Gói | Giá/tháng | Phân tích | Token AI |
|-----|-----------|-----------|----------|
| Free | 0đ | 3 | 20,000 |
| Basic | 99,000đ | 20 | 150,000 |
| Pro | 249,000đ | 100 | 500,000 |
| Enterprise | 699,000đ | Không giới hạn | 2,000,000 |

> **Lưu ý:** AI Chat chỉ tốn token, không tốn lượt phân tích. Lượt phân tích chỉ bị trừ khi chạy tính năng "Phân tích AI" (rubric 100 điểm).

---

## 🚀 Khởi chạy toàn bộ

```bash
# 1. Tạo PostgreSQL database, bật extension vector
# 2. Điền config vào Backend/Api/appsettings.Development.json

# 3. Backend
cd Backend
dotnet restore
dotnet ef database update --project Repository --startup-project Api
dotnet run --project Api

# 4. Frontend
cd Frontend
npm install
npm run dev
```

> **LM Studio (tuỳ chọn):** Chỉ cần nếu muốn có fallback khi Gemini gặp lỗi non-429. Tải model embedding và chat, bật server tại `http://localhost:1234`.
