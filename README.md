# StoryRAG

Nền tảng hỗ trợ sáng tác truyện tích hợp AI theo mô hình **RAG (Retrieval-Augmented Generation)**, dùng PostgreSQL + pgvector để truy hồi ngữ cảnh từ chính dữ liệu truyện của tác giả.

---

## Khoi chay nhanh

```bash
# Backend
cd Backend
dotnet restore
dotnet run --project Api
# Swagger: https://localhost:7259/swagger (hoac http://localhost:5182/swagger)

# Frontend
cd Frontend
npm install
npm run dev
# http://localhost:5173
```

---

## Database (Supabase)

1. Chay `Backend/supabase_full_reset.sql` trong Supabase SQL Editor de tao schema + seed.
2. Dung `Backend/supabase_full_reset.dbml` de visualize schema tren dbdiagram.io.

> `supabase_full_reset.sql` da bao gom day du cac bang phuc vu luong phan tich/staff:
> `ProjectAnalysisJobs`, `StaffFeedbacks`, `StaffKnowledgeBaseItems`, `StaffAnalysisReviews`.

---

## Tech stack

| Layer | Cong nghe |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, TailwindCSS 4, Axios, React Router 7 |
| Backend | ASP.NET Core (.NET 8), EF Core 9 |
| Database | PostgreSQL (Supabase) + pgvector |
| AI | Gemini (chat + embedding) |
| Auth | JWT Bearer + Refresh Token |

---

## Kien truc tong quan

- **Monorepo 2 app**: `Backend/` (Api + Service + Repository) va `Frontend/` (React SPA).
- **Luong Workspace -> RAG**:
  1. Luu chuong (`PUT /api/projects/{projectId}/chapters/{chapterId}`)
  2. Chunk (`POST .../chunk`)
  3. Embed (`POST /api/ai/chapters/{chapterId}/embed`)
  4. Chat/Analyze truy hoi context tu active version + Story Bible
- **Bao mat route frontend** da duoc ap dung bang `RouteGuard`, `RoleGuard`, va `ErrorBoundary`.

---

## Database schema (tom tat)

```
Users
  ├─< Projects
  │    ├─< Chapters ─< ChapterVersions ─< ChapterChunks (vector 768)
  │    ├─< ProjectReports ─< ProjectAnalysisJobs
  │    ├─< WorldbuildingEntries (vector 768)
  │    ├─< CharacterEntries (vector 768)
  │    ├─< StyleGuideEntries (vector 768)
  │    ├─< ThemeEntries (vector 768)
  │    ├─< PlotNoteEntries (vector 768)
  │    ├─< TimelineEvents
  │    ├─< ChatMessages
  │    └─< RewriteHistories / AiAnalysisHistories
  ├─< UserSubscriptions >─ SubscriptionPlans
  ├─< Payments
  ├─< BugReports
  ├─< StaffFeedbacks
  ├─< StaffKnowledgeBaseItems
  └─< StaffAnalysisReviews
```

---

## Cau truc thu muc

```
StoryRAG/
├── Backend/
│   ├── Api/                       # Controllers, Program.cs, appsettings
│   ├── Service/                   # Business logic + DTOs + helpers
│   ├── Repository/                # Entities, AppDbContext, migrations
│   ├── supabase_full_reset.sql    # Full reset schema + seed cho Supabase
│   └── supabase_full_reset.dbml   # Schema diagram cho dbdiagram.io
├── Frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── services/
│       ├── hooks/
│       └── utils/
└── README.md
```

---

## Tai lieu lien quan

- `SYSTEM_OVERVIEW.md` - Kien truc tong quan chi tiet.
- `AI_SECURITY_GUIDE.md` - Cac luu y bao mat AI/RAG.
- `Backend/README.md` - API backend.
- `Backend/API_DOCS.md` - API reference bo sung.
- `Frontend/README.md` - Mo ta frontend.
- `PROMPT_README.md` - Tong hop prompt dang dung.
