# StoryRAG

Ứng dụng hỗ trợ tác giả viết truyện với AI, sử dụng kỹ thuật RAG (Retrieval-Augmented Generation) để phân tích và trả lời câu hỏi về nội dung truyện.

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
4. **AI Chat** — `AiChatService` gọi LLM (mặc định `llama-3.2-3b-instruct`) với RAG context → trả lời câu hỏi về nội dung truyện bằng tiếng Việt.
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
    "ChatModel": "llama-3.2-3b-instruct"
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

1. Cài đặt [LM Studio](https://lmstudio.ai), tải model embedding (`nomic-embed-text`) và chat (`llama-3.2-3b-instruct`), bật local server tại `http://localhost:1234`.
2. Tạo database PostgreSQL, bật extension `vector`.
3. Cấu hình `Backend/Api/appsettings.Development.json`.
4. Chạy migration: `dotnet ef database update --project Repository --startup-project Api`
5. Chạy Backend: `dotnet run --project Api`
6. Chạy Frontend: `npm run dev` (trong thư mục `Frontend`)
