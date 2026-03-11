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

---

## Roles

| Role | Mô tả |
|------|-------|
| `Author` | Tài khoản mặc định khi đăng ký |
| `Staff` | Nhân viên, được tạo bởi Admin |
| `Admin` | Quản trị viên, toàn quyền |

---

## 🔐 Auth — `/api/auth`

### `POST /auth/register`
Đăng ký tài khoản mới (role mặc định: **Author**). Không cần token.

**Body**
```json
{ "fullName": "Nguyễn Văn A", "email": "user@example.com", "password": "123456" }
```

**Response `200`**
```json
{
  "userId": "guid", "fullName": "Nguyễn Văn A", "email": "user@example.com",
  "role": "Author", "accessToken": "jwt...", "refreshToken": "..."
}
```

### `POST /auth/login`
**Body** `{ "email": "...", "password": "..." }` → **Response `200`** giống Register.

### `PUT /auth/change-password` 🔒
**Body** `{ "oldPassword": "...", "newPassword": "..." }` → `{ "message": "Đổi mật khẩu thành công." }`

---

## 👤 User — `/api/user`

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/user/profile` 🔒 | Lấy thông tin profile |
| `PUT` | `/user/profile` 🔒 | Cập nhật FullName / AvatarURL |
| `GET` | `/user/settings` 🔒 | Lấy cài đặt editor |
| `PUT` | `/user/settings` 🔒 | Cập nhật cài đặt editor |

---

## 🗂️ Project — `/api/project`

> Tất cả endpoint yêu cầu 🔒 ✍️

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/project` | Danh sách dự án của user |
| `GET` | `/project/{id}` | Chi tiết dự án |
| `POST` | `/project` | Tạo dự án mới |
| `PUT` | `/project/{id}` | Cập nhật dự án |
| `DELETE` | `/project/{id}` | Xóa mềm dự án |
| `GET` | `/project/stats` | Thống kê dashboard: `{ totalChapters, totalAnalysesUsed, totalChatMessages }` |

---

## 📖 Chapter — `/api/project/{projectId}/chapters`

> Tất cả endpoint yêu cầu 🔒 ✍️

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/chapters` | Danh sách chương |
| `GET` | `/chapters/{chapterId}` | Chi tiết chương + versions + chunks |
| `POST` | `/chapters` | Tạo chương mới |
| `PUT` | `/chapters/{chapterId}` | Cập nhật tiêu đề / nội dung |
| `DELETE` | `/chapters/{chapterId}` | Xóa chương |
| `POST` | `/chapters/{chapterId}/chunk` | Chunk chương hiện tại |
| `GET` | `/chapters/{chapterId}/versions` | Danh sách versions |
| `POST` | `/chapters/{chapterId}/versions` | Tạo version mới |
| `PUT` | `/chapters/{chapterId}/versions/{num}` | Đổi tên version |
| `DELETE` | `/chapters/{chapterId}/versions/{num}` | Xóa version |
| `POST` | `/chapters/{chapterId}/versions/{num}/switch` | Chuyển sang version |

**Response `GET /chapters/{chapterId}`**
```json
{
  "id": "guid", "chapterNumber": 1, "title": "Chương 1", "wordCount": 850,
  "currentVersionNum": 1,
  "versions": [
    {
      "versionNumber": 1, "title": "Version 1", "content": "...",
      "isChunked": true, "isEmbedded": true, "tokenCount": 1200,
      "chunks": [{ "id": "guid", "chunkIndex": 0, "content": "..." }]
    }
  ]
}
```

---

## 🤖 AI — `/api/ai`

> Tất cả endpoint yêu cầu 🔒 ✍️

### Embedding

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/ai/chapters/{chapterId}/embed` | Embed tất cả chunks của version hiện tại |

**Flow embed:** Chunks → `batchEmbedContents` (tối đa 100/batch, delay 2s giữa các batch) → vector(768) → pgvector

**Response `200`**
```json
{ "message": "Đã embed 24 chunks thành công." }
```

**Errors**
```json
{ "message": "Version chưa được chunk. Hãy chunk trước khi embed." }
{ "message": "AI đang quá tải, vui lòng thử lại sau khoảng 1 phút." }
```

---

### AI Chat (RAG)

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/ai/{projectId}/chat` | Hỏi AI về nội dung truyện |
| `GET` | `/ai/{projectId}/chat/history` | Lấy lịch sử chat (phân trang) |

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

**Query `GET /chat/history`**
```
?page=1&pageSize=20
```

**Response `200`**
```json
{
  "items": [
    { "id": "guid", "question": "...", "answer": "...", "createdAt": "...", "totalTokens": 970 }
  ],
  "totalCount": 42, "page": 1, "pageSize": 20
}
```

**Lưu ý 429:** Backend tự động retry với backoff [10s → 30s → 65s]. Nếu vẫn 429 sau 3 lần → trả `400` với message thân thiện thay vì fallback LM Studio.

---

### AI Rewrite

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/ai/{projectId}/rewrite` | Viết lại đoạn văn được chọn |
| `GET` | `/ai/{projectId}/rewrite/history` | Lịch sử các lần rewrite |

**Body `POST /rewrite`**
```json
{
  "chapterId": "guid",
  "selectedText": "Đoạn văn gốc...",
  "instruction": "Viết lại theo phong cách bi kịch hơn"
}
```

**Response `200`**
```json
{ "rewritten": "Đoạn văn đã được viết lại...", "historyId": "guid" }
```

---

### AI Phân tích

| Method | Route | Mô tả |
|--------|-------|-------|
| `POST` | `/ai/{projectId}/analyze` | Phân tích toàn bộ dự án (trừ quota) |
| `GET` | `/ai/{projectId}/reports` | Danh sách các báo cáo phân tích |
| `GET` | `/ai/{projectId}/reports/{reportId}` | Chi tiết một báo cáo |

**Response `POST /analyze` (`200`)**
```json
{
  "totalScore": 78,
  "grade": "Khá",
  "groups": [
    {
      "groupName": "Cốt truyện & Mạch lạc",
      "maxScore": 25, "score": 20,
      "criteria": [
        { "name": "Tính nhất quán nội bộ", "maxScore": 9, "score": 8, "feedback": "..." }
      ]
    }
  ],
  "overallFeedback": "..."
}
```

---

## 🌍 Worldbuilding & Characters — `/api/project/{projectId}`

> Tất cả endpoint yêu cầu 🔒 ✍️

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET/POST` | `/worldbuilding` | Danh sách / Tạo mục worldbuilding |
| `PUT/DELETE` | `/worldbuilding/{id}` | Cập nhật / Xóa |
| `POST` | `/worldbuilding/{id}/embed` | Embed mục worldbuilding |
| `GET/POST` | `/characters` | Danh sách / Tạo nhân vật |
| `PUT/DELETE` | `/characters/{id}` | Cập nhật / Xóa |
| `POST` | `/characters/{id}/embed` | Embed nhân vật |

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

#### Gói mặc định (seed)

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
| `POST` | `/admin/subscriptions` | Cấp subscription thủ công cho user |

---

## 📊 Database Schema

```
Users          — uuid PK, Role ∈ {Admin, Author, Staff}, DataEncryptionKey (encrypted)
Projects       — uuid PK, FK→Users(AuthorId), Title/Summary (encrypted)
Chapters       — uuid PK, FK→Projects
ChapterVersions — uuid PK, FK→Chapters, Content (encrypted), IsChunked, IsEmbedded
ChapterChunks  — uuid PK, FK→ChapterVersions, Content (encrypted), Embedding vector(768)

WorldbuildingEntries — uuid PK, FK→Projects, Content (encrypted), Embedding vector(768)
CharacterEntries     — uuid PK, FK→Projects, Content (encrypted), Embedding vector(768)

AiChatMessages — uuid PK, FK→Projects, FK→Users, Question/Answer (encrypted)
RewriteHistories — uuid PK, FK→Projects, FK→Users, OriginalText/RewrittenText (encrypted)
ProjectReports — uuid PK, FK→Projects, JSON result

SubscriptionPlans   — int PK
UserSubscriptions   — int PK, FK→Users, FK→SubscriptionPlans, UsedAnalysisCount
UserSettings        — uuid PK, FK→Users, EditorFont, EditorFontSize, Theme
```

---

## ⚙️ Services quan trọng

| Service | Mô tả |
|---------|-------|
| `EmbeddingService` | `batchEmbedContents` (max 100/batch, delay 2s), vector(768), Gemini primary |
| `AiChatService` | Gemini → LM Studio fallback (chỉ lỗi non-429), lưu lịch sử encrypted |
| `AiRewriteService` | Gemini → LM Studio fallback, lưu lịch sử encrypted |
| `ChunkingService` | 1500 ký tự, overlap 150, ưu tiên cắt tại `\n\n` → `.` → khoảng trắng |
| `ProjectReportService` | Rubric 100 điểm, 14 tiêu chí, MockData nếu chưa embed |
| `GeminiRetryHelper` | Backoff [10s, 30s, 65s] cho 429; throw lỗi thân thiện sau 3 lần |
| `EncryptionHelper` | AES encrypt/decrypt với user DEK + Master Key |


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

---

## Roles

| Role | Mô tả |
|------|-------|
| `Author` | Tài khoản mặc định khi đăng ký |
| `Staff` | Nhân viên, được tạo bởi Admin |
| `Admin` | Quản trị viên, toàn quyền |

---

## 🔐 Auth — `/api/auth`

### `POST /auth/register`
Đăng ký tài khoản mới (role mặc định: **Author**). Không cần token.

**Body**
```json
{
  "fullName": "Nguyễn Văn A",
  "email": "user@example.com",
  "password": "123456"
}
```

**Response `200`**
```json
{
  "userId": "guid",
  "fullName": "Nguyễn Văn A",
  "email": "user@example.com",
  "role": "Author",
  "accessToken": "jwt...",
  "refreshToken": "..."
}
```

| Code | Mô tả |
|------|-------|
| `400` | Email đã tồn tại / dữ liệu không hợp lệ |

---

### `POST /auth/login`
Đăng nhập, nhận JWT. Không cần token.

**Body**
```json
{ "email": "user@example.com", "password": "123456" }
```

**Response `200`** — giống Register.

| Code | Mô tả |
|------|-------|
| `401` | Email hoặc mật khẩu không chính xác |

---

### `PUT /auth/change-password` 🔒
Đổi mật khẩu hiện tại.

**Body**
```json
{ "oldPassword": "123456", "newPassword": "newpass123" }
```

**Response `200`**
```json
{ "message": "Đổi mật khẩu thành công." }
```

| Code | Mô tả |
|------|-------|
| `400` | Mật khẩu hiện tại không chính xác |
| `401` | Chưa đăng nhập |

---

## 👤 User — `/api/user`

> Tất cả endpoint đều yêu cầu 🔒 Bearer Token (mọi role).

### `GET /user/profile` 🔒
Lấy thông tin profile của người dùng đang đăng nhập.

**Response `200`**
```json
{
  "id": "guid",
  "fullName": "Nguyễn Văn A",
  "email": "user@example.com",
  "avatarURL": null,
  "role": "Author",
  "createdAt": "2026-02-25T08:00:00Z"
}
```

---

### `PUT /user/profile` 🔒
Cập nhật FullName và/hoặc AvatarURL.

**Body**
```json
{ "fullName": "Nguyễn Văn B", "avatarURL": "https://..." }
```

**Response `200`** — trả về profile đã cập nhật.

| Code | Mô tả |
|------|-------|
| `400` | Không tìm thấy user |
| `401` | Chưa đăng nhập |

---

## 🗂️ Project — `/api/project`

> Tất cả endpoint đều yêu cầu 🔒 Bearer Token và role **Author** ✍️.

### `GET /project` 🔒 ✍️
Lấy danh sách tất cả dự án của người dùng đang đăng nhập.

**Response `200`**
```json
[
  {
    "id": "guid",
    "title": "Tên truyện",
    "summary": "Tóm tắt...",
    "coverImageURL": null,
    "status": "Draft",
    "createdAt": "2026-02-25T08:00:00Z"
  }
]
```

---

### `GET /project/{id}` 🔒 ✍️
Lấy chi tiết một dự án theo ID (chỉ dự án của chính mình).

| Code | Mô tả |
|------|-------|
| `404` | Không tìm thấy dự án |

---

### `POST /project` 🔒 ✍️
Tạo dự án mới.

**Body**
```json
{
  "title": "Tên truyện",
  "summary": "Tóm tắt (tuỳ chọn)",
  "coverImageURL": "https://... (tuỳ chọn)"
}
```

**Response `201`** — trả về dự án vừa tạo.

---

### `PUT /project/{id}` 🔒 ✍️
Cập nhật thông tin dự án.

**Body** — giống POST (các field tuỳ chọn).

**Response `200`** — trả về dự án đã cập nhật.

---

### `DELETE /project/{id}` 🔒 ✍️
Xóa mềm dự án (`IsDeleted = true`).

**Response `200`**
```json
{ "message": "Dự án đã được xóa." }
```

---

## 💳 Subscription — `/api/subscription`

### Plans

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| `GET` | `/subscription/plans` | 🔒 Tất cả | Lấy tất cả plan đang active |
| `GET` | `/subscription/plans?includeInactive=true` | 🔒 👑 Admin | Lấy kể cả plan đã tắt |
| `GET` | `/subscription/plans/{id}` | 🔒 Tất cả | Chi tiết một plan |
| `POST` | `/subscription/plans` | 🔒 👑 Admin | Tạo plan mới |
| `PUT` | `/subscription/plans/{id}` | 🔒 👑 Admin | Cập nhật plan |
| `DELETE` | `/subscription/plans/{id}` | 🔒 👑 Admin | Deactivate plan |

**Response `GET /subscription/plans` (`200`)**
```json
[
  {
    "id": 1,
    "planName": "Free",
    "price": 0,
    "maxAnalysisCount": 3,
    "maxTokenLimit": 20000,
    "description": "Gói miễn phí – 3 lần phân tích bộ truyện và 20,000 token AI.",
    "isActive": true
  }
]
```

**Body `POST /subscription/plans`**
```json
{
  "planName": "Pro Plus",
  "price": 399000,
  "maxAnalysisCount": 200,
  "maxTokenLimit": 1000000,
  "description": "Mô tả plan...",
  "isActive": true
}
```

#### Dữ liệu plan mặc định (seed)

| ID | Tên | Giá/tháng | Phân tích | Token AI |
|----|-----|-----------|-----------|----------|
| 1 | Free | 0đ | 3 lần | 20,000 |
| 2 | Basic | 99,000đ | 20 lần | 150,000 |
| 3 | Pro | 249,000đ | 100 lần | 500,000 |
| 4 | Enterprise | 699,000đ | 9,999 lần | 2,000,000 |

> **MaxAnalysisCount** = số lần phân tích cả bộ truyện trong kỳ.
> **MaxTokenLimit** = số token AI có thể dùng khi đặt câu hỏi cho AI trong kỳ.

---

### My Subscription

### `GET /subscription/my` 🔒
Lấy subscription đang active của user hiện tại.

**Response `200` — có subscription**
```json
{
  "id": 5,
  "planId": 3,
  "planName": "Pro",
  "price": 249000,
  "maxAnalysisCount": 100,
  "maxTokenLimit": 500000,
  "startDate": "2026-02-01T00:00:00Z",
  "endDate": "2026-03-01T00:00:00Z",
  "status": "Active",
  "usedAnalysisCount": 12,
  "usedTokens": 45200
}
```

**Response `200` — chưa có subscription**
```json
{ "message": "Bạn chưa có gói đăng ký nào đang hoạt động.", "subscription": null }
```

---

## 👑 Admin — `/api/admin`

> Chỉ role **Admin** được truy cập. Role khác nhận `403 Forbidden`.

### `GET /admin/users/stats` 🔒 👑
Lấy thống kê và danh sách toàn bộ người dùng.

**Response `200`**
```json
{
  "totalUsers": 42,
  "activeUsers": 40,
  "inactiveUsers": 2,
  "totalAuthors": 35,
  "totalStaff": 5,
  "totalAdmins": 2,
  "users": [
    {
      "id": "guid",
      "fullName": "Nguyễn Văn A",
      "email": "user@example.com",
      "role": "Author",
      "isActive": true,
      "createdAt": "2026-02-25T08:00:00Z"
    }
  ]
}
```

| Code | Mô tả |
|------|-------|
| `401` | Chưa đăng nhập |
| `403` | Không có quyền Admin |

---

## 📊 Database Schema (tóm tắt)

```
Users          — uuid PK, Role ∈ {Admin, Author, Staff}
Projects       — uuid PK, FK→Users (AuthorId)
SubscriptionPlans   — int PK (seed: Free/Basic/Pro/Enterprise)
UserSubscriptions   — int PK, FK→Users, FK→SubscriptionPlans
```
