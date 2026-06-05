# StoryNest UI Design Guide

> **Mục đích**: File này là tài liệu tham chiếu dành cho AI (và developer) khi thực hiện bất kỳ thay đổi giao diện nào trong dự án StoryNest. Đọc file này **trước khi** viết bất kỳ dòng TSX/CSS nào.

---

## 1. Tổng Quan Kiến Trúc Giao Diện

### Stack Kỹ Thuật
- **Framework**: React 18 + TypeScript + Vite
- **CSS**: TailwindCSS v4 + CSS Custom Properties (Design Tokens)
- **Font**: `Be Vietnam Pro` (Google Fonts, Vietnamese subset)
- **Icons**: `lucide-react`
- **Router**: `react-router-dom` v6

### Cấu Trúc File CSS
```
src/
├── index.css          ← Entry point: imports TW + fonts + design-tokens, defines utility classes & animations
├── design-tokens.css  ← Tất cả CSS Custom Properties (--bg-*, --text-*, --accent, v.v.)
└── App.css            ← Minimal reset
```

---

## 2. Design Tokens — Quy Tắc Sử Dụng

> **CRITICAL**: Luôn dùng CSS Variables thay vì hardcode màu. Không được dùng trực tiếp `#f5a623`, `#111111`, `text-zinc-400` v.v. khi đã có token tương ứng.

### Background Colors
| Token | Hex (Dark) | Dùng khi nào |
|-------|------------|--------------|
| `--bg-root` | `#050510` | Landing page, Auth page (trang công khai) |
| `--bg-app` | `#0d0d1a` | App shell, MainLayout wrapper |
| `--bg-sidebar` | `#09091a` | Sidebar background |
| `--bg-surface` | `#131325` | Cards, panels, list items |
| `--bg-elevated` | `#1a1a2e` | Dropdowns, tooltips, floating elements |
| `--bg-topbar` | `rgba(13,13,26,0.85)` | Topbar (glassmorphism, dùng với backdrop-filter) |
| `--bg-editor` | `#0a0a16` | Writing editor area |
| `--bg-panel` | `#0f0f22` | Right panel trong workspace |
| `--bg-hover` | `rgba(99,102,241,0.06)` | Hover state của buttons/items |
| `--bg-active` | `rgba(99,102,241,0.14)` | Active/selected state |
| `--bg-modal` | `#131325` | Modal/dialog backgrounds |

### Text Colors
| Token | Dùng khi nào |
|-------|--------------|
| `--text-bright` | Headings, page titles, tên riêng, số liệu quan trọng |
| `--text-primary` | Body text, labels, nội dung chính |
| `--text-secondary` | Meta text, timestamps, secondary labels |
| `--text-tertiary` | Placeholders, very dim text |
| `--text-muted` | Giữa primary và secondary |
| `--text-on-accent` | Text trên nền accent/gradient |
| `--accent-text` | Links màu indigo, badge labels có màu brand |

### Brand / Accent Colors
| Token | Giá trị | Dùng khi nào |
|-------|---------|--------------|
| `--accent` | `#6366f1` | Border focus, badges, highlights |
| `--accent-mid` | `#7c3aed` | Gradient midpoint |
| `--accent-end` | `#a855f7` | Gradient endpoint |
| `--accent-text` | `#a5b4fc` | Readable accent text trên dark bg |
| `--accent-subtle` | `rgba(99,102,241,0.12)` | Subtle bg tints |
| `--gradient-brand` | `linear-gradient(135deg, #4f46e5, #7c3aed, #a855f7)` | Buttons chính, avatars, logo |

### Border Colors
| Token | Dùng khi nào |
|-------|--------------|
| `--border-color` | Default borders (7% white opacity) |
| `--border-strong` | Emphasized borders (12% white opacity) |
| `--border-subtle` | Very light dividers (4% white opacity) |
| `--border-focus` | Input focus ring |
| `--border-accent` | Highlighted cards, active borders |

---

## 3. Màu Sắc Không Được Dùng (Deprecated)

❌ **KHÔNG dùng** các màu sau — đây là remnants từ design cũ:
- `#f5a623` — amber cũ (đã thay bằng violet brand)
- `text-amber-400` trong context navigation active
- `bg-amber-500/10` trong context hover
- `#111111`, `#0f0f0f` — đã thay bằng `--bg-app`, `--bg-sidebar`
- `bg-[var(--bg-surface)]` khi đã có class `.surface` hoặc `.glass-card`

---

## 4. Gradient Patterns

### Brand Gradient (Chính)
```css
background: var(--gradient-brand);
/* = linear-gradient(135deg, #4f46e5, #7c3aed, #a855f7) */
```
**Dùng cho**: Avatar, logo badge, CTA buttons primary, active indicators.

### Glassmorphism Panel
```tsx
// Sử dụng class utility
<div className="glass-panel">...</div>

// Hoặc inline style
style={{
  background: 'rgba(13, 13, 26, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.07)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
}}
```

### Surface Cards
```tsx
// Dùng cho: cards, list items, panels
style={{
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
}}
```

### Elevated (Dropdowns, Modals)
```tsx
style={{
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-xl)',
  backdropFilter: 'blur(16px)',
}}
```

---

## 5. Component Patterns

### ── Buttons ──

**Primary Button** (CTA chính):
```tsx
<button
  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110"
  style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-accent)' }}
>
  Tên button
</button>
```

**Ghost Button** (phụ):
```tsx
<button
  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
  style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
>
  Tên button
</button>
```

**Icon Button** (toolbar, header):
```tsx
<button
  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150"
  style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
>
  <Icon className="w-4 h-4" />
</button>
```

**Danger Button**:
```tsx
<button
  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
  style={{ color: 'var(--error)' }}
  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
>
  Xóa
</button>
```

### ── Cards ──

**Stat Card**:
```tsx
<div
  className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
  onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}40`; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
>
  {/* content */}
</div>
```

**Feature Card** (landing, info):
```tsx
<div
  className="rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1"
  style={{
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(12px)',
  }}
>
  {/* content */}
</div>
```

### ── Inputs ──

**Standard Input**:
```tsx
<input
  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all duration-150"
  style={{
    background: 'var(--input-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
  }}
  onFocus={e => {
    e.currentTarget.style.borderColor = 'var(--border-focus)';
    e.currentTarget.style.background = 'var(--input-bg-focus)';
  }}
  onBlur={e => {
    e.currentTarget.style.borderColor = 'var(--border-color)';
    e.currentTarget.style.background = 'var(--input-bg)';
  }}
/>
```

### ── Modals ──

**Standard Modal Backdrop**:
```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center p-4"
  style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
  onClick={e => { if (e.target === e.currentTarget) onClose(); }}
>
  <div
    className="w-full max-w-md animate-scale-in"
    style={{
      background: 'var(--bg-modal)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-3xl)',
      boxShadow: 'var(--shadow-2xl)',
    }}
  >
    {/* content */}
  </div>
</div>
```

### ── Badges / Pills ──

**Role Badge**:
```tsx
// Admin
<span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-500/15 text-rose-300 border border-rose-500/25">
  Admin
</span>

// Staff
<span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25">
  Staff
</span>

// Author (mặc định)
<span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
  Author
</span>
```

---

## 6. Layout Patterns

### MainLayout (Authenticated Pages)
```
┌─────────────────────────────────────────┐
│  Sidebar (220px / 60px collapsed)       │
│  ┌─────────────────────────────────────┐│
│  │ Logo / Brand (topbar-height)        ││
│  │─────────────────────────────────────││
│  │ Nav items (flex-1)                  ││
│  │─────────────────────────────────────││
│  │ Help card (bottom)                  ││
│  └─────────────────────────────────────┘│
│                                         │
│  Main content (flex-1)                  │
│  ┌─────────────────────────────────────┐│
│  │ Topbar (64px, glassmorphism)        ││
│  │─────────────────────────────────────││
│  │ Page content (overflow-y-auto)      ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Quy tắc MainLayout**:
- `--topbar-height: 64px` — không thay đổi
- `--sidebar-width: 220px` / `--sidebar-width-collapsed: 60px`
- Page content wrapper: `p-6 max-w-7xl mx-auto`
- Không thêm `pt-` vào `<main>` trong MainLayout (đã được xử lý)

### WorkspacePage Layout (Đặc biệt)
WorkspacePage dùng layout riêng, không qua MainLayout:
```
┌─────────────────────────────────────────────────────────────┐
│ Chapter Sidebar  │ Editor Area          │ Right Panels       │
│ (collapsible)    │ (flex-1)             │ (collapsible)      │
│                  │ ┌──── Toolbar ──────┐│ ┌─── Tab Bar ────┐ │
│ - Chapter list   │ │ Format, Save, AI  ││ │ chat/history.. │ │
│ - Version list   │ └───────────────────┘│ └────────────────┘ │
│                  │ ┌──── Editor ───────┐│ ┌─── Panel ──────┐ │
│                  │ │ contenteditable   ││ │ ChatPanel etc. │ │
│                  │ └───────────────────┘│ └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Animation Reference

### Utility Classes (từ index.css)
| Class | Effect | Duration |
|-------|--------|----------|
| `animate-fade-in` | Fade from 0→1 opacity | 500ms |
| `animate-slide-up` | Slide up + fade in | 500ms |
| `animate-slide-in-right` | Slide from right + fade | 300ms |
| `animate-scale-in` | Scale 0.92→1 + fade | 200ms |
| `animate-fade-in-up` | Translate Y + fade | 700ms |
| `animate-pulse-slow` | Gentle pulse scale | 6s loop |
| `animate-float` | Float up/down | 3s loop |
| `animate-shimmer` | Loading shimmer | 1.8s loop |
| `animate-gradient` | Gradient shift | 6s loop |
| `animate-glitch` | Glitch text effect | 3s loop |
| `animate-twinkle` | Star twinkle | `--duration` var |
| `animate-orb-float` | Background orb movement | `--duration` var |
| `animate-toast-in` | Toast enter | 220ms |
| `animate-toast-out` | Toast leave | 180ms |
| `animate-shake` | Form error shake | 450ms |
| `animate-breathe` | Breathing opacity | 5s loop |
| `animate-marquee` | Horizontal scroll | 30s loop |

### Delay Classes
```tsx
className="animate-slide-up delay-100"  // delay: 100ms
// Available: delay-50, delay-100, delay-150, delay-200, delay-300, delay-400
```

### Hover Patterns Chuẩn
```tsx
// Card lift
className="transition-all duration-200 hover:-translate-y-0.5"

// Button lift
className="transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110"

// Icon scale
className="transition-transform duration-150 group-hover:scale-110"
```

---

## 8. Z-Index Scale

```
--z-base:           0   (normal content)
--z-dropdown:    1000   (dropdowns, tooltips)
--z-sticky:      1100   (sticky headers)
--z-fixed:       1200   (fixed elements)
--z-modal-backdrop: 1300
--z-modal:       1400   (modals/dialogs)
--z-popover:     1500
--z-tooltip:     1600
--z-toast:       1700   (toast notifications)
```

---

## 9. Page-Specific Notes

### LandingPage.tsx
- **Background**: `bg-[#050510]` — giữ nguyên (dark space theme)
- **Text**: Tailwind zinc/white classes — giữ nguyên (trang công khai, dark forced)
- **Icons/gradients**: indigo/fuchsia/cyan — nhất quán với brand
- ⚠️ Không áp dụng design tokens cho landing vì nó forced dark

### AuthPage.tsx
- Tương tự LandingPage — forced dark, dùng zinc classes
- Form fields: glass style với `border-white/[0.09]`
- ⚠️ Không thay đổi layout split-screen

### WorkspacePage.tsx (3605 dòng)
- **THẬN TRỌNG**: File rất lớn, không refactor structure
- Panels dùng `var(--bg-panel)` / `var(--bg-surface)`
- Toolbar buttons dùng pattern Icon Button chuẩn
- Editor area: `var(--bg-editor)`, font từ `editorSettings`
- AI sync states: idle/syncing/ready/error — giữ nguyên logic

### AnalysisPage.tsx (69KB)
- Chart components nằm trong `src/components/analysis/`
- Giữ nguyên chart colors (data visualization không theo brand)

### AdminDashboardPage.tsx / StaffDashboardPage.tsx
- Dùng MainLayout, áp dụng design tokens đầy đủ
- Table rows: `hover:bg-[var(--bg-hover)]`

---

## 10. Do's & Don'ts

### ✅ DO
- Dùng `var(--token-name)` cho mọi màu sắc liên quan đến UI shell
- Thêm `transition-all duration-150` (hoặc `duration-200`) cho interactive elements
- Dùng `rounded-xl` (8px) cho buttons, inputs; `rounded-2xl` cho cards; `rounded-3xl` cho modals
- Dùng `animate-scale-in` cho dropdowns/modals
- Thêm `backdrop-filter: blur()` cho floating elements (topbar, dropdowns, modals)
- Dùng `scrollbar-thin` class cho các scrollable areas
- Test cả collapsed và expanded sidebar states

### ❌ DON'T
- Đừng hardcode màu hex trực tiếp trong component (trừ LandingPage/AuthPage)
- Đừng dùng `text-zinc-*`, `bg-zinc-*` trong internal pages — dùng token thay thế
- Đừng dùng `#f5a623` hay `text-amber-400` cho navigation active states
- Đừng thêm padding `pt-*` vào `<main>` của MainLayout (đã handled)
- Đừng thay đổi z-index tùy tiện — dùng scale định sẵn
- Đừng sửa logic/state trong WorkspacePage khi chỉ cần sửa UI
- Đừng thêm `!important` vào các override (dùng specificity thay thế)
- Đừng duplicate `@import "tailwindcss"` (đã xảy ra lỗi này trước đây)

---

## 11. Checklist Trước Khi Submit

Khi thay đổi giao diện, kiểm tra:
- [ ] Dùng CSS tokens thay vì hardcode màu
- [ ] Có hover states cho interactive elements
- [ ] Animation transition đủ mượt (`duration-150` hoặc `200`)
- [ ] Sidebar collapse state vẫn hoạt động đúng
- [ ] Modal có backdrop-blur và `z-50`+
- [ ] Scrollable areas có `scrollbar-thin`
- [ ] Dark mode (default) trông đúng
- [ ] Text contrast đủ đọc được (primary trên surface)

---

## 12. File Structure Reference

```
Frontend/src/
├── components/
│   ├── Sidebar.tsx          ← Navigation sidebar (collapsible)
│   ├── Topbar.tsx           ← App header (glassmorphism)
│   ├── Toast.tsx            ← Toast notification system
│   ├── ErrorBoundary.tsx
│   ├── RewritePanel.tsx     ← AI rewrite panel (workspace)
│   ├── analysis/            ← Chart components (DonutChart, RadarChart...)
│   ├── home/
│   │   └── MyProjectsSection.tsx  ← Project list + create
│   ├── ui/                  ← Reusable UI (Button, Card, Input, Modal...)
│   └── workspace/           ← Workspace panels (ChatPanel, AiWriterPanel...)
├── layouts/
│   └── MainLayout.tsx       ← Shell layout (Sidebar + Topbar + main)
├── pages/
│   ├── LandingPage.tsx      ← Public marketing page (forced dark)
│   ├── AuthPage.tsx         ← Login/Register (forced dark)
│   ├── HomePage.tsx         ← Dashboard (MainLayout)
│   ├── WorkspacePage.tsx    ← Writing editor (custom layout, 3600+ lines)
│   ├── AnalysisPage.tsx     ← AI analysis (MainLayout)
│   ├── ProfilePage.tsx      ← User profile (MainLayout)
│   ├── SettingsPage.tsx     ← App settings (MainLayout)
│   ├── PlansPage.tsx        ← Pricing plans (public)
│   ├── SubscriptionPage.tsx ← User subscription (MainLayout)
│   ├── AdminDashboardPage.tsx
│   ├── AdminSubscriptionPage.tsx
│   └── StaffDashboardPage.tsx
├── design-tokens.css        ← All CSS Custom Properties
├── index.css                ← TW imports + utilities + animations
└── App.tsx                  ← Routes definition
```
