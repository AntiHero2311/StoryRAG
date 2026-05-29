# StoryRAG — Tổng Quan Kiến Trúc Hệ Thống

> **Phiên bản tài liệu:** 1.4  
> **Cập nhật lần cuối:** Tháng 5/2026 — Thêm cờ nội dung SEXUAL_CONTENT & ANTI_STATE; sửa luồng Staff review; fix 8 bugs audit


---

## 1. Giới Thiệu

**StoryRAG** là nền tảng hỗ trợ sáng tác truyện tích hợp AI, được xây dựng theo mô hình **RAG (Retrieval-Augmented Generation)**. Hệ thống cho phép tác giả viết, quản lý bản thảo và tương tác với AI để nhận phản hồi ngữ cảnh dựa trên nội dung truyện của chính mình — thay vì kiến thức chung của LLM.

**Tính năng cốt lõi:**

- ✍️ Quản lý project truyện, chương, version (Git-style: pin, diff, restore)
- 🤖 Chat AI theo ngữ cảnh (RAG) — AI "đọc" nội dung truyện của bạn (chỉ tốn token)
- 📊 **Phân tích** chấm điểm chất lượng truyện (**Rubric 5 điểm**, 20 tiêu chí, **Zero Hallucination**, chấm theo Thể loại, phát hiện **6 cảnh báo đặc biệt**: INCOMPLETE / REPETITION / PLAGIARISM_RISK / INCONSISTENCY / **SEXUAL_CONTENT** / **ANTI_STATE**). Mỗi lần phân tích chạy trên **snapshot toàn bộ bộ truyện** và tự repair chapter active nào chưa chunk/embed đủ trước khi chấm.
- 🌍 **Story Bible** chuyên sâu: Quản lý Worldbuilding, Nhân vật, Ghi chú cốt truyện (Plot Notes), Chủ đề (Themes), Cẩm nang phong cách (Style Guides) — Hỗ trợ vector embedding.
- 📅 Quản lý **Timeline** mốc sự kiện dòng thời gian.
- 📥📤 **Import/Export bản thảo chuyên nghiệp** (`.docx`, `.txt`), tự động tách chương theo tiêu đề.
- 💳 Tích hợp cổng thanh toán **VNPay** hỗ trợ nâng cấp/gia hạn gói dịch vụ.
- 🐛 Luồng báo cáo lỗi User → Staff/Admin.
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
│   │   ├── Controllers/            # 20 REST Controllers
│   │   ├── appsettings.json        # Config production
│   │   └── appsettings.Development.json
│   ├── Service/                    # Tầng Business Logic
│   │   ├── Implementations/        # Business services, queues, AI/export helpers
│   │   ├── Interfaces/             # Service contracts
│   │   ├── DTOs/                   # Data Transfer Objects
│   │   └── Helpers/                # EncryptionHelper, GeminiRetryHelper
│   └── Repository/                 # Tầng Data Access
│       ├── Data/AppDbContext.cs     # EF Core DbContext
│       ├── Entities/               # 26 Entity models
│       └── Migrations/             # EF Core migrations
├── Frontend/
│   └── src/
│       ├── pages/                  # 18 trang React
│       ├── components/             # Sidebar, Topbar, Toast...
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
  │           ├──< StyleGuideEntries    (vector)
  │           ├──< ThemeEntries         (vector)
  │           ├──< PlotNoteEntries      (vector)
  │           ├──< ProjectReports
  │           ├──< ProjectAnalysisJobs (có thể trỏ tới ProjectReports khi hoàn tất)
  │           ├──< ChatMessages
  │           ├──< AiAnalysisHistories
  │           └──< TimelineEvents
  │
  ├──< UserSubscriptions >── SubscriptionPlans
  ├──< Payments
  ├──< BugReports
  ├──< StaffFeedbacks
  ├──< faqs / writing_tips (trợ giúp công khai)
  ├──< StaffAnalysisReviews
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
| `StyleGuideEntries`    | Cẩm nang phong cách                     | **`Embedding vector(768)`**                                                                |
| `ThemeEntries`         | Chủ đề/tầng nghĩa                       | **`Embedding vector(768)`**                                                                |
| `PlotNoteEntries`      | Ghi chú cốt truyện                      | **`Embedding vector(768)`**                                                                |
| `ChatMessages`         | Lịch sử chat AI                         | Question/Answer mã hóa AES-256                                                             |
| `ProjectReports`       | Báo cáo phân tích truyện                | `CriteriaJson` (JSONB), `ProjectVersion` (snapshot label), `ProjectVersionHash`, `OverallFeedback`, `Warnings` |
| `ProjectAnalysisJobs`  | Job phân tích bất đồng bộ               | Trạng thái/progress/result cho phân tích dài, `ProjectVersionHash` snapshot                |
| `AiAnalysisHistories`  | Lịch sử phân tích cảnh/cliffhanger      | JSON kết quả và token đã dùng                                                              |
| `Payments`             | Giao dịch thanh toán                    | VNPay, trạng thái, transaction/order reference                                        |
| `BugReports`           | Báo cáo lỗi từ user                     | Category, Priority, Status, StaffNote                                                      |
| `StaffFeedbacks`       | Phản hồi chuyên môn từ Staff            | Gắn với project/report/user/staff, có like/dislike + reply từ author                      |
| `faqs`                 | Câu hỏi thường gặp (Staff quản lý)      | `Published`, `Order`, `Category`                                                           |
| `writing_tips`         | Mẹo viết truyện                         | `Tags[]`, `Published`                                                                      |
| `StaffAnalysisReviews` | Review báo cáo phân tích                | Verified/Adjusted/RerunRequested                                                           |
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
| POST   | `/google-login`    | Đăng nhập bằng Google                |
| POST   | `/refresh`         | Làm mới Access Token bằng Refresh Token |
| PUT    | `/change-password` | Đổi mật khẩu                         |
| POST   | `/forgot-password` | Yêu cầu link reset qua email         |
| POST   | `/reset-password`  | Đặt mật khẩu mới bằng token từ email |

> Hiện code chưa có endpoint xác thực email bắt buộc sau đăng ký; scope này nằm trong tài liệu kế hoạch nhưng chưa được triển khai ở API.

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
| POST   | `/import`                       | Import nhiều chương từ nội dung đã tách      |
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
| GET    | `/{id}/versions/compare`        | So sánh hai version                          |
| DELETE | `/{id}/versions/{num}`          | Xóa version                                  |

### 6.3b Manuscript & Export — `/api/manuscript`

| Method | Endpoint | Mô tả |
| ------ | -------- | ---- |
| POST   | `/{projectId}/upload` | Upload bản thảo (docx/txt), tự động tách chương |
| GET    | `/{projectId}/export` | Export toàn bộ project (docx/txt/pdf) |
| GET    | `/{projectId}/chapters/{chapterId}/export` | Export một chương |

### 6.4 AI — `/api/ai`

| Method | Endpoint                          | Mô tả                           |
| ------ | --------------------------------- | ------------------------------- |
| POST   | `/chapters/{chapterId}/embed`     | Embed active version của chương |
| POST   | `/{projectId}/chat`               | Chat RAG với ngữ cảnh truyện    |
| GET    | `/{projectId}/chat/history`       | Lịch sử chat                    |
| POST   | `/{projectId}/analyze/jobs`       | Tạo job phân tích bất đồng bộ   |
| GET    | `/analyze/jobs/active`            | Job phân tích đang chạy của user |
| GET    | `/{projectId}/analyze/jobs/latest` | Job phân tích gần nhất của project |
| GET    | `/{projectId}/analyze/jobs/{jobId}` | Trạng thái job phân tích       |
| GET    | `/{projectId}/analyze/jobs/{jobId}/result` | Kết quả báo cáo phân tích khi job đã hoàn tất |
| POST   | `/{projectId}/analyze/jobs/{jobId}/cancel` | Hủy job `Queued/Processing` sau ~5 phút kể từ lúc enqueue |
| POST   | `/{projectId}/scenes`             | Phân rã cảnh và trích quote     |
| POST   | `/{projectId}/cliffhanger`        | Phân tích cliffhanger/ba hồi    |
| GET    | `/{projectId}/analysis/history`   | Lịch sử phân tích cảnh/cliffhanger |
| POST   | `/{projectId}/analyze`            | Phân tích & chấm điểm truyện    |
| GET    | `/{projectId}/reports/latest`     | Báo cáo phân tích mới nhất      |
| GET    | `/{projectId}/reports`            | Toàn bộ lịch sử báo cáo         |
| GET    | `/{projectId}/reports/{reportId}` | Báo cáo cụ thể                  |
| GET    | `/{projectId}/narrative/charts`   | Dữ liệu biểu đồ nhịp độ (pacing) & cảm xúc (emotion) (đã lược bỏ nhân vật) |
| GET    | `/{projectId}/reports/{reportId}/export/pdf` | Xuất PDF báo cáo cho gói trả phí |

### 6.5 Worldbuilding, Characters, Plot Notes, Themes & Style Guides

| Route                                                      | Mô tả                |
| ---------------------------------------------------------- | -------------------- |
| `GET/POST /api/projects/{id}/worldbuilding`                 | Danh sách / Tạo mới  |
| `GET/PUT/DELETE /api/projects/{id}/worldbuilding/{entryId}` | Chi tiết / Sửa / Xóa |
| `POST /api/projects/{id}/worldbuilding/{entryId}/embed`     | Embed entry          |
| `GET/POST /api/projects/{id}/character`                     | Danh sách / Tạo mới  |
| `GET/PUT/DELETE /api/projects/{id}/character/{entryId}`     | Chi tiết / Sửa / Xóa |
| `POST /api/projects/{id}/character/{entryId}/embed`         | Embed character      |
| `GET/POST /api/projects/{id}/plot-notes`                    | Danh sách / Tạo mới  |
| `GET/PUT/DELETE /api/projects/{id}/plot-notes/{id}`         | Chi tiết / Sửa / Xóa |
| `POST /api/projects/{id}/plot-notes/{id}/embed`             | Embed plot note      |
| `GET/POST /api/projects/{id}/themes`                        | Danh sách / Tạo mới  |
| `GET/PUT/DELETE /api/projects/{id}/themes/{id}`             | Chi tiết / Sửa / Xóa |
| `POST /api/projects/{id}/themes/{id}/embed`                 | Embed theme          |
| `GET/POST /api/projects/{id}/style-guides`                  | Danh sách / Tạo mới  |
| `GET/PUT/DELETE /api/projects/{id}/style-guides/{id}`       | Chi tiết / Sửa / Xóa |
| `POST /api/projects/{id}/style-guides/{id}/embed`           | Embed style guide    |

### 6.6 Bug Reports — `/api/bug-reports`

| Method | Endpoint | Auth        | Mô tả                             |
| ------ | -------- | ----------- | --------------------------------- |
| POST   | `/`      | Author      | Gửi báo cáo lỗi                   |
| GET    | `/my`    | Author      | Báo cáo của chính mình            |
| GET    | `/`      | Staff/Admin | Tất cả báo cáo (filter by status) |
| GET    | `/stats` | Staff/Admin | Thống kê báo cáo                  |
| PUT    | `/{id}`  | Staff/Admin | Cập nhật trạng thái + ghi chú     |
| DELETE | `/{id}`  | Admin       | Xóa báo cáo                       |

### 6.7 Admin — `/api/admin` & `/api/admin/rag-config`

| Method | Endpoint          | Mô tả                                                     |
| ------ | ----------------- | --------------------------------------------------------- |
| GET    | `/stats/overview` | Tổng quan hệ thống (users, projects, reports, revenue...) |
| GET    | `/users/stats`    | Thống kê chi tiết users theo role                         |
| GET    | `/rag-config`     | Lấy cấu hình RAG/Gemini hiện hành (cổng kiểm soát)         |
| PUT    | `/rag-config`     | Cập nhật cấu hình cổng kiểm soát (limits, chunks...)     |

### 6.8 Subscription — `/api/subscription`

| Method   | Endpoint                | Mô tả            |
| -------- | ----------------------- | ---------------- |
| GET      | `/plans`                | Danh sách gói    |
| GET/POST | `/plans`, `/plans/{id}` | CRUD gói (Admin) |
| POST     | `/subscribe`            | Đăng ký gói      |
| GET      | `/my`                   | Gói đang dùng    |

### 6.8b Payments — `/api/payment`

| Method | Endpoint | Mô tả |
| ------ | -------- | ---- |
| POST   | `/create` | Tạo payment record |
| PATCH  | `/{paymentId}/status` | Cập nhật trạng thái payment |
| PUT    | `/{paymentId}/mark-completed` | Đánh dấu thanh toán hoàn tất |
| POST   | `/{paymentId}/refund` | Hoàn tiền payment |
| POST   | `/vnpay/create-url` | Tạo URL thanh toán VNPay |
| GET    | `/vnpay/ipn` | IPN callback từ VNPay |
| GET    | `/vnpay/order/{txnRef}` | Lấy trạng thái đơn VNPay |
| GET    | `/history` | Lấy lịch sử thanh toán |
| GET    | `/{paymentId}` | Chi tiết thanh toán |

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

### 6.11 Staff — `/api/staff`

| Method | Endpoint | Mô tả |
| ------ | -------- | ---- |
| GET    | `/manuscripts/flagged` | Danh sách manuscript bị flag (NO_ANALYSIS / INCOMPLETE_ANALYSIS / LOW_QUALITY_SCORE / ANTI_STATE / SEXUAL_CONTENT / PLAGIARISM_RISK / INCOMPLETE_STORY / INCONSISTENCY_DETECTED) |
| GET/POST | `/feedback` | Xem / tạo phản hồi Staff |
| PUT/DELETE | `/feedback/{feedbackId}` | Cập nhật / xóa phản hồi |
| POST | `/feedback/{feedbackId}/respond` | Author like/dislike và reply feedback |
| GET/POST/PUT/DELETE | `/faqs/admin`, `/writing-tips/admin` | CRUD FAQ & mẹo viết (thay knowledge-base cũ) |
| GET | `/faqs`, `/writing-tips` | Nội dung đã publish (trang Trợ giúp) |
| GET    | `/analyses/pending` | Danh sách report đang chờ review (dành cho hậu kiểm hoặc các báo cáo cũ chưa phát hành) |
| GET    | `/analyses/reviews` | Danh sách review phân tích |
| GET    | `/analyses/{reportId}` | Chi tiết report (CriteriaJson + warnings) để Staff đọc |
| GET    | `/analyses/{reportId}/review` | Review record theo reportId |
| GET    | `/analyses/{reportId}/story` | Nội dung bản thảo (read-only) để Staff đối chiếu |
| POST   | `/analyses/{reportId}/review` | Duyệt/chỉnh/yêu cầu chạy lại báo cáo |
| PATCH  | `/analyses/{reportId}/edit` | Staff chỉnh sửa report + release cho user |
| GET    | `/analyses/jobs` | Danh sách analysis jobs (filter by status) |
| POST   | `/analyses/jobs/{jobId}/rerun` | Chạy lại một analysis job |

---

## 7. AI & RAG Pipeline

### 7.1 Cấu Hình LLM

```
PRIMARY:  Google Gemini API
  └─ Chat Models:     gemini-3-flash-preview -> gemini-2.5-flash (fallback)
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
  - Character: `Name`, `Description`, `Background`
  - Worldbuilding: `Title`, `Content`

### 8.3 CORS

```
Allowed Origins:
  - http://localhost:5173  (Vite dev)
  - http://localhost:5174
  - http://localhost:3000
  - https://storynest.cloud
  - https://www.storynest.cloud
  - Các domain bổ sung từ `Cors:AllowedOrigins`
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
| `Gemini:ChatModels`                   | Thứ tự fallback model chat (`gemini-3-flash-preview,gemini-2.5-flash`) |
| `Email:Password`                      | Gmail app password                      |
| `Cors:AllowedOrigins`                 | Domain frontend bổ sung ngoài mặc định   |
| `VNPay:*`                  | Cấu hình cổng thanh toán                 |

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

## 11b. EF Core Migrations trên Supabase PostgreSQL

> **Bắt buộc đọc trước khi chạy `dotnet ef`** — Supabase có một số đặc điểm khác PostgreSQL tự host.

### Cấu hình Connection String đúng cho EF Tools

Supabase cung cấp **2 loại connection string** khác nhau:

| Loại | Port | Dùng cho |
|------|------|----------|
| **Transaction Pooler** | `6543` | Runtime app (ngắn hạn, nhiều request) |
| **Session Mode / Direct** | `5432` | EF Core migrations (cần session-level lock) |

`dotnet ef` yêu cầu **session-level lock** (`LOCK TABLE ... IN ACCESS EXCLUSIVE MODE`) → **phải dùng port `5432`** (direct connection hoặc session pooler).

> ⚠️ Nếu dùng port `6543` (transaction pooler), migration sẽ báo lỗi hoặc treo vô hạn.

Để chạy migration, tạm thời thay connection string trong `appsettings.json` hoặc truyền thẳng qua `--connection`:

```bash
# Cách 1: Dùng --connection flag (không cần sửa appsettings)
dotnet ef database update \
  --project Repository/Repository.csproj \
  --startup-project Api/Api.csproj \
  --connection "Host=db.<project-ref>.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=<db-password>"

# Cách 2: Sửa tạm appsettings.Development.json dùng port 5432, rồi chạy bình thường
dotnet ef database update \
  --project Repository/Repository.csproj \
  --startup-project Api/Api.csproj
```

### Các lệnh thường dùng

```bash
# Tạo migration mới (sau khi sửa entity / AppDbContext)
dotnet ef migrations add <TênMigration> \
  --project Repository/Repository.csproj \
  --startup-project Api/Api.csproj

# Apply migration lên Supabase
dotnet ef database update \
  --project Repository/Repository.csproj \
  --startup-project Api/Api.csproj

# Xem danh sách migrations và trạng thái
dotnet ef migrations list \
  --project Repository/Repository.csproj \
  --startup-project Api/Api.csproj

# Rollback về migration trước (tên migration muốn quay về)
dotnet ef database update <TênMigrationMuốnQuayVề> \
  --project Repository/Repository.csproj \
  --startup-project Api/Api.csproj

# Xóa migration cuối chưa apply
dotnet ef migrations remove \
  --project Repository/Repository.csproj \
  --startup-project Api/Api.csproj
```

### Lỗi thường gặp & cách xử lý

#### ❌ `42P07: relation "table_name" already exists`

**Nguyên nhân:** Bảng đã được tạo thủ công (ví dụ qua Supabase SQL Editor hoặc MCP tool) nhưng chưa đăng ký vào `__EFMigrationsHistory`.

**Cách xử lý:**

```bash
# Bước 1: Lấy tên migration ID vừa tạo
dotnet ef migrations list --project Repository/Repository.csproj --startup-project Api/Api.csproj
# Ví dụ output: 20260503060214_AddSystemConfig

# Bước 2: Tìm ProductVersion của EF đang dùng
dotnet ef --version
# Ví dụ: 9.0.3

# Bước 3: Insert thủ công vào migration history trên Supabase SQL Editor
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260503060214_AddSystemConfig', '9.0.3')
ON CONFLICT ("MigrationId") DO NOTHING;

# Bước 4: Chạy lại database update — sẽ thấy "No migrations were applied. The database is already up to date."
dotnet ef database update --project Repository/Repository.csproj --startup-project Api/Api.csproj
```

#### ❌ DI Lifetime Conflict khi chạy `dotnet ef`

```
Cannot consume scoped service 'DbContextOptions<AppDbContext>' from singleton
```

**Nguyên nhân:** `AddDbContextFactory<T>(ServiceLifetime.Singleton)` xung đột với `AddDbContext<T>()` (scoped) vì cả hai chia sẻ cùng `DbContextOptions` (scoped).

**Cách xử lý đúng:** Singleton service cần DB access **không được** dùng `IDbContextFactory` khi đã có `AddDbContext`. Thay bằng `IServiceScopeFactory`:

```csharp
// ✅ ĐÚNG — Singleton service dùng IServiceScopeFactory
public class MyService : IMyService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public MyService(IServiceScopeFactory scopeFactory) { _scopeFactory = scopeFactory; }

    public async Task DoWorkAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // ... sử dụng db bình thường
    }
}

// ❌ SAI — Gây xung đột lifetime
builder.Services.AddDbContextFactory<AppDbContext>(..., ServiceLifetime.Singleton);
builder.Services.AddSingleton<IMyService, MyService>(); // MyService inject IDbContextFactory
```

#### ❌ Migration treo / timeout khi dùng Transaction Pooler

**Triệu chứng:** Lệnh `database update` chạy mãi không xong, log hiện `Acquiring an exclusive lock...`

**Nguyên nhân:** Transaction Pooler (port 6543) không hỗ trợ session-level locks.

**Cách xử lý:** Dùng **Direct Connection** (port 5432) — lấy từ Supabase Dashboard → Settings → Database → Connection String → chọn tab **"Direct connection"**.

### Workflow chuẩn khi thêm entity mới

```
1. Tạo Entity class trong Repository/Entities/
2. Thêm DbSet + OnModelCreating config vào AppDbContext.cs
3. dotnet ef migrations add <TênMigration> ...
4. Kiểm tra file migration vừa tạo (Repository/Migrations/)
5. dotnet ef database update ...  (dùng port 5432)
6. Verify: dotnet ef migrations list → tất cả hiển thị [applied]
7. Đăng ký service mới vào Program.cs (nếu có)
```

---


## 12. Services Overview

| Interface               | Trách nhiệm                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IAuthService`          | Đăng ký, đăng nhập, refresh token, đổi mật khẩu, forgot/reset password                                                                                                                                                                                           |
| `IUserService`          | Xem/cập nhật profile                                                                                                                                                                                                                                             |
| `IUserSettingsService`  | Cài đặt editor (font, size)                                                                                                                                                                                                                                      |
| `IProjectService`       | CRUD project, stats tác giả                                                                                                                                                                                                                                       |
| `IChapterService`       | CRUD chương, quản lý version (create/switch/pin/delete/prune), chunk                                                                                                                                                                                             |
| `ICharacterService`     | CRUD nhân vật + embed                                                                                                                                                                                                                                            |
| `IWorldbuildingService` | CRUD worldbuilding/lore + embed                                                                                                                                                                                                                                  |
| `IPlotNoteService`      | CRUD ghi chú cốt truyện + embed                                                                                                                                                                                                                                  |
| `IThemeService`         | CRUD chủ đề + embed                                                                                                                                                                                                                                              |
| `IStyleGuideService`    | CRUD cẩm nang phong cách + embed                                                                                                                                                                                                                                 |
| `IExportService`        | Export project/chapter ra file `.docx`, `.txt`, `.pdf`                                                                                                                                                                                                           |
| `IPaymentService`       | Quản lý thanh toán (VNPay), lưu lịch sử giao dịch                                                                                                                                                                                                         |
| `IGenreService`         | Quản lý thể loại (Admin)                                                                                                                                                                                                                                         |
| `ISubscriptionService`  | Quản lý gói dịch vụ                                                                                                                                                                                                                                              |
| `IAiChatService`        | RAG chat, lưu lịch sử, deduct token only                                                                                                                                                                                                                         |
| `IAiAnalysisHistoryService` | Lưu và truy xuất lịch sử phân tích cảnh/cliffhanger                                                                                                                                                                                                          |
| `IEmbeddingService`     | Gọi Gemini lấy embedding vector                                                                                                                                                                                                                                  |
| `IChunkingService`      | Chia text thành chunks với overlap                                                                                                                                                                                                                               |
| `IAiWritingService`     | Phân tích cảnh quay, cliffhanger và tuyến truyện (RAG)                                                                                                                                                                                                            |
| `IProjectReportService` | Phân tích & chấm điểm theo **Rubric 5 điểm** (1-Kém → 5-Xuất sắc), **Zero Hallucination**, chấm theo **Thể loại**, phát hiện **6 cảnh báo** (INCOMPLETE / REPETITION / PLAGIARISM_RISK / INCONSISTENCY / **SEXUAL_CONTENT** / **ANTI_STATE**), sinh `OverallFeedback` tâm huyết, chốt `ProjectVersionHash` snapshot của toàn bộ truyện. Sau khi AI hoàn tất, report được lưu trực tiếp dưới dạng `ReviewStatus=Released` để tác giả có thể xem ngay lập tức. Staff vẫn có thể hậu kiểm và chỉnh sửa văn bản hoặc xử lý vi phạm nếu cần. |
| `IProjectAnalysisJobService` | Quản lý job phân tích bất đồng bộ, progress, cancel, lấy kết quả                                                                                                                                                                                          |
| `INarrativeAnalyticsService` | Sinh dữ liệu biểu đồ nhịp độ (pacing) và dòng cảm xúc (emotion) (đã lược bỏ biểu đồ xuất hiện nhân vật và mạng quan hệ nhân vật để tối ưu độ nhiễu) |
| `IReportExportService` | Xuất báo cáo phân tích sang PDF                                                                                                                                                                                                                                   |
| `IEmailService`         | Gửi email (welcome, password reset) qua Gmail SMTP                                                                                                                                                                                                               |
| `IAdminService`         | Dashboard stats cho Admin                                                                                                                                                                                                                                        |
| `IBugReportService`     | CRUD bug reports, cập nhật trạng thái (Staff/Admin)                                                                                                                                                                                                              |
| `ITimelineEventService` | CRUD mốc sự kiện dòng thời gian, tự động sort order                                                                                                                                                                                                              |
| `IStaffService`         | Quản lý phản hồi, duyệt phân tích của Staff                                                                                                                                                                                                                      |
