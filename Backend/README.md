# StoryRAG — API Reference

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
