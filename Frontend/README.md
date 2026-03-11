# StoryRAG — Frontend

Giao diện React cho ứng dụng hỗ trợ viết truyện với AI. Thiết kế theo phong cách **Notion/Linear** — tối giản, tập trung vào nội dung.

---

## 🚀 Cài đặt & Chạy

```bash
npm install
npm run dev       # dev server tại http://localhost:5173
npm run build     # production build
npm run preview   # preview production build
```

---

## 🛠️ Công nghệ

| Package | Phiên bản | Vai trò |
|---------|-----------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Build tool + HMR |
| TailwindCSS | 3 | Utility-first styling |
| Axios | 1.x | HTTP client |
| React Router | 6 | Client-side routing |
| Lucide React | latest | Icons |

---

## 📁 Cấu trúc

```
Frontend/src/
├── pages/           — Các trang chính
├── components/      — Components dùng lại (Toast, RewritePanel, Sidebar...)
├── services/        — Axios API calls (projectService, aiService, chapterService...)
├── hooks/           — Custom React hooks (useEditorSettings)
├── layouts/         — Layout wrappers (MainLayout)
└── utils/           — Tiện ích (jwtHelper, formatters)
```

---

## 📄 Pages

| Page | Route | Mô tả |
|------|-------|-------|
| `LandingPage` | `/` | Trang giới thiệu sản phẩm |
| `LoginPage` | `/login` | Đăng nhập |
| `RegisterPage` | `/register` | Đăng ký tài khoản mới |
| `HomePage` | `/home` | Dashboard — stats thực tế, dự án gần đây |
| `ProjectsPage` | `/projects` | Danh sách + tạo/xóa dự án |
| `WorkspacePage` | `/workspace/:projectId` | Editor soạn thảo chính |
| `AnalysisPage` | `/analysis/:projectId` | Phân tích AI + báo cáo điểm |
| `SubscriptionPage` | `/subscription` | Subscription hiện tại |
| `PlansPage` | `/plans` | Xem và chọn gói đăng ký |
| `ProfilePage` | `/profile` | Thông tin cá nhân |
| `SettingsPage` | `/settings` | Cài đặt editor (font, size, theme) |
| `AdminDashboardPage` | `/admin` | Quản trị user (Admin only) |
| `AdminSubscriptionPage` | `/admin/subscription` | Quản trị gói đăng ký |

---

## ✍️ WorkspacePage — Editor chính

### Layout 3 panels

```
┌──────────┬───────────────────────────┬────────────────────┐
│  Sidebar │       Editor              │    Right Panel     │
│          │  (contentEditable)        │  AI Chat / History │
│ Chapters │  ← Ctrl+S: Save + Embed  │  / Chat cũ         │
└──────────┴───────────────────────────┴────────────────────┘
```

### Luồng Save

```
Ctrl+S hoặc nút "Lưu"
  ↓ Lưu nội dung ngay ("✅ Đã lưu")
  ↓ Ngầm: Chunk → Embed (nếu không đang embed)
  ↓ Navbar indicator: "⏳ Đồng bộ AI..." → "✨ AI sẵn sàng"
```

- **Spam Ctrl+S** khi đang embed → chỉ lưu, không khởi động embed thêm
- `savedState`: `idle | saving | saved | error`
- `aiSyncState`: `idle | syncing | ready | error`

### Tính năng AI Rewrite

1. Bôi đen đoạn văn (≥ 5 ký tự) trong editor
2. Floating toolbar xuất hiện → click "✨ Viết lại"
3. `RewritePanel` trượt vào từ phải → nhập hướng dẫn → AI viết lại
4. Click "Chấp nhận" → replace trực tiếp vào editor

---

## 🧩 Components quan trọng

### `Toast` — Hệ thống thông báo

```tsx
// App.tsx — wrap toàn bộ app
<ToastProvider>
  <App />
</ToastProvider>

// Trong bất kỳ component nào
import { useToast } from '../components/Toast';
const toast = useToast();

toast.success('Đã lưu thành công');
toast.error('Lỗi: không thể kết nối');
toast.info('✨ Đang chunk & embed...');
toast.warning('⚠️ AI đang quá tải');
```

### `RewritePanel`

```tsx
<RewritePanel
  projectId="guid"
  chapterId="guid"
  selectedText="Đoạn văn gốc được bôi đen"
  onAccept={(rewritten) => { /* replace vào editor */ }}
  onClose={() => setPanelOpen(false)}
/>
```

---

## 🎨 Design System

### Màu sắc (CSS Variables)

Định nghĩa trong `src/index.css`, switch tự động theo `[data-theme="dark"]`.

| Token | Light | Dark | Mô tả |
|-------|-------|------|-------|
| `--bg-app` | `#f8f8f8` | `#111111` | Nền chính |
| `--bg-surface` | `#ffffff` | `#1a1a1a` | Card, panel |
| `--bg-sidebar` | `#f3f3f3` | `#161616` | Sidebar |
| `--bg-topbar` | `#ffffff` | `#141414` | Thanh navbar |
| `--accent` | `#7c3aed` | `#8b5cf6` | Màu nhấn (purple) |
| `--accent-subtle` | `rgba(124,58,237,0.08)` | `rgba(139,92,246,0.12)` | Nền accent nhạt |
| `--accent-text` | `#7c3aed` | `#a78bfa` | Text accent |
| `--text-primary` | `#0f0f0f` | `#f5f5f5` | Văn bản chính |
| `--text-secondary` | `#6b7280` | `#a1a1aa` | Văn bản phụ |
| `--border-color` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Viền |
| `--success` | `#10b981` | `#34d399` | Toast success |
| `--error` | `#ef4444` | `#f87171` | Toast error |

### Sử dụng token trong TailwindCSS

```tsx
// Dùng CSS var inline
<div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>

// Dùng text color class  
<p className="text-[var(--text-primary)]">
<p className="text-[var(--text-secondary)]">

// Accent color
<button style={{ color: 'var(--accent)', background: 'var(--accent-subtle)' }}>
```

---

## 🔌 Services

| File | Mô tả |
|------|-------|
| `api.ts` | Axios instance với `baseURL`, JWT interceptor, 401 redirect |
| `projectService.ts` | CRUD dự án + `getStats()` |
| `chapterService.ts` | Chương, versions, chunk |
| `aiService.ts` | Embed, chat, chat history, rewrite, rewrite history |
| `worldbuildingService.ts` | CRUD worldbuilding entries |
| `characterService.ts` | CRUD character entries |
| `authService.ts` | Login, register, change password |
| `adminService.ts` | Admin endpoints |
| `subscriptionService.ts` | Plans, my subscription |

### Cấu hình API base URL

```ts
// src/services/api.ts
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5105/api';
```

Tạo `.env.local` để override:
```
VITE_API_URL=http://localhost:5105/api
```

---

## 🔐 Authentication

JWT được lưu trong `localStorage`. `jwtHelper.ts` cung cấp:

```ts
import { getUserInfo, getToken, removeToken } from '../utils/jwtHelper';

const user = getUserInfo(); // { userId, fullName, email, role }
const token = getToken();
removeToken(); // logout
```

`api.ts` tự động đính kèm token vào mọi request và redirect về `/login` khi nhận 401.

