# StoryNest UI Design Guide

Tài liệu này quy định các chuẩn thiết kế giao diện, CSS architecture và các UI component patterns cho dự án StoryNest. Tuân thủ tài liệu này giúp đảm bảo tính nhất quán (consistency) và trải nghiệm người dùng (UX) ở chuẩn Premium Dark.

---

## 1. Core Visual Language

StoryNest sử dụng phong cách **Premium Dark & Glassmorphism** làm chủ đạo.

*   **Primary Accent**: Violet / Indigo gradient (chuyển từ Amber `#f5a623` sang `#7c3aed` / `#4f46e5`).
*   **Backgrounds**: Tối sâu (Deep Dark `#050510` hoặc `#08080f`) kết hợp với ánh sáng tự nhiên (ambient glows).
*   **Surfaces**: Semi-transparent (Kính - Glassmorphism) với `backdrop-blur`.
*   **Borders**: Rất mỏng (`1px`), màu sáng nhẹ (`rgba(255,255,255,0.06)`).

---

## 2. Design Tokens Reference

Mọi thông số CSS đều phải dùng qua biến (CSS Variables) được định nghĩa trong `src/design-tokens.css`. **Tuyệt đối không hardcode màu sắc**.

### 2.1 Colors
*   `var(--bg-app)`: Nền chính của ứng dụng (thường là `#050510` hoặc cực tối).
*   `var(--bg-surface)`: Nền cho thẻ/card, panel (có độ trong suốt hoặc sáng hơn một chút).
*   `var(--bg-elevated)`: Nền cho dropdown, modal (sáng hơn surface, shadow đậm hơn).
*   `var(--hover-bg)`: Nền khi hover vào item (`rgba(255,255,255,0.04)`).
*   `var(--accent)`: Màu nhấn chính (Violet `#8b5cf6`).
*   `var(--accent-hover)`: Màu nhấn khi hover (sáng hơn).
*   `var(--text-primary)`: Chữ chính (Trắng hơi xám `#f3f4f6`).
*   `var(--text-secondary)`: Chữ phụ, icon (`#9ca3af`).
*   `var(--border-color)`: Viền chung (`rgba(255,255,255,0.08)`).

### 2.2 Glassmorphism Utilities
*   `var(--glass-bg)`: `rgba(13, 13, 26, 0.4)`
*   `var(--glass-border)`: `1px solid rgba(255, 255, 255, 0.05)`
*   `var(--glass-shadow)`: `0 8px 32px 0 rgba(0, 0, 0, 0.3)`

---

## 3. Component Patterns

### 3.1 Buttons
*   **Primary Action (Lưu, Tạo mới, Embed)**: Dùng gradient accent.
    ```css
    background: linear-gradient(135deg, rgba(139,92,246,0.9), rgba(99,102,241,0.9));
    color: #fff;
    box-shadow: 0 4px 15px rgba(139,92,246,0.25);
    ```
*   **Secondary Action (Hủy, Đóng)**: Dùng background trong suốt + hover.
    ```css
    background: var(--hover-bg);
    color: var(--text-secondary);
    /* on hover: color: var(--text-primary) */
    ```
*   **Destructive Action (Xóa)**: Dùng tone đỏ (Rose/Red).
    ```css
    background: rgba(239,68,68,0.1);
    color: #ef4444;
    ```

### 3.2 Cards & Panels
Sử dụng thẻ có bo góc lớn (rounded-2xl hoặc rounded-xl), viền mỏng và nền kính.
```jsx
<div 
  className="rounded-2xl overflow-hidden" 
  style={{
    background: 'var(--bg-surface)', 
    border: '1px solid var(--border-color)',
    backdropFilter: 'blur(12px)'
  }}
>
  {/* Content */}
</div>
```

### 3.3 Inputs & Textareas
*   Không viền khi idle (hoặc viền rất mỏng).
*   Khi focus: `ring-1` hoặc `border` màu accent.
*   Background: `var(--input-bg)` hoặc `rgba(0,0,0,0.2)`.

---

## 4. Animation Reference

*   Dùng các animation nhẹ nhàng tạo cảm giác mượt mà (smoothness).
*   **Fade Slide In**: Dành cho items trong list, dropdowns, modal content.
    *   Sử dụng CSS keyframes `fadeSlideIn` (opacity 0 -> 1, translateY 10px -> 0).
*   **Hover Scaling**:
    *   Buttons: `hover:scale-105 active:scale-95 transition-all`.
    *   Cards: `hover:-translate-y-1 hover:shadow-xl transition-all duration-300`.

---

## 5. Do's & Don'ts

### ✅ DO (Nên làm)
*   Luôn dùng biến CSS `var(--name)` thay vì hex code (vd: `#111` hoặc `bg-zinc-900`).
*   Dùng Tailwind utility cho spacing (`p-4`, `m-2`), typography (`text-sm`, `font-bold`), layout (`flex`, `grid`).
*   Giữ border radius đồng nhất (`rounded-xl` hoặc `rounded-2xl` cho khối lớn, `rounded-lg` cho nút nhỏ).
*   Thêm icon (Lucide React) vào các nút hành động để tăng tính trực quan.

### ❌ DON'T (Tuyệt đối tránh)
*   **Không** mix lẫn lộn màu text (vd: chỗ dùng `text-gray-400`, chỗ dùng `var(--text-secondary)`). Phải dùng biến.
*   **Không** dùng màu Amber (`#f5a623`) làm màu nhấn nữa, trừ khi đó là logic cảnh báo (Warning). Accent hiện tại là Violet.
*   **Không** làm button rực rỡ nếu nó chỉ là secondary action. Phân cấp thị giác (Visual Hierarchy) rất quan trọng.
*   **Không** dùng thẻ `box-shadow` đen sì mà không có độ trong suốt (opacity), hãy dùng rgba.

---

## 6. Page-Specific Notes

*   **Landing Page**: Là mặt tiền, sử dụng tối đa hiệu ứng ánh sáng (ambient glow orb), background `#050510`, text size lớn.
*   **Workspace Page**: Giao diện làm việc tập trung (Distraction-free). Các panel dùng viền mỏng, nền đen sâu `#08080f` để không làm mỏi mắt khi viết lâu. Nút "Embed AI" được highlight bằng màu Emerald hoặc gradient Violet.
*   **Settings / Auth Pages**: Các form nhập liệu phải nằm trong block Glassmorphism, căn giữa, đơn giản, sạch sẽ.
