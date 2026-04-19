# StoryRAG — Tổng Quan Kiến Trúc Hệ Thống

> **Phiên bản tài liệu:** 1.1  
> **Cập nhật lần cuối:** Tháng 3/2026

---

## 1. Giới Thiệu

**StoryRAG** là nền tảng hỗ trợ sáng tác truyện tích hợp AI, được xây dựng theo mô hình **RAG (Retrieval-Augmented Generation)**. Hệ thống cho phép tác giả viết, quản lý bản thảo và tương tác với AI để nhận phản hồi ngữ cảnh dựa trên nội dung truyện của chính mình — thay vì kiến thức chung của LLM.

**Tính năng cốt lõi:**

- ✍️ Quản lý project truyện, chương, version (Git-style: pin, diff, restore)
- 🤖 Chat AI theo ngữ cảnh (RAG) — AI "đọc" nội dung truyện của bạn (chỉ tốn token)
- 🔁 Rewrite đoạn văn theo instruction
- ✍️ **Viết mới** từ dàn ý, **Tiếp nối** mạch truyện, **Trau chuốt** bản thảo — có tích hợp các kỹ thuật viết văn (Show don't tell, Pacing)
- 📊 **Phân tích** chấm điểm chất lượng truyện (**Rubric 5 điểm**, 20 tiêu chí, **Zero Hallucination**, chấm theo Thể loại, phát hiện 4 cảnh báo đặc biệt)
- 🌍 Quản lý Worldbuilding & nhân vật có vector embedding (thêm Category **Scene** cho phân cảnh cụ thể)
- 📥📤 Import/Export chương và dự án (`.txt`)
- 🐛 Luồng báo cáo lỗi User → Staff
- 🔑 Quên mật khẩu qua email (MailKit / Gmail SMTP)
- 🔐 Mã hóa toàn bộ nội dung nhạy cảm theo từng user (AES-256)

---

## 2. Kiến Trúc Tổng Thể

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend — React 19 + Vite                    │
│               TypeScript · Tailwind CSS · Axios                  │
│                      localhost:5173 (dev)                        │
└─────────────────────────────┬────────────────────────────────────┘
                              │ HTTPS / REST API
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│               Backend API — ASP.NET Core (.NET 8.0)              │
│         Controllers → Services → Repository (3 layers)           │
│                      localhost:7259 (dev)                        │
└───────────┬─────────────────────────────────┬────────────────────┘
            │ Npgsql / EF Core                │ HttpClient
            ▼                                 ▼
┌─────────────────────────┐     ┌──────────────────────────────┐
│  Supabase PostgreSQL    │     │   Google Gemini API          │
│  + pgvector extension   │     │   (LLM)                      │
│  (cloud, pooler:6543)   │     └──────────────────────────────┘
└─────────────────────────┘
```

---

## 3. Tech Stack

### 3.1 Backend

| Thành phần      | Công nghệ                                   | Phiên bản |
| --------------- | ------------------------------------------- | --------- |
| Runtime         | .NET                                        | 8.0 LTS   |
| Web Framework   | ASP.NET Core                                | 8.0       |
| ORM             | Entity Framework Core                       | 9.0       |
| Database Driver | Npgsql                                      | 9.0.1     |
| Vector Search   | Pgvector.EntityFrameworkCore                | 0.3.0     |
| LLM Client      | OpenAI SDK (tương thích Gemini) | 2.1.0     |
| Authentication  | JWT Bearer                                  | 8.0.0     |
| Email           | MailKit (SMTP / Gmail)                      | 4.9.0     |
| API Docs        | Swagger / Swashbuckle                       | 6.6.2     |

**Pattern kiến trúc:** 3-layer (Controller → Service → Repository), Dependency Injection built-in .NET.

### 3.2 Frontend

| Thành phần  | Công nghệ        | Phiên bản |
| ----------- | ---------------- | --------- |
| Framework   | React            | 19.2.0    |
| Build Tool  | Vite             | 7.3.1     |
| Ngôn ngữ    | TypeScript       | 5.9.3     |
| Styling     | Tailwind CSS     | 4.2.1     |
| Routing     | React Router DOM | 7.13.1    |
| HTTP Client | Axios            | 1.13.5    |
| Forms       | React Hook Form  | 7.71.2    |
| Animation   | Framer Motion    | 12.35.0   |
| Icons       | Lucide React     | 0.575.0   |

### 3.3 Database & Infrastructure

| Thành phần       | Công nghệ                                                         |
| ---------------- | ----------------------------------------------------------------- |
| Database         | PostgreSQL (Supabase cloud)                                       |
| Vector Extension | pgvector (768 chiều)                                              |
| Connection       | Supabase Pooler — `aws-1-ap-northeast-1.pooler.supabase.com:6543` |
| File Storage     | Supabase Storage (ảnh bìa, avatar)                                |

---

## 4. Cấu Trúc Thư Mục

```
StoryRAG/
├── Backend/
│   ├── Api/                        # Tầng API (Controllers, Program.cs)
│   │   ├── Controllers/            # 11 REST Controllers
│   │   ├── appsettings.json        # Config production
│   │   └── appsettings.Development.json
│   ├── Service/                    # Tầng Business Logic
│   │   ├── Implementations/        # 16 Service implementations
│   │   ├── Interfaces/             # 16 Service interfaces
│   │   ├── DTOs/                   # Data Transfer Objects
│   │   └── Helpers/                # EncryptionHelper, GeminiRetryHelper
│   └── Repository/                 # Tầng Data Access
│       ├── Data/AppDbContext.cs     # EF Core DbContext
│       ├── Entities/               # 15 Entity models
│       └── Migrations/             # EF Core migrations
├── Frontend/
│   └── src/
│       ├── pages/                  # 16 trang React
│       ├── components/             # Sidebar, Topbar, RewritePanel, Toast...
│       ├── services/               # API clients TypeScript
│       ├── hooks/                  # Custom React hooks
│       └── utils/                  # JWT helper, utilities
└── supabase_full_reset.sql         # Script reset & khởi tạo DB
```

---

## 5. Database Schema

### 5.1 Sơ Đồ Quan Hệ (tóm tắt)

```
Users ──< Projects ──< Chapters ──< ChapterVersions ──< ChapterChunks
  │           │                                              (vector)
  │           ├──< ProjectGenres >── Genres
  │           ├──< WorldbuildingEntries  (vector)
  │           ├──< CharacterEntries     (vector)
  │           ├──< ProjectReports
  │           ├──< ChatMessages
  │           ├──< RewriteHistories
  │           └──< TimelineEvents
  │
  ├──< UserSubscriptions >── SubscriptionPlans
  └──1 UserSettings
```

### 5.2 Danh Sách Tables

| Table                  | Mục đích                                | Đặc biệt                                                                                   |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Users`                | Tài khoản người dùng                    | `DataEncryptionKey` (DEK riêng mỗi user)                                                   |
| `Projects`             | Bộ truyện                               | Title/Summary mã hóa AES-256                                                               |
| `Chapters`             | Chương truyện                           | Draft content, version tracking                                                            |
| `ChapterVersions`      | Lịch sử version chương                  | `IsChunked`, `IsEmbedded`, `IsPinned` — pin bảo vệ khỏi auto-prune                         |
| `ChapterChunks`        | Đoạn văn nhỏ để RAG                     | **`Embedding vector(768)`** — pgvector                                                     |
| `WorldbuildingEntries` | Ghi chú thế giới truyện                 | **`Embedding vector(768)`**                                                                |
| `CharacterEntries`     | Hồ sơ nhân vật                          | **`Embedding vector(768)`**                                                                |
| `ChatMessages`         | Lịch sử chat AI                         | Question/Answer mã hóa AES-256                                                             |
| `RewriteHistories`     | Lịch sử rewrite AI                      | OriginalText/RewrittenText mã hóa                                                          |
| `ProjectReports`       | Báo cáo phân tích truyện                | `CriteriaJson` (JSONB), `ProjectVersion` (v1.chương.chunks), `OverallFeedback`, `Warnings` |
| `BugReports`           | Báo cáo lỗi từ user                     | Category, Priority, Status, StaffNote                                                      |
| `Genres`               | Thể loại truyện                         | 14 thể loại mặc định                                                                       |
| `ProjectGenres`        | Liên kết Project ↔ Genre                | Many-to-many                                                                               |
| `SubscriptionPlans`    | Gói dịch vụ (Free/Basic/Pro/Enterprise) | Token & analysis limits                                                                    |
| `UserSubscriptions`    | Đăng ký gói của user                    | `UsedTokens`, `UsedAnalysisCount`                                                          |
| `UserSettings`         | Cài đặt editor                          | Font, font size                                                                            |
| `TimelineEvents`       | Mốc sự kiện dòng thời gian              | Category, TimeLabel, SortOrder, Importance                                                 |

---

## 6. API Endpoints

### 6.1 Authentication — `/api/auth`

| Method | Endpoint           | Mô tả                                |
| ------ | ------------------ | ------------------------------------ |
| POST   | `/register`        | Đăng ký tài khoản mới                |
| POST   | `/login`           | Đăng nhập, nhận JWT                  |
| POST   | `/refresh`         | Làm mới Access Token                 |
| PUT    | `/change-password` | Đổi mật khẩu                         |
| POST   | `/forgot-password` | Yêu cầu link reset qua email         |
| POST   | `/reset-password`  | Đặt mật khẩu mới bằng token từ email |

### 6.2 Projects — `/api/projects`

| Method | Endpoint       | Mô tả                                              |
| ------ | -------------- | -------------------------------------------------- |
| GET    | `/`            | Danh sách project của user                         |
| GET    | `/{id}`        | Chi tiết project                                   |
| GET    | `/stats`       | Thống kê của user (số dự án, chương, phân tích...) |
| POST   | `/`            | Tạo project mới                                    |
| PUT    | `/{id}`        | Cập nhật project                                   |
| DELETE | `/{id}`        | Xóa mềm project                                    |
| GET    | `/{id}/export` | Export toàn bộ chương ra file `.txt`               |

### 6.3 Chapters — `/api/projects/{projectId}/chapters`

| Method | Endpoint                        | Mô tả                                        |
| ------ | ------------------------------- | -------------------------------------------- |
| GET    | `/`                             | Danh sách chương                             |
| GET    | `/{id}`                         | Chi tiết chương                              |
| POST   | `/`                             | Tạo chương mới                               |
| PUT    | `/{id}`                         | Cập nhật / lưu nội dung                      |
| PATCH  | `/{id}/title`                   | Đổi tên chương                               |
| DELETE | `/{id}`                         | Xóa chương                                   |
| POST   | `/{id}/chunk`                   | Tạo chunks cho active version                |
| GET    | `/{id}/versions`                | Danh sách versions                           |
| GET    | `/{id}/versions/{num}`          | Chi tiết version                             |
| POST   | `/{id}/versions`                | Tạo version mới (snapshot từ active version) |
| PATCH  | `/{id}/versions/{num}/activate` | Chuyển sang version này                      |
| PATCH  | `/{id}/versions/{num}/title`    | Đổi tên version                              |
| PUT    | `/{id}/versions/{num}/pin`      | Toggle pin/unpin version                     |
| GET    | `/{id}/versions/{num}/content`  | Lấy nội dung version để diff                 |
| DELETE | `/{id}/versions/{num}`          | Xóa version                                  |

### 6.4 AI — `/api/ai`

| Method | Endpoint                          | Mô tả                           |
| ------ | --------------------------------- | ------------------------------- |
| POST   | `/chapters/{chapterId}/embed`     | Embed active version của chương |
| POST   | `/{projectId}/chat`               | Chat RAG với ngữ cảnh truyện    |
| GET    | `/{projectId}/chat/history`       | Lịch sử chat                    |
| POST   | `/{projectId}/rewrite`            | Rewrite đoạn văn                |
| GET    | `/{projectId}/rewrite/history`    | Lịch sử rewrite                 |
| POST   | `/{projectId}/analyze`            | Phân tích & chấm điểm truyện    |
| GET    | `/{projectId}/reports/latest`     | Báo cáo phân tích mới nhất      |
| GET    | `/{projectId}/reports`            | Toàn bộ lịch sử báo cáo         |
| GET    | `/{projectId}/reports/{reportId}` | Báo cáo cụ thể                  |

### 6.5 Worldbuilding & Characters

| Route                                                      | Mô tả                |
| ---------------------------------------------------------- | -------------------- |
| `GET/POST /api/projects/{id}/worldbuilding`                 | Danh sách / Tạo mới  |
| `GET/PUT/DELETE /api/projects/{id}/worldbuilding/{entryId}` | Chi tiết / Sửa / Xóa |
| `POST /api/projects/{id}/worldbuilding/{entryId}/embed`     | Embed entry          |
| `GET/POST /api/projects/{id}/character`                     | Danh sách / Tạo mới  |
| `GET/PUT/DELETE /api/projects/{id}/character/{entryId}`     | Chi tiết / Sửa / Xóa |
| `POST /api/projects/{id}/character/{entryId}/embed`         | Embed character      |

### 6.6 Bug Reports — `/api/bug-reports`

| Method | Endpoint | Auth        | Mô tả                             |
| ------ | -------- | ----------- | --------------------------------- |
| POST   | `/`      | Author      | Gửi báo cáo lỗi                   |
| GET    | `/my`    | Author      | Báo cáo của chính mình            |
| GET    | `/`      | Staff/Admin | Tất cả báo cáo (filter by status) |
| GET    | `/stats` | Staff/Admin | Thống kê báo cáo                  |
| PUT    | `/{id}`  | Staff/Admin | Cập nhật trạng thái + ghi chú     |
| DELETE | `/{id}`  | Admin       | Xóa báo cáo                       |

### 6.7 Admin — `/api/admin`

| Method | Endpoint          | Mô tả                                                     |
| ------ | ----------------- | --------------------------------------------------------- |
| GET    | `/stats/overview` | Tổng quan hệ thống (users, projects, reports, revenue...) |
| GET    | `/users/stats`    | Thống kê chi tiết users theo role                         |

### 6.8 Subscription — `/api/subscription`

| Method   | Endpoint                | Mô tả            |
| -------- | ----------------------- | ---------------- |
| GET      | `/plans`                | Danh sách gói    |
| GET/POST | `/plans`, `/plans/{id}` | CRUD gói (Admin) |
| POST     | `/subscribe`            | Đăng ký gói      |
| GET      | `/my`                   | Gói đang dùng    |

### 6.9 Settings — `/api/settings`

| Method | Endpoint | Mô tả                    |
| ------ | -------- | ------------------------ |
| GET    | `/`      | Cài đặt editor hiện tại  |
| PUT    | `/`      | Cập nhật font, font size |

### 6.10 Timeline — `/api/projects/{projectId}/timeline`

| Method | Endpoint        | Mô tả                                       |
| ------ | --------------- | ------------------------------------------- |
| GET    | `/`             | Danh sách mốc sự kiện (sorted by sortOrder) |
| POST   | `/`             | Thêm mốc sự kiện mới (auto sort)            |
| PUT    | `/{id}`         | Cập nhật mốc sự kiện                        |
| DELETE | `/{id}`         | Xóa mốc sự kiện                             |
| PATCH  | `/{id}/reorder` | Thay đổi thứ tự (sortOrder)                 |

---

## 7. AI & RAG Pipeline

### 7.1 Cấu Hình LLM

```
PRIMARY:  Google Gemini API
  └─ Chat Models:     gemma-4-31b -> gemma-4-26b (fallback)
  └─ Embed Model:     gemini-embedding-001 (768 chiều)
```

### 7.2 RAG Chat Flow

```
[1] User gửi câu hỏi
       ↓
[2] EmbeddingService → chuyển câu hỏi thành vector 768-dim
       ↓
[3] Lấy active VersionId của mỗi chương trong project
       ↓
[4] Vector search (pgvector cosine similarity) — chỉ trong active versions:
       ├─ Top 3 chunks từ ChapterChunks (active version)
       ├─ Top 2 từ WorldbuildingEntries
       └─ Top 2 từ CharacterEntries
       ↓
[5] Ghép context + system prompt + lịch sử chat gần nhất
       ↓
[6] Gọi Gemini API
       ↓
[7] Lưu vào AiChatMessages (mã hóa AES-256)
       ↓
[8] Trả về {answer, inputTokens, outputTokens, contextChunks}
       — chỉ trừ token, KHÔNG trừ lượt phân tích
```

### 7.3 Chapter Embedding Flow

```
[1] User trigger embed chapter (hoặc auto sau khi lưu)
       ↓
[2] ChunkingService: chia nội dung ACTIVE VERSION thành chunks
       └─ Kích thước: ~1500 ký tự / chunk
       └─ Overlap: 150 ký tự (đảm bảo ngữ cảnh liên tục)
       ↓
[3] EmbeddingService: gọi Gemini batchEmbedContents → vector 768-dim
       ↓
[4] Lưu ChapterChunk.Embedding vào pgvector (VersionId = active version)
       ↓
[5] Đánh dấu ChapterVersion.IsEmbedded = true

Khi switch version:
  → Chapter.CurrentVersionId thay đổi
  → RAG tự động dùng chunks của version mới
  → Chunks của version cũ vẫn còn (dùng khi switch lại)
  → Auto-prune: tối đa 20 versions/chapter, xóa oldest non-pinned kèm chunks
```

---

## 8. Bảo Mật

### 8.1 Authentication & Authorization

- **JWT Bearer Token** — HS256, có expiry
- **Refresh Token** — Lưu DB, rotation khi refresh
- **Role-based:** `Author`, `Admin`, `Staff`

### 8.2 Mã Hóa Dữ Liệu (End-to-end Encryption)

- Mỗi user có **Data Encryption Key (DEK)** riêng
- DEK được mã hóa bằng **MasterKey** (env variable)
- Các trường được mã hóa AES-256:
  - Project: `Title`, `Summary`
  - Chapter: `DraftContent`, `Content` (versions)
  - ChatMessage: `Question`, `Answer`
  - RewriteHistory: `OriginalText`, `RewrittenText`, `Instruction`
  - Character: `Name`, `Description`, `Background`
  - Worldbuilding: `Title`, `Content`

### 8.3 CORS

```
Allowed Origins:
  - http://localhost:5173  (Vite dev)
  - http://localhost:5174
  - http://localhost:3000
  - https://storyrag-frontend.onrender.com  (Render production)
```

---

## 9. Gói Dịch Vụ (Subscription)

| Gói            | Giá      | Phân tích/tháng | Token AI/tháng |
| -------------- | -------- | --------------- | -------------- |
| **Free**       | 0đ       | 3               | 20,000         |
| **Basic**      | 99,000đ  | 20              | 150,000        |
| **Pro**        | 249,000đ | 100             | 500,000        |
| **Enterprise** | 699,000đ | Không giới hạn  | 2,000,000      |

---

## 10. Biến Môi Trường Quan Trọng

> ⚠️ Không commit các giá trị thực lên git. Dùng `appsettings.Development.json` hoặc User Secrets.

| Key                                   | Mục đích                                |
| ------------------------------------- | --------------------------------------- |
| `ConnectionStrings:DefaultConnection` | PostgreSQL connection string (Supabase) |
| `Jwt:Key`                             | HMAC signing key cho JWT                |
| `Security:MasterKey`                  | Key mã hóa DEK của user                 |
| `Gemini:EmbeddingApiKey`              | Key chuyên cho embedding (ưu tiên nếu được cấu hình) |
| `Gemini:AnalyzeApiKey`                | Key ưu tiên cho phân tích (và fallback embedding) |
| `Gemini:ChatApiKey`                   | Key ưu tiên cho chatbot (và fallback embedding)   |
| `Gemini:ChatModels`                   | Thứ tự fallback model chat (`gemma-4-31b,gemma-4-26b`) |
| `Email:Password`                      | Gmail app password                      |

---

## 11. Hướng Dẫn Khởi Động (Dev)

### Backend

```bash
cd Backend/Api
dotnet run
# API chạy tại https://localhost:7259
# Swagger UI: https://localhost:7259/swagger
```

### Frontend

```bash
cd Frontend
npm install
npm run dev
# Chạy tại http://localhost:5173
```

### Reset Database (Supabase)

1. Mở **Supabase SQL Editor**
2. Chạy toàn bộ file `supabase_full_reset.sql`
3. EF Core sẽ không cần migrate lại (migration history đã ghi sẵn)

---

## 12. Services Overview

| Interface               | Trách nhiệm                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IAuthService`          | Đăng ký, đăng nhập, refresh token, đổi mật khẩu, forgot/reset password                                                                                                                                                                                           |
| `IUserService`          | Xem/cập nhật profile                                                                                                                                                                                                                                             |
| `IUserSettingsService`  | Cài đặt editor (font, size)                                                                                                                                                                                                                                      |
| `IProjectService`       | CRUD project, stats tác giả, export project                                                                                                                                                                                                                      |
| `IChapterService`       | CRUD chương, quản lý version (create/switch/pin/delete/prune), chunk                                                                                                                                                                                             |
| `ICharacterService`     | CRUD nhân vật + embed                                                                                                                                                                                                                                            |
| `IWorldbuildingService` | CRUD worldbuilding/lore + embed                                                                                                                                                                                                                                  |
| `IGenreService`         | Quản lý thể loại (Admin)                                                                                                                                                                                                                                         |
| `ISubscriptionService`  | Quản lý gói dịch vụ                                                                                                                                                                                                                                              |
| `IAiChatService`        | RAG chat, lưu lịch sử, deduct token only                                                                                                                                                                                                                         |
| `IAiRewriteService`     | Rewrite theo instruction, lưu lịch sử                                                                                                                                                                                                                            |
| `IEmbeddingService`     | Gọi Gemini lấy embedding vector                                                                                                                                                                                                                                  |
| `IChunkingService`      | Chia text thành chunks với overlap                                                                                                                                                                                                                               |
| `IAiWritingService`     | Viết mới từ dàn ý, tiếp nối mạch truyện, trau chuốt bản thảo — tích hợp kỹ thuật **Show Don't Tell**, **Pacing**                                                                                                                                                 |
| `IProjectReportService` | Phân tích & chấm điểm theo **Rubric 5b điểm** (1-Kém → 5-Xuất sắc), **Zero Hallucination**, chấm theo **Thể loại**, phát hiện **4 cảnh báo** (INCOMPLETE / REPETITION / PLAGIARISM_RISK / INCONSISTENCY), sinh `OverallFeedback` tâm huyết, ghi `ProjectVersion` |
| `IEmailService`         | Gửi email (welcome, password reset) qua Gmail SMTP                                                                                                                                                                                                               |
| `IAdminService`         | Dashboard stats cho Admin                                                                                                                                                                                                                                        |
| `IBugReportService`     | CRUD bug reports, cập nhật trạng thái (Staff/Admin)                                                                                                                                                                                                              |
| `ITimelineEventService` | CRUD mốc sự kiện dòng thời gian, tự động sort order                                                                                                                                                                                                              |
