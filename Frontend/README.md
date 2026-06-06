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
| `api.ts` | Axios instance chung, đính kèm JWT Access Token tự động và xử lý refresh token/hết hạn phiên (401 redirect). |
| `authService.ts` | Đăng ký, đăng nhập (email & Google), refresh token, quên và đặt lại mật khẩu. |
| `userService.ts` | Quản lý thông tin tài khoản người dùng, thay đổi profile cá nhân. |
| `editorSettingsService.ts` | Lưu trữ cài đặt font chữ và kích thước chữ cho editor soạn thảo. |
| `projectService.ts` | CRUD dự án truyện, xem thống kê dashboard của tác giả. |
| `chapterService.ts` | CRUD chương truyện, quản lý các phiên bản chương (so sánh diff, ghim/xóa/chuyển đổi), chunking chương truyện và upload/import manuscript. |
| `exportService.ts` | Xuất bản thảo dự án/chương truyện ra các định dạng file Docx, Txt. |
| `paymentService.ts` | Tích hợp thanh toán VNPay (tạo link thanh toán, xem lịch sử giao dịch). |
| `genreService.ts` | Lấy danh sách thể loại truyện khả dụng trong hệ thống. |
| `subscriptionService.ts` | Xem thông tin gói đăng ký hiện tại, thông tin giới hạn gói và chuyển đổi gói dịch vụ. |
| `aiService.ts` | Quản lý tính năng AI RAG (chat với AI, viết lại đoạn văn). |
| `aiAnalysisService.ts` | Thực hiện các phân tích chuyên sâu (phân rã cảnh/trích quote, phân tích cliffhanger/ba hồi, lịch sử phân tích). |
| `analysisJobService.ts` | Quản lý tiến trình job phân tích bất đồng bộ (tạo job, xem trạng thái/tiến độ, hủy/chạy lại job). |
| `reportService.ts` | Lấy lịch sử báo cáo phân tích truyện (reports), xem chi tiết (rubric, warnings), và xuất PDF báo cáo. |
| `faqService.ts` | Truy xuất danh sách câu hỏi thường gặp (FAQs) cho trang trợ giúp công khai. |
| `writingTipService.ts` | Lấy các mẹo viết truyện hữu ích từ hệ thống. |
| `feedbackService.ts` | Quản lý phản hồi chuyên môn giữa Staff và tác giả (thêm phản hồi, like/dislike, reply). |
| `notificationService.ts` | Quản lý danh sách thông báo và đánh dấu đã đọc của user. |
| `appNotificationService.ts` | Gửi nhận thông báo nội bộ trong ứng dụng (in-app notifications). |
| `browserNotificationService.ts` | Gửi thông báo đẩy của trình duyệt (Browser Push Notification) khi job hoàn tất. |
| `bugReportService.ts` | Gửi và quản lý báo cáo lỗi từ người dùng (CRUD bug reports). |
| `staffService.ts` | Các chức năng nghiệp vụ của Staff/Admin (kiểm duyệt, duyệt báo cáo, quản lý FAQ & writing tips). |
| `adminService.ts` | Quản lý các tính năng dành cho Admin (dashboard stats, quản lý user, cấu hình hệ thống RAG). |

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
