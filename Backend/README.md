# StoryRAG — Backend API Reference

**Base URL (local):** `http://localhost:5105/api`  
**Swagger UI:** `http://localhost:5105/swagger`

---

## 🔑 Authentication

Các endpoint có 🔒 phải gửi kèm header:
```
Authorization: Bearer <access_token>
```

**Icon legend:**
- 🔒 Yêu cầu Bearer Token (mọi role)
- 👑 Chỉ **Admin**
- ✍️ Chỉ **Author**
- 🧑‍💼 **Staff** hoặc **Admin**

---

## Roles

| Role | Mô tả |
|------|-------|
| `Author` | Tài khoản mặc định khi đăng ký |
| `Staff` | Nhân viên, được tạo bởi Admin |
| `Admin` | Quản trị viên, toàn quyền |

---

## 🔐 Auth — `/api/auth`

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/auth/register` | Đăng ký tài khoản (role mặc định: Author) |
| `POST` | `/auth/login` | Đăng nhập, trả về JWT + refresh token |
| `POST` | `/auth/google-login` | Đăng nhập bằng Google (gửi `idToken`) |
| `POST` | `/auth/refresh` | Làm mới access token |
| `PUT` | `/auth/change-password` 🔒 | Đổi mật khẩu |
| `POST` | `/auth/forgot-password` | Gửi email reset password |
| `POST` | `/auth/reset-password` | Đặt mật khẩu mới (dùng token từ email) |

> `POST /auth/google-login` yêu cầu cấu hình `GoogleAuth:ClientId` (hoặc biến môi trường `GoogleAuth__ClientId`) trên Backend.

**Response `POST /auth/login` (`200`)**
```json
{
  "userId": "guid", "fullName": "Nguyễn Văn A", "email": "user@example.com",
  "role": "Author", "accessToken": "jwt...", "refreshToken": "..."
}
```

---

## 👤 User — `/api/user`

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| `GET` | `/user/profile` | 🔒 | Lấy thông tin profile |
| `PUT` | `/user/profile` | 🔒 | Cập nhật FullName / AvatarURL |
| `GET` | `/user/settings` | 🔒 | Lấy cài đặt editor |
| `PUT` | `/user/settings` | 🔒 | Cập nhật cài đặt editor |

---

## 🗂️ Project — `/api/project`

> Tất cả endpoint yêu cầu 🔒 ✍️

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/project` | Danh sách dự án |
| `GET` | `/project/{id}` | Chi tiết dự án |
| `POST` | `/project` | Tạo dự án mới |
| `PUT` | `/project/{id}` | Cập nhật dự án |
| `DELETE` | `/project/{id}` | Xóa mềm dự án |
| `GET` | `/project/stats` | Thống kê dashboard |
| `GET` | `/project/{id}/export` | Export dự án (JSON/TXT) |

---

## 📖 Chapter — `/api/project/{projectId}/chapters`

> Tất cả endpoint yêu cầu 🔒 ✍️

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/chapters` | Danh sách chương |
| `GET` | `/chapters/{chapterId}` | Chi tiết chương + versions |
| `POST` | `/chapters` | Tạo chương mới |
| `PUT` | `/chapters/{chapterId}` | Cập nhật nội dung |
| `DELETE` | `/chapters/{chapterId}` | Xóa chương |
| `POST` | `/chapters/{chapterId}/chunk` | Chunk nội dung chương |
| `GET` | `/chapters/{chapterId}/versions` | Danh sách versions |
| `POST` | `/chapters/{chapterId}/versions` | Tạo version mới |
| `PUT` | `/chapters/{chapterId}/versions/{num}` | Đổi tên version |
| `DELETE` | `/chapters/{chapterId}/versions/{num}` | Xóa version |
| `POST` | `/chapters/{chapterId}/versions/{num}/switch` | Chuyển sang version |

---

## 🤖 AI — `/api/ai`

> Tất cả endpoint yêu cầu 🔒 ✍️

### Embedding & Chat

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/ai/chapters/{chapterId}/embed` | Embed tất cả chunks của version hiện tại |
| `POST` | `/ai/{projectId}/chat` | Hỏi AI (RAG từ chunks + context tables) |
| `GET` | `/ai/{projectId}/chat/history` | Lịch sử chat (`?page=1&pageSize=20`) |

**Body `POST /chat`**
```json
{ "question": "Nhân vật chính tên gì?" }
```

**Response `200`**
```json
{
  "answer": "Nhân vật chính là Phan...",
  "contextChunksUsed": 3,
  "inputTokens": 850, "outputTokens": 120, "totalTokens": 970
}
```

### Rewrite

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/ai/{projectId}/rewrite` | Viết lại đoạn văn được chọn |
| `POST` | `/ai/{projectId}/polish` | Trau chuốt đoạn văn và lưu vào lịch sử chat |
| `GET` | `/ai/{projectId}/rewrite/history` | Lịch sử các lần rewrite |

**Body `POST /rewrite`**
```json
{
  "chapterId": "guid",
  "selectedText": "Đoạn văn gốc...",
  "instruction": "Viết lại theo phong cách bi kịch hơn"
}
```

> `POST /ai/{projectId}/polish` trả kết quả giống `write/continue` (`generatedText`, `totalTokens`) và tự động ghi vào `GET /ai/{projectId}/chat/history`.

### Phân tích AI

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/ai/{projectId}/analyze` | Phân tích toàn bộ dự án (tốn quota) |
| `GET` | `/ai/{projectId}/reports` | Danh sách báo cáo phân tích |
| `GET` | `/ai/{projectId}/reports/{reportId}` | Chi tiết báo cáo |

**AI Context được đưa vào khi phân tích:**
- `WorldbuildingEntries` — Nhóm 8: Xây dựng thế giới
- `CharacterEntries` — Nhóm 2: Nhân vật
- `StyleGuideEntries` — Nhóm 4: Ngôn ngữ & phong cách  
- `ThemeEntries` — Nhóm 7: Chủ đề tác phẩm
- `PlotNoteEntries` — Nhóm 3 & 5: Cốt truyện & sự cuốn hút

**Response `POST /analyze` (`200`)**
```json
{
  "totalScore": 78,
  "classification": "Khá",
  "projectVersion": "v1.12.35",
  "overallFeedback": "Tác phẩm có nội tâm nhân vật sâu sắc...",
  "warnings": [
    {
      "code": "INCOMPLETE",
      "severity": "WARNING",
      "title": "Truyện chưa có kết thúc",
      "detail": "Cốt truyện dừng đột ngột giữa chương 5, chưa giải quyết mâu thuẫn chính."
    }
  ],
  "groups": [
    {
      "name": "Cốt truyện & Mạch lạc",
      "maxScore": 25, "score": 20,
      "criteria": [
        {
          "key": "1.1", "name": "Tính nhất quán nội bộ",
          "maxScore": 5, "score": 4,
          "feedback": "Mạch truyện logic nhưng có vài mâu thuẫn nhỏ.",
          "errors": ["..."],
          "suggestions": ["..."]
        }
      ]
    }
  ]
}
```

---

## 📚 Story Bible — Context Tables

> Tất cả endpoint yêu cầu 🔒 ✍️. Base: `/api/project/{projectId}`

Các bảng này cung cấp **context tự động** cho AI khi phân tích — lưu vào là AI biết ngay, không cần thao tác thêm.

### Worldbuilding — `/worldbuilding`

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/worldbuilding` | Danh sách entries |
| `POST` | `/worldbuilding` | Tạo mới |
| `PUT` | `/worldbuilding/{id}` | Cập nhật |
| `DELETE` | `/worldbuilding/{id}` | Xóa |
| `POST` | `/worldbuilding/{id}/embed` | Embed cho AI |

**Category values:** `Scene` (Cảnh), `Setting`, `Location`, `Rules`, `Glossary`, `Timeline`, `Magic`, `History`, `Religion`, `Geography`, `Technology`, `World`, `Other`

> **`Scene` (mới):** Dùng để mô tả phân cảnh cụ thể (căn phòng, vị trí kịch tính), khác với `Location` (vũng rộng) hay `Setting` (bối cảnh toàn cục).

### Characters — `/characters`

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/characters` | Danh sách nhân vật |
| `POST` | `/characters` | Tạo nhân vật |
| `PUT` | `/characters/{id}` | Cập nhật |
| `DELETE` | `/characters/{id}` | Xóa |
| `POST` | `/characters/{id}/embed` | Embed cho AI |

**Role values:** `Protagonist`, `Antagonist`, `Supporting`, `Minor`

### Style Guide — `/style-guides`

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/style-guides` | Danh sách quy tắc phong cách |
| `POST` | `/style-guides` | Tạo mới |
| `PUT` | `/style-guides/{id}` | Cập nhật |
| `DELETE` | `/style-guides/{id}` | Xóa |
| `POST` | `/style-guides/{id}/embed` | Embed cho AI |

Lưu mới/cập nhật sẽ tự động tạo embedding cho mục vừa lưu.

**Aspect values:** `POV`, `Tone`, `Vocabulary`, `Dialogue`, `Pacing`, `Other`

**Body `POST /style-guides`**
```json
{
  "aspect": "Tone",
  "content": "Giọng văn tối và u ám, thỉnh thoảng xen kẽ sự hài hước chua cay."
}
```

### Themes — `/themes`

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/themes` | Danh sách chủ đề |
| `POST` | `/themes` | Tạo chủ đề |
| `PUT` | `/themes/{id}` | Cập nhật |
| `DELETE` | `/themes/{id}` | Xóa |
| `POST` | `/themes/{id}/embed` | Embed cho AI |

Lưu mới/cập nhật sẽ tự động tạo embedding cho mục vừa lưu.

**Body `POST /themes`**
```json
{
  "title": "Sự cô đơn của quyền lực",
  "description": "Nhân vật chính càng leo lên đỉnh quyền lực, càng mất đi những người thân yêu.",
  "notes": "Thể hiện qua arc chương 5-12"
}
```

### Plot Notes — `/plot-notes`

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/plot-notes` | Danh sách ghi chú cốt truyện |
| `POST` | `/plot-notes` | Tạo mới |
| `PUT` | `/plot-notes/{id}` | Cập nhật |
| `DELETE` | `/plot-notes/{id}` | Xóa |
| `POST` | `/plot-notes/{id}/embed` | Embed cho AI |

Lưu mới/cập nhật sẽ tự động tạo embedding cho mục vừa lưu.

**Type values:** `Arc`, `Conflict`, `Foreshadowing`, `Twist`, `Climax`, `Resolution`, `Other`

**Body `POST /plot-notes`**
```json
{
  "type": "Foreshadowing",
  "title": "Chiếc gương vỡ",
  "content": "Cảnh gương vỡ ở chương 3 báo trước cái chết của nhân vật X ở chương 18."
}
```

---

## 💳 Subscription — `/api/subscription`

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| `GET` | `/subscription/plans` | 🔒 | Danh sách plan đang active |
| `GET` | `/subscription/plans/{id}` | 🔒 | Chi tiết plan |
| `POST` | `/subscription/plans` | 🔒 👑 | Tạo plan mới |
| `PUT` | `/subscription/plans/{id}` | 🔒 👑 | Cập nhật plan |
| `DELETE` | `/subscription/plans/{id}` | 🔒 👑 | Deactivate plan |
| `GET` | `/subscription/my` | 🔒 | Subscription hiện tại của user |

**Gói mặc định:**

| ID | Tên | Giá/tháng | Phân tích | Token AI |
|----|-----|-----------|-----------|----------|
| 1 | Free | 0đ | 3 lần | 20,000 |
| 2 | Basic | 99,000đ | 20 lần | 150,000 |
| 3 | Pro | 249,000đ | 100 lần | 500,000 |
| 4 | Enterprise | 699,000đ | 9,999 lần | 2,000,000 |

---

## 👑 Admin — `/api/admin`

> Chỉ role **Admin**. Role khác nhận `403 Forbidden`.

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/admin/users/stats` | Thống kê + danh sách toàn bộ user |
| `POST` | `/admin/users/{id}/toggle-active` | Bật/tắt tài khoản |
| `POST` | `/admin/users/{id}/change-role` | Đổi role user |
| `POST` | `/admin/subscriptions` | Cấp subscription thủ công |

---

## 🧑‍💼 Staff Operations Guide — `/api/staff`

> Tất cả endpoint dưới đây yêu cầu role **Staff** hoặc **Admin**.

### 1) Xem manuscript bị gắn cờ

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/staff/manuscripts/flagged` | Danh sách bản thảo cần staff xử lý |

**Query params:** `page=1&pageSize=20`

---

### 2) Feedback thủ công cho Author

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/staff/feedback` | Danh sách feedback (`?projectId=&page=&pageSize=`) |
| `POST` | `/staff/feedback` | Tạo feedback mới cho project/chapter |
| `PUT` | `/staff/feedback/{feedbackId}` | Cập nhật feedback |
| `DELETE` | `/staff/feedback/{feedbackId}` | Xóa feedback |

**Body `POST/PUT /staff/feedback`**
```json
{
  "projectId": "guid",
  "chapterId": "guid | null",
  "content": "Nhận xét chi tiết cho tác giả...",
  "staffNote": "Ghi chú nội bộ staff",
  "status": "Open"
}
```

`status`: `Open` | `Resolved`

---

### 3) Verify / Adjust / Re-run phân tích

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/staff/analyses/reviews` | Danh sách lịch sử review (`?projectId=&page=&pageSize=`) |
| `POST` | `/staff/analyses/{reportId}/review` | Review một report |

**Body `POST /staff/analyses/{reportId}/review`**
```json
{
  "action": "Verified",
  "note": "Kết quả đạt yêu cầu."
}
```

`action`: `Verified` | `Adjusted` | `RerunRequested`  
> `RerunRequested` chỉ áp dụng cho report chưa hoàn tất hoặc bị flag `INCOMPLETE`.

---

### 4) Quản lý FAQ / Writing Tips

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/staff/knowledge-base` | Danh sách FAQ/tips (`?type=&isPublished=&page=&pageSize=`) |
| `POST` | `/staff/knowledge-base` | Tạo item mới |
| `PUT` | `/staff/knowledge-base/{id}` | Cập nhật item |
| `DELETE` | `/staff/knowledge-base/{id}` | Xóa item |

**Body `POST/PUT /staff/knowledge-base`**
```json
{
  "type": "FAQ",
  "title": "Làm sao tăng pacing chương 1?",
  "content": "Ưu tiên xung đột sớm, giảm đoạn mô tả dài...",
  "tags": "pacing,chapter-1",
  "isPublished": true,
  "sortOrder": 10
}
```

`type`: `FAQ` | `WritingTip`

---

### 5) Cập nhật DB (Supabase/EF)

Sau khi pull code mới có Staff module, chạy:

```bash
dotnet ef database update --project Repository\Repository.csproj --startup-project Api\Api.csproj
```

Nếu bạn reset DB bằng `supabase_full_reset.sql`, cần đảm bảo migration mới `AddStaffFunctions` cũng được apply.

---

## ⚙️ Services quan trọng

| Service | Vai trò |
|---------|---------|
| `EmbeddingService` | `batchEmbedContents` với batch/token throttling (config qua `Gemini:Embedding*`), xoay key theo `Gemini:EmbedApiKey` + `Gemini:EmbedApiKey2` (hoặc `Gemini:EmbedApiKeys`), không fallback LM Studio |
| `AiChatService` | Gemini → LM Studio fallback (chỉ lỗi non-429), lưu lịch sử |
| `AiRewriteService` | Gemini → LM Studio fallback, lưu lịch sử |
| `ChunkingService` | 1500 ký tự, overlap 150, ưu tiên cắt tại `\n\n` → `.` → space |
| `AiWritingService` | Viết mới, tiếp nối, rất trau chuốt — tích hợp kỹ thuật **Show Don't Tell** & **Pacing** |
| `ProjectReportService` | Rubric **5 điểm** (1-Kém → 5-Xuất sắc), phát hiện **4 loại cảnh báo** (INCOMPLETE/REPETITION/PLAGIARISM\_RISK/INCONSISTENCY), **Zero Hallucination**, chấm theo **Thể loại**; phân tích ưu tiên `Gemini:AnalyzeApiKey`, fallback sang pool `Gemini:ChatApiKey`/`Gemini:ChatApiKeys`, cuối cùng mới về LM Studio |
| `GeminiRetryHelper` | Backoff [10s, 30s, 65s] cho 429; throw lỗi thân thiện sau 3 lần |
| `EncryptionHelper` | AES-256 với user DEK + Master Key |

> Khuyến nghị cấu hình đủ 4 key ở môi trường chạy: `Gemini__ChatApiKey`, `Gemini__EmbedApiKey`, `Gemini__EmbedApiKey2`, `Gemini__AnalyzeApiKey`.

---

## 📊 Database Schema

```
Users                   — uuid PK, Role ∈ {Admin, Author, Staff}
Projects                — uuid PK, FK→Users, AiInstructions, SummaryEmbedding vector(768)
Chapters                — uuid PK, FK→Projects
ChapterVersions         — uuid PK, FK→Chapters, Content, IsChunked, IsEmbedded, IsPinned
ChapterChunks           — uuid PK, FK→ChapterVersions, Embedding vector(768)

WorldbuildingEntries    — uuid PK, FK→Projects, Embedding vector(768)
CharacterEntries        — uuid PK, FK→Projects, Embedding vector(768)
StyleGuideEntries       — uuid PK, FK→Projects, Aspect, Embedding vector(768)
ThemeEntries            — uuid PK, FK→Projects, Title/Description, Embedding vector(768)
PlotNoteEntries         — uuid PK, FK→Projects, Type, Embedding vector(768)

ChatMessages            — uuid PK, FK→Projects, FK→Users
RewriteHistories        — uuid PK, FK→Projects, FK→Users
ProjectReports          — uuid PK, FK→Projects, CriteriaJson (jsonb), ProjectVersion (text)
StaffFeedbacks          — uuid PK, feedback staff cho author/project/chapter
StaffKnowledgeBaseItems — uuid PK, FAQ/WritingTip do staff quản trị
StaffAnalysisReviews    — uuid PK, thao tác review/rerun report của staff
 
SubscriptionPlans       — int PK (seed: Free/Basic/Pro/Enterprise)
UserSubscriptions       — int PK, FK→Users, FK→SubscriptionPlans
Payments                — uuid PK, FK→Users, FK→SubscriptionPlans
BugReports              — uuid PK, FK→Users
UserSettings            — uuid PK (1:1 Users)
Genres                  — int PK (14 thể loại)
ProjectGenres           — composite PK (ProjectId, GenreId)
```

---

## 🗄️ Database Reset

Chạy `supabase_full_reset.sql` trên **Supabase SQL Editor** để:
1. Xóa toàn bộ tables (CASCADE)
2. Tạo lại schema mới nhất (bao gồm 3 bảng context mới)
3. Seed data (14 genres, 4 subscription plans)
4. Ghi EF Migrations History (không cần chạy `dotnet ef database update`)
