# StoryRAG

Ứng dụng hỗ trợ tác giả viết truyện với AI, sử dụng kỹ thuật **RAG (Retrieval-Augmented Generation)** — lưu nội dung dưới dạng vector embedding để AI có thể trả lời câu hỏi chính xác về bối cảnh, nhân vật, cốt truyện.

---

## 🏗️ Kiến trúc tổng thể

```
StoryRAG/
├── Backend/   — ASP.NET Core Web API · PostgreSQL + pgvector · Gemini API
└── Frontend/  — React 18 + TypeScript + Vite + TailwindCSS
```

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **Editor** | Workspace soạn thảo chương truyện với auto-save, quản lý phiên bản |
| **Auto Embed** | Lưu chương → tự động chunk + embed ngầm → AI sẵn sàng ngay |
| **AI Chat (RAG)** | Hỏi AI về nội dung truyện, nhân vật, bối cảnh dựa trên vector search |
| **Lịch sử Chat** | Lưu toàn bộ Q&A theo dự án, xem lại bất cứ lúc nào |
| **AI Rewrite** | Bôi đen đoạn văn → nhờ AI viết lại → xem lịch sử thay đổi |
| **Phân tích AI** | Chấm điểm bản thảo theo rubric 100 điểm (14 tiêu chí, 5 nhóm) |
| **Worldbuilding** | Quản lý bối cảnh, nhân vật — được đưa vào context khi hỏi AI |
| **Gói đăng ký** | Free / Basic / Pro / Enterprise với giới hạn phân tích và token |

---

## 🤖 AI Providers

| Provider | Vai trò | Model |
|----------|---------|-------|
| **Gemini API** (primary) | Chat + Embedding | `gemini-2.0-flash` / `gemini-embedding-001` |
| **LM Studio** (fallback) | Chat khi Gemini lỗi non-429 | `qwen/qwen3.5-9b` (tùy chọn) |

> **Free tier Gemini:** ~15 RPM cho chat, 100 RPM cho embedding. Backend tự động retry với backoff [10s → 30s → 65s] khi gặp 429. Embedding dùng `batchEmbedContents` — toàn bộ chunks trong 1 HTTP call.

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
    ↓ (indicator "AI sẵn sàng" trên navbar)

Hỏi AI
    ↓
[4] Embed câu hỏi → vector
    ↓
[5] Cosine search — TopK chunks (chapter + worldbuilding + characters)
    ↓
[6] Gemini trả lời dựa trên context chunks
```

---

## 🔧 Backend

### Công nghệ

- **Framework:** ASP.NET Core (.NET 8)
- **Database:** PostgreSQL + pgvector extension
- **ORM:** Entity Framework Core
- **Auth:** JWT Bearer Token
- **AI Primary:** Google Gemini API (via HTTP + OpenAI SDK compatible endpoint)
- **AI Fallback:** LM Studio (OpenAI-compatible local server)

### Cấu trúc 3 layers

| Layer | Thư mục | Vai trò |
|-------|---------|---------|
| API | `Api/Controllers/` | HTTP endpoints, routing, DI |
| Service | `Service/` | Business logic, AI integration, DTOs |
| Repository | `Repository/` | Entities, DbContext, Migrations |

### Controllers

| Controller | Route | Mô tả |
|------------|-------|-------|
| `AuthController` | `/api/auth` | Đăng ký, đăng nhập, đổi mật khẩu |
| `UserController` | `/api/user` | Profile, cài đặt |
| `ProjectController` | `/api/project` | CRUD dự án + stats dashboard |
| `ChapterController` | `/api/project/{id}/chapters` | Chương, phiên bản, chunking |
| `AiController` | `/api/ai` | Embed, Chat (RAG), Rewrite, Phân tích, Lịch sử |
| `WorldbuildingController` | `/api/project/{id}/worldbuilding` | Quản lý bối cảnh |
| `CharacterController` | `/api/project/{id}/characters` | Quản lý nhân vật |
| `SubscriptionController` | `/api/subscription` | Gói đăng ký |
| `AdminController` | `/api/admin` | Quản trị user, thống kê |
| `GenreController` | `/api/genre` | Thể loại truyện |

### Database Schema

```
Users
 ├── Projects
 │    ├── Chapters
 │    │    └── ChapterVersions
 │    │         └── ChapterChunks  (embedding: vector(768))
 │    ├── ProjectReports        (AI scoring)
 │    ├── WorldbuildingEntries  (embedding: vector(768))
 │    └── CharacterEntries      (embedding: vector(768))
 ├── AiChatMessages            (lịch sử Q&A, encrypted)
 ├── RewriteHistories          (lịch sử rewrite, encrypted)
 └── UserSubscriptions → SubscriptionPlans

SubscriptionPlans  (seed: Free / Basic / Pro / Enterprise)
UserSettings       (editor font, size, theme...)
```

### Bảo mật nội dung

Toàn bộ nội dung truyện được **mã hóa AES** trong database:
- Mỗi user có **DEK** (Data Encryption Key) riêng.
- DEK được mã hóa bằng **Master Key** trong config.
- Nội dung chỉ giải mã trong memory khi cần xử lý.

### Cấu hình (`appsettings.Development.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=storyrag;Username=postgres;Password=..."
  },
  "Jwt": {
    "Key": "your-secret-key-min-32-chars",
    "Issuer": "StoryRAG",
    "Audience": "StoryRAG"
  },
  "Gemini": {
    "ApiKey": "AIza...",
    "ChatModel": "gemini-2.0-flash",
    "EmbeddingModel": "gemini-embedding-001",
    "EmbeddingDimensions": "768"
  },
  "AI": {
    "BaseUrl": "http://localhost:1234/v1",
    "ApiKey": "lm-studio",
    "ChatModel": "qwen/qwen3.5-9b",
    "EmbeddingModel": "nomic-embed-text"
  },
  "Security": {
    "MasterKey": "your-master-key-min-32-chars"
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

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Styling:** TailwindCSS + CSS Variables (design tokens)
- **HTTP:** Axios
- **Icons:** Lucide React

### Pages

| Page | Route | Mô tả |
|------|-------|-------|
| `LandingPage` | `/` | Trang giới thiệu |
| `LoginPage` | `/login` | Đăng nhập |
| `RegisterPage` | `/register` | Đăng ký |
| `HomePage` | `/home` | Dashboard: stats thực tế (dự án, chương, phân tích, chat) |
| `ProjectsPage` | `/projects` | Danh sách dự án |
| `WorkspacePage` | `/workspace/:projectId` | Editor + AI Chat + Rewrite + Worldbuilding |
| `AnalysisPage` | `/analysis` | Phân tích AI — chấm điểm 100 điểm |
| `SubscriptionPage` | `/subscription` | Subscription hiện tại |
| `PlansPage` | `/plans` | Xem và chọn gói |
| `ProfilePage` | `/profile` | Thông tin cá nhân |
| `SettingsPage` | `/settings` | Cài đặt editor |
| `AdminDashboardPage` | `/admin` | Quản trị user |
| `AdminSubscriptionPage` | `/admin/subscription` | Quản trị gói |

### WorkspacePage — UX chính

```
Ctrl+S hoặc nút "Lưu"
  → Lưu nội dung ngay
  → Toast "✅ Đã lưu"
  → Ngầm: Chunk → Embed (indicator trên navbar)
    "⏳ Đồng bộ AI..." → "✨ AI sẵn sàng"
```

**Panels:**
- **Left** — Danh sách chương, thêm/xóa chương
- **Center** — Editor contentEditable: font tùy chỉnh, bold/italic/underline, word count
- **Right** — AI Chat (RAG) / Lịch sử phiên bản / Chat cũ
- **Floating toolbar** — Bôi đen văn bản → nút "✨ Viết lại" → `RewritePanel`

### Design System (Notion/Linear style)

**Theme:** Dark `#111111` + Purple `#8b5cf6` · Light `#ffffff` + Purple `#7c3aed`

| Token | Light | Dark |
|-------|-------|------|
| `--bg-app` | `#f8f8f8` | `#111111` |
| `--bg-surface` | `#ffffff` | `#1a1a1a` |
| `--bg-sidebar` | `#f3f3f3` | `#161616` |
| `--accent` | `#7c3aed` | `#8b5cf6` |
| `--text-primary` | `#0f0f0f` | `#f5f5f5` |
| `--text-secondary` | `#6b7280` | `#a1a1aa` |

### Toast System

```tsx
import { useToast } from '../components/Toast';

const toast = useToast();
toast.success('Đã lưu thành công');
toast.error('Lỗi: ...');
toast.info('AI đang đồng bộ...');
toast.warning('Quota hết, thử lại sau');
```

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
| 1 | Cốt truyện & Mạch lạc (tính nhất quán, nhân quả, nút thắt) | 25 |
| 2 | Xây dựng Nhân vật (động cơ, chiều sâu, đối thoại) | 25 |
| 3 | Ngôn từ & Văn phong (ngữ pháp, cấu trúc câu, tránh sáo ngữ) | 20 |
| 4 | Sáng tạo & Thể loại (độ sáng tạo, đặc trưng thể loại, sức cuốn hút) | 20 |
| 5 | Tuân thủ & Hoàn thiện (mức độ hoàn thiện, định dạng) | 10 |

| Điểm | Kết quả |
|------|---------|
| > 85 | ✅ Xuất sắc |
| 71–85 | 🟢 Khá |
| 51–70 | 🟡 Trung bình |
| ≤ 50 | 🔴 Cần sửa lớn |

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

> **LM Studio (tuỳ chọn):** Chỉ cần nếu muốn có fallback khi Gemini gặp lỗi non-429. Tải model `nomic-embed-text` và `qwen/qwen3.5-9b`, bật server tại `http://localhost:1234`.


---

## 🏗️ Kiến trúc tổng thể

```
StoryRAG/
├── Backend/   — ASP.NET Core Web API, PostgreSQL + pgvector
└── Frontend/  — React + TypeScript + Vite + TailwindCSS
```

---

## 🔧 Backend

### Công nghệ
- **Framework:** ASP.NET Core (.NET)
- **Database:** PostgreSQL + pgvector (lưu vector embedding)
- **AI:** OpenAI-compatible API (chạy local qua LM Studio)
- **Auth:** JWT Bearer Token
- **ORM:** Entity Framework Core

### Cấu trúc 3 layers

| Layer | Thư mục | Vai trò |
|-------|---------|---------|
| API | `Api/Controllers/` | HTTP endpoints, routing |
| Service | `Service/` | Business logic, DTOs |
| Repository | `Repository/` | Entities, DbContext, Migrations |

### Controllers

| Controller | Route | Mô tả |
|------------|-------|-------|
| `AuthController` | `/api/auth` | Đăng ký, đăng nhập, đổi mật khẩu |
| `UserController` | `/api/user` | Xem/cập nhật profile |
| `ProjectController` | `/api/project` | CRUD dự án truyện |
| `ChapterController` | `/api/chapter` | Quản lý chương, chunking |
| `AiController` | `/api/ai` | Embed chapter, AI Chat (RAG), **Phân tích & chấm điểm AI** |
| `SubscriptionController` | `/api/subscription` | Quản lý gói đăng ký |
| `AdminController` | `/api/admin` | Quản trị user, thống kê |
| `GenreController` | `/api/genre` | Thể loại truyện |

### Roles

| Role | Mô tả |
|------|-------|
| `Author` | Tài khoản mặc định khi đăng ký |
| `Staff` | Nhân viên, được tạo bởi Admin |
| `Admin` | Quản trị viên, toàn quyền |

### Luồng RAG

```
Viết chương → Chunking → Embedding (vector) → Lưu pgvector
                                                      ↓
Đặt câu hỏi → Embed câu hỏi → Vector Search (cosine) → TopK chunks → LLM → Trả lời
```

1. **Chunking** — `ChunkingService` cắt text thành chunks (mặc định 1500 ký tự, overlap 150), ưu tiên cắt tại ranh giới đoạn văn → câu → khoảng trắng.
2. **Embedding** — `EmbeddingService` gọi model embedding (mặc định `nomic-embed-text`) tạo vector cho từng chunk.
3. **Vector Search** — pgvector tìm `TopK = 5` chunks gần nhất theo cosine distance.
4. **AI Chat** — `AiChatService` gọi LLM (mặc định `qwen/qwen3.5-9b`) với RAG context → trả lời câu hỏi về nội dung truyện bằng tiếng Việt.
5. **AI Scoring** — `ProjectReportService` đánh giá bản thảo theo **rubric 100 điểm** (14 tiêu chí, 5 nhóm). Tự động fallback sang dữ liệu mẫu nếu LLM chưa sẵn sàng.

### Bảo mật nội dung

Toàn bộ nội dung truyện được **mã hóa** trong database:
- Mỗi user có một **DEK** (Data Encryption Key) riêng.
- DEK được mã hóa bằng **Master Key** lưu trong config (`Security:MasterKey`).
- Nội dung chỉ được giải mã trong memory khi cần xử lý.

### Database Schema

```
Users
 └── Projects
      └── Chapters
           └── ChapterVersions
                └── ChapterChunks  (embedding: vector)
      └── ProjectReports  (AI scoring results)

SubscriptionPlans
 └── UserSubscriptions → Users
```

### Gói đăng ký (Seed data)

| Gói | Giá/tháng | Phân tích | Token AI |
|-----|-----------|-----------|----------|
| Free | 0đ | 3 lần | 20,000 |
| Basic | 99,000đ | 20 lần | 150,000 |
| Pro | 249,000đ | 100 lần | 500,000 |
| Enterprise | 699,000đ | 9,999 lần | 2,000,000 |

### Cấu hình (`appsettings.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=...;Database=...;Username=...;Password=..."
  },
  "Jwt": {
    "Key": "...",
    "Issuer": "StoryRAG",
    "Audience": "StoryRAG"
  },
  "AI": {
    "BaseUrl": "http://localhost:1234/v1",
    "ApiKey": "lm-studio",
    "EmbeddingModel": "nomic-embed-text",
    "ChatModel": "qwen/qwen3.5-9b"
  },
  "Security": {
    "MasterKey": "..."
  }
}
```

### Chạy Backend

```bash
cd Backend
dotnet restore
dotnet run --project Api
```

API chạy tại `http://localhost:5105`  
Swagger UI: `http://localhost:5105/swagger`

---

## 🎨 Frontend

### Công nghệ
- **Framework:** React 18 + TypeScript
- **Build tool:** Vite
- **Styling:** TailwindCSS
- **HTTP Client:** Axios

### Cấu trúc

```
Frontend/src/
├── pages/       — Các trang chính
├── components/  — Sidebar, Topbar
├── services/    — Axios API calls
├── hooks/       — Custom React hooks
├── layouts/     — Layout wrappers
└── utils/       — Tiện ích
```

### Pages

| Page | Route | Mô tả |
|------|-------|-------|
| `LandingPage` | `/` | Trang giới thiệu |
| `LoginPage` | `/login` | Đăng nhập |
| `RegisterPage` | `/register` | Đăng ký |
| `HomePage` | `/home` | Trang chủ sau đăng nhập |
| `ProjectsPage` | `/projects` | Danh sách dự án |
| `WorkspacePage` | `/workspace/:projectId` | Editor viết truyện |
| `AnalysisPage` | `/analysis` | Phân tích AI — chấm điểm bản thảo theo rubric 100 điểm |
| `SubscriptionPage` | `/subscription` | Subscription hiện tại |
| `PlansPage` | `/plans` | Xem và chọn gói |
| `ProfilePage` | `/profile` | Thông tin cá nhân |
| `SettingsPage` | `/settings` | Cài đặt |
| `AdminDashboardPage` | `/admin` | Quản trị user |
| `AdminSubscriptionPage` | `/admin/subscription` | Quản trị gói đăng ký |

### Chạy Frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:5173`

### 🎨 Color Palette

Bộ màu **Warm Parchment × Midnight Ink** — thiết kế để dễ đọc khi viết lâu.

**☀️ Light Mode — Warm Parchment**

| Token | Hex | Mô tả |
|---|---|---|
| `--bg-app` | `#ede8e1` | Kem giấy ấm (nền chính) |
| `--bg-sidebar` | `#e4ddd5` | Kem đậm (sidebar) |
| `--bg-surface` | `#f5f1ec` | Nền card/panel |
| `--bg-topbar` | `#e4ddd5` | Topbar |
| `--text-primary` | `#1c1611` | Nâu đen ấm |
| `--text-secondary` | `#6b5f54` | Nâu xám |
| `--border-color` | `#d0c9c0` | Viền kem |
| `--input-bg` | `#ede8e3` | Nền input |

**🌙 Dark Mode — Midnight Ink**

| Token | Hex | Mô tả |
|---|---|---|
| `--bg-app` | `#0d0b12` | Đen tím sâu (nền chính) |
| `--bg-sidebar` | `#161320` | Tím đen (sidebar) |
| `--bg-surface` | `#1d1a2a` | Nền card/panel |
| `--bg-topbar` | `#161320` | Topbar |
| `--text-primary` | `#f0ecf8` | Trắng ấm (tím nhẹ) |
| `--text-secondary` | `#9b93ab` | Tím xám nhạt |
| `--border-color` | `rgba(255,255,255,0.06)` | Viền mờ |
| `--input-bg` | `#221f30` | Nền input tối |

---

## 📊 Rubric chấm điểm AI (100 điểm)

Tính năng **Phân tích AI** đánh giá bản thảo theo 5 nhóm tiêu chí:

| # | Nhóm | Tiêu chí | Điểm tối đa |
|---|------|----------|-------------|
| 1 | Cốt truyện & Mạch lạc | Tính nhất quán nội bộ (1.1), Liên kết nhân quả (1.2), Nút thắt & Giải quyết (1.3) | 25 |
| 2 | Xây dựng Nhân vật | Động cơ & Hành động (2.1), Chiều sâu nhân vật (2.2), Tương tác & Đối thoại (2.3) | 25 |
| 3 | Ngôn từ & Văn phong | Ngữ pháp & Sự rõ ràng (3.1), Đa dạng cấu trúc câu (3.2), Tránh sáo ngữ (3.3) | 20 |
| 4 | Sáng tạo & Thể loại | Độ sáng tạo (4.1), Đặc trưng thể loại (4.2), Sức cuốn hút (4.3) | 20 |
| 5 | Tuân thủ & Hoàn thiện | Mức độ hoàn thiện bản thảo (5.1), Tuân thủ định dạng (5.2) | 10 |

**Phân loại kết quả:**

| Điểm | Phân loại |
|------|-----------|
| > 85 | ✅ Xuất sắc |
| 71–85 | 🟢 Khá |
| 51–70 | 🟡 Trung bình |
| ≤ 50 | 🔴 Cần sửa lớn |

> **Lưu ý:** Cần chunk và embed nội dung trong Workspace trước khi phân tích để AI có ngữ cảnh chính xác. Nếu chưa embed, hệ thống tự động trả về dữ liệu mẫu (`MockData`).

---

## 🚀 Khởi chạy toàn bộ

1. Cài đặt [LM Studio](https://lmstudio.ai), tải model embedding (`nomic-embed-text`) và chat (`qwen/qwen3.5-9b`), bật local server tại `http://localhost:1234`.
2. Tạo database PostgreSQL, bật extension `vector`.
3. Cấu hình `Backend/Api/appsettings.Development.json`.
4. Chạy migration: `dotnet ef database update --project Repository --startup-project Api`
5. Chạy Backend: `dotnet run --project Api`
6. Chạy Frontend: `npm run dev` (trong thư mục `Frontend`)
