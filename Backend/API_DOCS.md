# StoryRAG — API Documentation

Base URL: `http://localhost:<port>/api`

> **Auth:** Hầu hết endpoint yêu cầu JWT Bearer Token trong header `Authorization: Bearer <token>`.
> Role: `Author` (user thường), `Admin`.

---

## 1. Auth — `/api/auth`

### POST `/api/auth/register`
Đăng ký tài khoản mới.

**Auth:** Không cần.

**Request Body:**
```json
{
  "fullName": "string (required, max 100)",
  "email": "string (required, email format, max 255)",
  "password": "string (required, min 6 ký tự)"
}
```

**Response `200`:**
```json
{
  "userId": "guid",
  "fullName": "string",
  "email": "string",
  "role": "string",
  "accessToken": "string",
  "refreshToken": "string | null"
}
```

---

### POST `/api/auth/login`
Đăng nhập.

**Auth:** Không cần.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response `200`:** `AuthResponse` (xem trên).

**Response `401`:** `{ "message": "..." }`

---

### POST `/api/auth/google-login`
Đăng nhập bằng Google.

**Auth:** Không cần.

> Yêu cầu backend đã cấu hình `GoogleAuth:ClientId` (hoặc env `GoogleAuth__ClientId`).

**Request Body:**
```json
{
  "idToken": "string (required)"
}
```

**Response `200`:** `AuthResponse` (xem trên).

**Response `401`:** `{ "message": "..." }`

---

### PUT `/api/auth/change-password`
Đổi mật khẩu.

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "oldPassword": "string (required)",
  "newPassword": "string (required, min 6 ký tự)"
}
```

**Response `200`:** `{ "message": "Đổi mật khẩu thành công." }`

---

## 2. User — `/api/user`

### GET `/api/user/profile`
Lấy thông tin profile của user đang đăng nhập.

**Auth:** Bắt buộc.

**Response `200`:**
```json
{
  "id": "guid",
  "fullName": "string",
  "email": "string",
  "avatarURL": "string | null",
  "role": "string",
  "createdAt": "datetime"
}
```

---

### PUT `/api/user/profile`
Cập nhật profile (tên, avatar).

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "fullName": "string",
  "avatarURL": "string | null"
}
```

**Response `200`:** `UserProfileResponse` (xem trên).

---

## 3. Project — `/api/project`

> Role yêu cầu: `Author`

### GET `/api/project`
Lấy danh sách tất cả dự án của user.

**Auth:** Bắt buộc (Author).

**Response `200`:** `ProjectResponse[]`
```json
[
  {
    "id": "guid",
    "title": "string",
    "summary": "string | null",
    "coverImageURL": "string | null",
    "status": "Draft | Published | ...",
    "createdAt": "datetime",
    "updatedAt": "datetime | null"
  }
]
```

---

### GET `/api/project/{id}`
Lấy chi tiết một dự án.

**Auth:** Bắt buộc (Author).

**Response `200`:** `ProjectResponse`.

**Response `404`:** `{ "message": "..." }`

---

### POST `/api/project`
Tạo dự án mới.

**Auth:** Bắt buộc (Author).

**Request Body:**
```json
{
  "title": "string (required, min 1)",
  "summary": "string | null",
  "status": "Draft"
}
```

**Response `201`:** `ProjectResponse`.

---

### PUT `/api/project/{id}`
Cập nhật dự án.

**Auth:** Bắt buộc (Author).

**Request Body:**
```json
{
  "title": "string (required, min 1)",
  "summary": "string | null",
  "coverImageURL": "string | null",
  "status": "string"
}
```

**Response `200`:** `ProjectResponse`.

---

### DELETE `/api/project/{id}`
Xóa mềm dự án (`IsDeleted = true`).

**Auth:** Bắt buộc (Author).

**Response `200`:** `{ "message": "Dự án đã được xóa." }`

---

## 4. Chapter — `/api/project/{projectId}/chapters`

### GET `/api/project/{projectId}/chapters`
Lấy danh sách chương của dự án.

**Auth:** Bắt buộc.

**Response `200`:** `ChapterResponse[]`
```json
[
  {
    "id": "guid",
    "projectId": "guid",
    "chapterNumber": 1,
    "title": "string | null",
    "wordCount": 0,
    "status": "Draft | Final | Archived",
    "currentVersionNum": 1,
    "currentVersionId": "guid | null",
    "createdAt": "datetime",
    "updatedAt": "datetime | null"
  }
]
```

---

### GET `/api/project/{projectId}/chapters/{chapterId}`
Lấy chi tiết chương (kèm nội dung đã decrypt và danh sách versions).

**Auth:** Bắt buộc.

**Response `200`:** `ChapterDetailResponse`
```json
{
  "id": "guid",
  "projectId": "guid",
  "chapterNumber": 1,
  "title": "string | null",
  "wordCount": 0,
  "status": "string",
  "currentVersionNum": 1,
  "currentVersionId": "guid | null",
  "createdAt": "datetime",
  "updatedAt": "datetime | null",
  "content": "string | null",
  "versions": [ /* ChapterVersionSummary[] */ ]
}
```

---

### POST `/api/project/{projectId}/chapters`
Tạo chương mới (tự động tạo Version 1).

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "chapterNumber": 1,
  "title": "string | null",
  "content": "string (bắt buộc, có thể rỗng)",
  "changeNote": "string | null"
}
```

**Response `201`:** `ChapterDetailResponse`.

**Response `400`:** Nếu số chương đã tồn tại.

---

### PUT `/api/project/{projectId}/chapters/{chapterId}`
Cập nhật chương (tự động tạo version mới).

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "title": "string | null",
  "content": "string (required)",
  "changeNote": "string | null"
}
```

**Response `200`:** `ChapterDetailResponse`.

---

### DELETE `/api/project/{projectId}/chapters/{chapterId}`
Xóa mềm chương.

**Auth:** Bắt buộc.

**Response `200`:** `{ "message": "Chương đã được xóa." }`

---

## 5. Chapter Versions — `/api/project/{projectId}/chapters/{chapterId}/versions`

### GET `/api/project/{projectId}/chapters/{chapterId}/versions`
Lấy tất cả versions của chương.

**Auth:** Bắt buộc.

**Response `200`:** `ChapterVersionSummary[]`
```json
[
  {
    "id": "guid",
    "versionNumber": 1,
    "changeNote": "string | null",
    "wordCount": 0,
    "tokenCount": 0,
    "isChunked": false,
    "isEmbedded": false,
    "createdAt": "datetime",
    "createdByName": "string"
  }
]
```

---

### GET `/api/project/{projectId}/chapters/{chapterId}/versions/{versionNumber}`
Xem nội dung một version cụ thể (kèm danh sách chunks nếu có).

**Auth:** Bắt buộc.

**Response `200`:** `ChapterVersionDetailResponse`
```json
{
  "id": "guid",
  "versionNumber": 1,
  "changeNote": "string | null",
  "wordCount": 0,
  "tokenCount": 0,
  "isChunked": false,
  "isEmbedded": false,
  "createdAt": "datetime",
  "createdByName": "string",
  "content": "string",
  "chunks": [
    {
      "id": "guid",
      "chunkIndex": 0,
      "content": "string",
      "tokenCount": 0,
      "hasEmbedding": false
    }
  ]
}
```

---

### POST `/api/project/{projectId}/chapters/{chapterId}/versions`
Lưu version mới thủ công (snapshot).

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "content": "string (required)",
  "changeNote": "string | null"
}
```

**Response `200`:** `ChapterDetailResponse`.

---

### POST `/api/project/{projectId}/chapters/{chapterId}/versions/{versionNumber}/restore`
Phục hồi về version cũ (tạo version mới với nội dung cũ).

**Auth:** Bắt buộc.

**Response `200`:** `ChapterDetailResponse`.

---

## 6. Chapter Chunking — `/api/project/{projectId}/chapters/{chapterId}/chunk`

### POST `/api/project/{projectId}/chapters/{chapterId}/chunk`
Chunk version hiện tại của chương (chuẩn bị cho AI embedding).

**Auth:** Bắt buộc.

**Response `200`:** `ChapterVersionDetailResponse` (với danh sách chunks mới).

---

## 7. AI — `/api/ai`

### POST `/api/ai/chapters/{chapterId}/embed`
Embed tất cả chunks của current version của chương vào vector DB.

**Auth:** Bắt buộc.

**Response `200`:** `{ "message": "Embedding hoàn tất." }`

**Response `400`:** Nếu chương chưa được chunk.

**Response `404`:** Nếu không tìm thấy chương.

---

### POST `/api/ai/{projectId}/chat`
AI Chat — hỏi đáp về nội dung dự án truyện (RAG).

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "question": "string (required, min 1 ký tự)"
}
```

**Response `200`:**
```json
{
  "answer": "string",
  "sources": [ /* ... */ ]
}
```

**Response `400`:** Nếu chưa có dữ liệu embedding.

---

## 8. Subscription — `/api/subscription`

### GET `/api/subscription/plans`
Lấy tất cả plan đang active. Admin có thể xem cả inactive qua query param.

**Auth:** Bắt buộc.

**Query Params:** `?includeInactive=true` (chỉ Admin)

**Response `200`:** `SubscriptionPlanResponse[]`
```json
[
  {
    "id": 1,
    "planName": "string",
    "price": 0.0,
    "maxAnalysisCount": 10,
    "maxTokenLimit": 50000,
    "description": "string | null",
    "isActive": true
  }
]
```

---

### GET `/api/subscription/plans/{id}`
Chi tiết một plan.

**Auth:** Bắt buộc.

**Response `200`:** `SubscriptionPlanResponse`.

**Response `404`:** `{ "message": "..." }`

---

### POST `/api/subscription/plans`
Tạo plan mới — **chỉ Admin**.

**Auth:** Bắt buộc (Admin).

**Request Body:**
```json
{
  "planName": "string",
  "price": 0.0,
  "maxAnalysisCount": 10,
  "maxTokenLimit": 50000,
  "description": "string | null",
  "isActive": true
}
```

**Response `201`:** `SubscriptionPlanResponse`.

---

### PUT `/api/subscription/plans/{id}`
Cập nhật plan — **chỉ Admin**.

**Auth:** Bắt buộc (Admin).

**Request Body:** (tất cả optional)
```json
{
  "planName": "string | null",
  "price": 0.0,
  "maxAnalysisCount": 10,
  "maxTokenLimit": 50000,
  "description": "string | null",
  "isActive": true
}
```

**Response `200`:** `SubscriptionPlanResponse`.

---

### DELETE `/api/subscription/plans/{id}`
Deactivate plan — **chỉ Admin**.

**Auth:** Bắt buộc (Admin).

**Response `200`:** `{ "message": "Plan đã được deactivate." }`

---

### POST `/api/subscription/subscribe`
Đăng ký một plan. Free plan (price=0) sẽ tự động Active.

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "planId": 1
}
```

**Response `200`:** `UserSubscriptionResponse`
```json
{
  "id": 1,
  "planId": 1,
  "planName": "string",
  "price": 0.0,
  "maxAnalysisCount": 10,
  "maxTokenLimit": 50000,
  "startDate": "datetime",
  "endDate": "datetime",
  "status": "string",
  "usedAnalysisCount": 0,
  "usedTokens": 0
}
```

---

### GET `/api/subscription/my`
Xem subscription hiện tại của user.

**Auth:** Bắt buộc.

**Response `200`:** `UserSubscriptionResponse` hoặc `{ "message": "...", "subscription": null }`.

---

## 9. Admin — `/api/admin`

> Tất cả endpoint yêu cầu role **Admin**.

### GET `/api/admin/users/stats`
Lấy thống kê người dùng: tổng số, theo role, danh sách chi tiết.

**Auth:** Bắt buộc (Admin).

**Response `200`:** `UserStatsResponse` (thống kê users).

---

## 10. Timeline — `/api/projects/{projectId}/timeline`

> Quản lý dòng thời gian sự kiện của bộ truyện.

### GET `/api/projects/{projectId}/timeline`
Lấy toàn bộ mốc sự kiện của dự án, sắp xếp theo `sortOrder`.

**Auth:** Bắt buộc.

**Response `200`:** `TimelineEventDto[]`
```json
[
  {
    "id": "guid",
    "projectId": "guid",
    "category": "Story | Historical | Character | World | Political | Other",
    "title": "string",
    "description": "string",
    "timeLabel": "string | null",
    "sortOrder": 0,
    "importance": "Critical | Major | Normal | Minor",
    "createdAt": "datetime",
    "updatedAt": "datetime | null"
  }
]
```

---

### POST `/api/projects/{projectId}/timeline`
Thêm mốc sự kiện mới. Nếu `sortOrder = 0`, hệ thống tự tính (max + 10).

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "category": "Story",
  "title": "string (required)",
  "description": "string | null",
  "timeLabel": "string | null",
  "sortOrder": 0,
  "importance": "Normal"
}
```

**Response `201`:** `TimelineEventDto`.

---

### PUT `/api/projects/{projectId}/timeline/{id}`
Cập nhật mốc sự kiện. Tất cả field đều optional.

**Auth:** Bắt buộc.

**Request Body:**
```json
{
  "category": "string | null",
  "title": "string | null",
  "description": "string | null",
  "timeLabel": "string | null",
  "sortOrder": 0,
  "importance": "string | null"
}
```

**Response `200`:** `TimelineEventDto`.

**Response `404`:** Nếu không tìm thấy.

---

### DELETE `/api/projects/{projectId}/timeline/{id}`
Xóa mốc sự kiện.

**Auth:** Bắt buộc.

**Response `204`:** No Content.

**Response `404`:** Nếu không tìm thấy.

---

### PATCH `/api/projects/{projectId}/timeline/{id}/reorder`
Cập nhật `sortOrder` của một mốc sự kiện.

**Auth:** Bắt buộc.

**Request Body:** `integer` (sortOrder mới)

**Response `204`:** No Content.

---

## 11. Manuscript Import, Version Compare, Narrative Charts, Report PDF

### POST `/api/project/{projectId}/chapters/import`
Import manuscript file và tự động tạo chapter mới.

**Auth:** Bắt buộc.

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file`: `.txt | .docx | .pdf` (required)
- `splitByHeadings`: `true | false` (optional, default `true`)

**Response `200`:**
```json
{
  "sourceFileName": "story.docx",
  "detectedFormat": "docx",
  "startingChapterNumber": 5,
  "importedChapterCount": 3,
  "importedChapters": [
    {
      "chapterId": "guid",
      "chapterNumber": 5,
      "title": "Chapter 1",
      "wordCount": 1200
    }
  ]
}
```

---

### GET `/api/project/{projectId}/chapters/{chapterId}/versions/compare?fromVersion={a}&toVersion={b}`
So sánh 2 version và trả về unified diff + thống kê thay đổi.

**Auth:** Bắt buộc.

**Response `200`:**
```json
{
  "fromVersionNumber": 2,
  "toVersionNumber": 5,
  "addedLines": 14,
  "removedLines": 9,
  "unchangedLines": 201,
  "hasChanges": true,
  "unifiedDiff": "--- version 2\n+++ version 5\n@@ -1,210 +1,215 @@\n ..."
}
```

---

### GET `/api/ai/{projectId}/narrative/charts`
Lấy dữ liệu chuyên biệt cho chart narrative analysis.

**Auth:** Bắt buộc.

**Query params (optional):**
- `chapterId=guid` (lọc theo chapter)

**Response `200`:**
```json
{
  "pacing": [
    { "segmentIndex": 0, "chapterNumber": 1, "score": 62.4 }
  ],
  "emotions": [
    { "segmentIndex": 0, "chapterNumber": 1, "valence": 0.24, "intensity": 38.0, "dominantEmotion": "Joy" }
  ],
  "characterFrequencies": [
    { "characterName": "A", "totalMentions": 35 }
  ],
  "characterPresence": [
    {
      "characterName": "A",
      "points": [{ "segmentIndex": 0, "chapterNumber": 1, "mentions": 2 }]
    }
  ],
  "characterRelationships": [
    { "sourceCharacter": "A", "targetCharacter": "B", "weight": 8 }
  ]
}
```

---

### GET `/api/ai/{projectId}/reports/{reportId}/export/pdf`
Export một report phân tích ra PDF.

**Auth:** Bắt buộc.

**Response `200`:**
- `Content-Type: application/pdf`
- Attachment filename: `AnalysisReport_{reportId}.pdf`

## Error Response Format

Tất cả lỗi trả về dạng:
```json
{ "message": "Mô tả lỗi" }
```

## HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| 200  | Thành công |
| 201  | Tạo mới thành công |
| 400  | Bad Request / Validation error |
| 401  | Chưa xác thực |
| 403  | Không có quyền |
| 404  | Không tìm thấy |
| 500  | Server error |
