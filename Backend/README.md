# StoryRAG — API Reference

Base URL: `https://localhost:7259/api`

---

## 🔐 Authentication

> Các endpoint cần xác thực phải gửi kèm header:
> `Authorization: Bearer <access_token>`

---

## Auth — `/api/auth`

### POST `/auth/register`
Đăng ký tài khoản mới (role mặc định: **Author**). Không cần token.

**Request Body**
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

| Lỗi | Mô tả |
|-----|-------|
| `400` | Email đã tồn tại / dữ liệu không hợp lệ |

---

### POST `/auth/login`
Đăng nhập, nhận JWT Token. Không cần token.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

**Response `200`** — giống Register.

| Lỗi | Mô tả |
|-----|-------|
| `401` | Email hoặc mật khẩu không chính xác |

---

### PUT `/auth/change-password` 🔒
Đổi mật khẩu. Yêu cầu **Bearer token**.

**Request Body**
```json
{
  "oldPassword": "123456",
  "newPassword": "newpass123"
}
```

**Response `200`**
```json
{ "message": "Đổi mật khẩu thành công." }
```

| Lỗi | Mô tả |
|-----|-------|
| `400` | Mật khẩu hiện tại không chính xác |
| `401` | Chưa đăng nhập |

---

## User — `/api/user`

> Tất cả endpoint đều yêu cầu **Bearer token** (mọi role).

### GET `/user/profile` 🔒
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

### PUT `/user/profile` 🔒
Cập nhật thông tin cá nhân (FullName, AvatarURL).

**Request Body**
```json
{
  "fullName": "Nguyễn Văn B",
  "avatarURL": "https://..."
}
```

**Response `200`** — trả về profile đã cập nhật (giống GET).

| Lỗi | Mô tả |
|-----|-------|
| `400` | Không tìm thấy user |
| `401` | Chưa đăng nhập |

---

## Admin — `/api/admin`

> Chỉ token có role **Admin** được phép truy cập. Role khác nhận `403 Forbidden`.

### GET `/admin/users/stats` 🔒 👑
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

| Lỗi | Mô tả |
|-----|-------|
| `401` | Chưa đăng nhập |
| `403` | Không có quyền Admin |

---

## Roles

| Role | Mô tả |
|------|-------|
| `Author` | Tài khoản mặc định khi đăng ký |
| `Staff` | Nhân viên, được tạo bởi Admin |
| `Admin` | Quản trị viên, toàn quyền |

---

## Icon legend
- 🔒 Yêu cầu Bearer Token
- 👑 Chỉ Admin
