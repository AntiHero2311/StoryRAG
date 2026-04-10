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
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 7 | Build tool + HMR |
| TailwindCSS | 4 | Utility-first styling |
| Axios | 1.x | HTTP client |
| React Router | 7 | Client-side routing |
| Lucide React | latest | Icons |
| diff | latest | So sánh phiên bản văn bản |

---

## 📁 Cấu trúc

```
Frontend/src/
├── pages/           — Các trang chính
├── components/      — Components dùng lại
│   └── workspace/   — ChatPanel, ChatHistoryPanel
├── services/        — Axios API calls
├── hooks/           — Custom React hooks
└── utils/           — Tiện ích (jwtHelper)
```

---

## 📄 Pages

| Page | Route | Mô tả |
|------|-------|-------|
| `LandingPage` | `/` | Trang giới thiệu sản phẩm |
| `AuthPage` | `/login` | Đăng nhập / Đăng ký (chung 1 page) |
| `ForgotPasswordPage` | `/forgot-password` | Quên mật khẩu |
| `ResetPasswordPage` | `/reset-password` | Đặt lại mật khẩu |
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
| `StaffDashboardPage` | `/staff` | Xử lý bug reports (Staff only) |
| `PrivacyPolicyPage` | `/privacy` | Chính sách bảo mật |

---

## ✍️ WorkspacePage — Editor chính

### Layout 3 panels

```
┌──────────┬───────────────────────────┬────────────────────┐
│  Sidebar │       Editor              │    Right Panel     │
│          │  (contentEditable)        │  AI Chat / History │
│ Chapters │  ← Ctrl+S: Save + Embed  │  / Story Bible     │
└──────────┴───────────────────────────┴────────────────────┘
```

### Story Bible (Right Panel)

| Tab | Component | Mục đích |
|-----|-----------|----------|
| Thế giới | `WorldbuildingPanel` | Bối cảnh, địa điểm, ma thuật... |
| Nhân vật | `CharactersPanel` | CRUD nhân vật + embed |
| Phong cách | `StyleGuidePanel` | POV, giọng văn, từ vựng |
| Chủ đề | `ThemePanel` | Chủ đề trọng tâm tác phẩm |
| Cốt truyện | `PlotNotePanel` | Arc, conflict, foreshadowing |
| Thể loại | `GenrePanel` | Gán thể loại cho dự án |
| Tóm tắt | `SynopsisPanel` | Tóm tắt nội dung |
| Ghi chú AI | `AiInstructionsPanel` | Hướng dẫn riêng cho AI |

### Luồng Save

```
Ctrl+S hoặc nút "Lưu"
  ↓ Lưu nội dung ngay ("✅ Đã lưu")
  ↓ Ngầm: Chunk → Embed
  ↓ Navbar indicator: "⏳ Đồng bộ AI..." → "✨ AI sẵn sàng"
```

### AI Rewrite

1. Bôi đen đoạn văn (≥ 5 ký tự) trong editor
2. Floating toolbar xuất hiện → click "✨ Viết lại"
3. `RewritePanel` trượt vào từ phải → nhập hướng dẫn
4. Click "Chấp nhận" → replace trực tiếp vào editor

---

## 🔌 Services

| File | Mô tả |
|------|-------|
| `api.ts` | Axios instance, JWT interceptor, 401 redirect |
| `projectService.ts` | CRUD dự án, stats, genres |
| `chapterService.ts` | Chương, versions, chunk |
| `aiService.ts` | Embed, chat, rewrite, analyze |
| `worldbuildingService.ts` | CRUD + embed worldbuilding |
| `characterService.ts` | CRUD + embed nhân vật |
| `styleGuideService.ts` | CRUD + embed style guide |
| `themeService.ts` | CRUD + embed chủ đề |
| `plotNoteService.ts` | CRUD + embed ghi chú cốt truyện |
| `authService.ts` | Login, register, forgot/reset password |
| `adminService.ts` | Admin endpoints |
| `subscriptionService.ts` | Plans, my subscription |
| `genreService.ts` | Danh sách thể loại |

### Cấu hình API base URL

```ts
// src/services/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5105/api';
```

Tạo `.env.local` để override:
```
VITE_API_BASE_URL=http://localhost:5105/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
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
| `--accent` | `#7c3aed` | `#8b5cf6` | Màu nhấn (purple) |
| `--text-primary` | `#0f0f0f` | `#f5f5f5` | Văn bản chính |
| `--text-secondary` | `#6b7280` | `#a1a1aa` | Văn bản phụ |
| `--border-color` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Viền |
| `--hover-bg` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.04)` | Nền hover |

---

## 🧩 Components quan trọng

### `Toast` — Thông báo toàn app

```tsx
import { useToast } from '../components/Toast';
const toast = useToast();

toast.success('Đã lưu thành công');
toast.error('Lỗi kết nối');
toast.info('✨ Đang embed...');
```

### `ChatPanel` — AI Chat trong Workspace

```tsx
<ChatPanel
  projectId="guid"
  chapterId="guid"
  currentContent="nội dung chương hiện tại"
/>
```

### `RewritePanel` — Viết lại đoạn văn

```tsx
<RewritePanel
  projectId="guid"
  chapterId="guid"
  selectedText="Đoạn văn gốc"
  onAccept={(rewritten) => { /* replace vào editor */ }}
  onClose={() => setPanelOpen(false)}
/>
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
