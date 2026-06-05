# StoryRAG

Nền tảng hỗ trợ sáng tác truyện tích hợp AI theo mô hình **RAG (Retrieval-Augmented Generation)**, dùng PostgreSQL + pgvector để truy hồi ngữ cảnh từ chính dữ liệu truyện của tác giả.

> 💡 *Lưu ý về thương hiệu:* **StoryNest** là thương hiệu thương mại hiển thị trực tiếp tới tác giả (ở Client, Landing page và các thông báo), còn **StoryRAG** là tên kỹ thuật/tên repository chính thức nội bộ của dự án.

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
> `ProjectAnalysisJobs`, `StaffFeedbacks`, `faqs`, `writing_tips`, `StaffAnalysisReviews`.

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
  4. Chat/Analyze truy hoi context tu active chapter chunks (Story Bible tu dong boi AI)
- **Luong analyze async**:
  - Moi user chi co 1 job active.
  - Worker uu tien job theo goi subscription (plan cao duoc xu ly truoc).
  - Sau khi AI cham xong, report duoc phat hanh truc tiep (`Released`) giup tac gia xem duoc ngay lap tuc.
- **Thu tu API key embedding**: uu tien `Gemini:EmbeddingApiKey`; neu khong co thi dung `Gemini:ChatApiKey` roi moi fallback `Gemini:AnalyzeApiKey`.
- **Bao mat route frontend** da duoc ap dung bang `RouteGuard`, `RoleGuard`, va `ErrorBoundary`.

---

## Database schema (tom tat)

```
Users
  ├─< Projects
  │    ├─< Chapters ─< ChapterVersions ─< ChapterChunks (vector 768)
  │    ├─< ProjectReports ─< ReportItems
  │    │    └─< ProjectReportSnapshots (AI snapshot)
  │    ├─< ProjectAnalysisJobs ─> ProjectReports
  │    ├─< ProjectAnalysisFacts  (Story Bible snapshot bởi AI)
  │    ├─< ChatMessages
  │    └─< AiAnalysisHistories
  ├─< UserSubscriptions >─ SubscriptionPlans
  ├─< Payments
  ├─< BugReports
  ├─< StaffFeedbacks
  ├─< faqs / writing_tips
  ├─< StaffAnalysisReviews
  └─< SystemLogs           (nhật ký hệ thống)
```

> ⚠️ Các bảng `WorldbuildingEntries`, `CharacterEntries`, `StyleGuideEntries`, `ThemeEntries`, `PlotNoteEntries`, `TimelineEvents` đã bị xóa. Dữ liệu Story Bible giờ do AI tự trích xuất và lưu vào `ProjectAnalysisFacts` (snapshot model).

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
