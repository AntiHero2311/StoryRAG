# DeleteConfirmationModal - Component Cảnh Báo Xóa

Component modal cảnh báo xóa chuyên nghiệp với nhiều tính năng nâng cao.

## ✨ Tính năng

- ✅ Modal cảnh báo xóa với animation mượt mà
- ✅ Tùy chỉnh message, title, button text
- ✅ Xác nhận bằng cách nhập text (typing confirmation)
- ✅ Hiển thị danh sách cảnh báo trước khi xóa
- ✅ 2 variants: `danger` (đỏ) và `warning` (vàng)
- ✅ Loading state khi xử lý
- ✅ TypeScript type-safe
- ✅ Responsive & Accessible
- ✅ Hook `useDeleteConfirm` để dễ sử dụng

## 📦 Import

```tsx
// Component
import { DeleteConfirmationModal } from '@/components/ui';

// Hook (khuyến nghị)
import { useDeleteConfirm } from '@/hooks';
```

## 🚀 Cách sử dụng

### Phương pháp 1: Sử dụng với Hook (Khuyến nghị)

```tsx
import { useDeleteConfirm } from '@/hooks';
import { DeleteConfirmationModal } from '@/components/ui';

function MyComponent() {
  const deleteConfirm = useDeleteConfirm();

  const handleDelete = () => {
    deleteConfirm.confirm({
      itemName: 'Chương 1',
      itemType: 'chương',
      onConfirm: async () => {
        // Gọi API xóa
        await deleteChapter(chapterId);
      },
    });
  };

  return (
    <>
      <button onClick={handleDelete}>Xóa</button>
      
      {deleteConfirm.options && (
        <DeleteConfirmationModal
          isOpen={deleteConfirm.isOpen}
          onClose={deleteConfirm.handleClose}
          onConfirm={deleteConfirm.handleConfirm}
          {...deleteConfirm.options}
        />
      )}
    </>
  );
}
```

### Phương pháp 2: Sử dụng trực tiếp Component

```tsx
import { useState } from 'react';
import { DeleteConfirmationModal } from '@/components/ui';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = async () => {
    await deleteItem();
    setIsOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Xóa</button>
      
      <DeleteConfirmationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        itemName="Chương 1"
        itemType="chương"
      />
    </>
  );
}
```

## 📖 Ví dụ

### 1. Xóa đơn giản

```tsx
deleteConfirm.confirm({
  itemName: 'Chương 1',
  itemType: 'chương',
  onConfirm: async () => {
    await api.deleteChapter(id);
  },
});
```

### 2. Xóa với cảnh báo

```tsx
deleteConfirm.confirm({
  itemName: 'Câu chuyện "Hành trình phiêu lưu"',
  itemType: 'câu chuyện',
  showWarnings: true,
  warnings: [
    'Tất cả các chương trong câu chuyện sẽ bị xóa',
    'Dữ liệu phân tích sẽ bị mất',
    'Người dùng đã lưu sẽ không thể truy cập',
  ],
  onConfirm: async () => {
    await api.deleteStory(id);
  },
});
```

### 3. Xóa với xác nhận gõ text

```tsx
deleteConfirm.confirm({
  itemName: 'Tài khoản người dùng',
  itemType: 'tài khoản',
  title: 'Xóa tài khoản vĩnh viễn?',
  requireTyping: true,
  typingConfirmText: 'DELETE',
  showWarnings: true,
  warnings: [
    'Mọi dữ liệu sẽ bị xóa vĩnh viễn',
    'Không thể khôi phục',
  ],
  onConfirm: async () => {
    await api.deleteAccount(id);
  },
});
```

### 4. Xóa với custom message

```tsx
deleteConfirm.confirm({
  title: 'Xóa file tạm thời',
  message: 'Bạn có muốn xóa các file tạm thời?\nViệc này giúp giải phóng dung lượng.',
  confirmText: 'Xóa ngay',
  cancelText: 'Giữ lại',
  variant: 'warning',
  onConfirm: async () => {
    await api.cleanTempFiles();
  },
});
```

### 5. Xóa nhiều items

```tsx
deleteConfirm.confirm({
  title: 'Xóa nhiều mục',
  message: `Bạn đã chọn ${selectedItems.length} mục để xóa.\nHành động này không thể hoàn tác.`,
  requireTyping: true,
  typingConfirmText: 'CONFIRM',
  onConfirm: async () => {
    await api.bulkDelete(selectedItems);
  },
});
```

## 🎨 Props

### DeleteConfirmationModal Props

| Prop | Type | Mặc định | Mô tả |
|------|------|----------|-------|
| `isOpen` | `boolean` | - | Trạng thái mở/đóng modal |
| `onClose` | `() => void` | - | Callback khi đóng modal |
| `onConfirm` | `() => void \| Promise<void>` | - | Callback khi xác nhận xóa |
| `title` | `string` | `"Xác nhận xóa"` | Tiêu đề modal |
| `message` | `string` | auto-generate | Nội dung thông báo |
| `itemName` | `string` | - | Tên item cần xóa |
| `itemType` | `string` | `"mục"` | Loại item (chương, câu chuyện, tài khoản...) |
| `confirmText` | `string` | `"Xóa"` | Text button xác nhận |
| `cancelText` | `string` | `"Hủy"` | Text button hủy |
| `requireTyping` | `boolean` | `false` | Yêu cầu nhập text để xác nhận |
| `typingConfirmText` | `string` | `"DELETE"` | Text cần nhập để xác nhận |
| `showWarnings` | `boolean` | `false` | Hiển thị danh sách cảnh báo |
| `warnings` | `string[]` | `[]` | Danh sách cảnh báo |
| `customIcon` | `ReactNode` | - | Icon tùy chỉnh |
| `variant` | `'danger' \| 'warning'` | `'danger'` | Kiểu cảnh báo |
| `loading` | `boolean` | `false` | Trạng thái loading |

### useDeleteConfirm Hook

**Returns:**
```tsx
{
  isOpen: boolean;           // Trạng thái modal
  options: DeleteConfirmOptions | null;  // Options hiện tại
  confirm: (opts: DeleteConfirmOptions) => void;  // Mở modal
  handleConfirm: () => Promise<void>;  // Xử lý confirm
  handleClose: () => void;   // Đóng modal
}
```

**DeleteConfirmOptions:**
```tsx
interface DeleteConfirmOptions {
  itemName?: string;
  itemType?: string;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  requireTyping?: boolean;
  typingConfirmText?: string;
  showWarnings?: boolean;
  warnings?: string[];
  variant?: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
}
```

## 🎯 Best Practices

1. **Sử dụng `itemName` và `itemType`** cho message tự động sinh:
   ```tsx
   itemName: "Chương 1"
   itemType: "chương"
   // → "Bạn có chắc chắn muốn xóa chương "Chương 1"?"
   ```

2. **Bật `requireTyping` cho các hành động nguy hiểm:**
   ```tsx
   requireTyping: true  // Xóa tài khoản, xóa database, etc.
   ```

3. **Thêm `warnings` cho context:**
   ```tsx
   warnings: [
     'Dữ liệu liên quan sẽ bị xóa',
     'Không thể hoàn tác'
   ]
   ```

4. **Sử dụng `variant: 'warning'` cho hành động ít nguy hiểm:**
   ```tsx
   variant: 'warning'  // Xóa cache, temp files, etc.
   ```

5. **Xử lý errors trong `onConfirm`:**
   ```tsx
   onConfirm: async () => {
     try {
       await api.delete(id);
       toast.success('Đã xóa thành công');
     } catch (error) {
       toast.error('Lỗi khi xóa');
       throw error; // Modal vẫn mở nếu có lỗi
     }
   }
   ```

## 🎨 Customization

### Custom Icon

```tsx
import { Trash, Archive } from 'lucide-react';

<DeleteConfirmationModal
  customIcon={<Archive className="w-8 h-8 text-blue-500" />}
  variant="warning"
  title="Lưu trữ"
  message="Di chuyển vào thùng rác?"
/>
```

### Custom Styling

Component sử dụng CSS variables từ design-tokens.css, bạn có thể tùy chỉnh:

```css
--error: #ef4444;
--error-100: #fee2e2;
--warning: #f59e0b;
--warning-100: #fef3c7;
```

## 📝 Demo

Chạy component example để xem tất cả các ví dụ:

1. Import component example:
   ```tsx
   import DeleteConfirmationExample from '@/components/ui/DeleteConfirmationExample';
   ```

2. Thêm vào route hoặc page:
   ```tsx
   <DeleteConfirmationExample />
   ```

3. Hoặc xem trực tiếp file: `src/components/ui/DeleteConfirmationExample.tsx`

## 🔧 Troubleshooting

**Q: Modal không đóng sau khi confirm?**
- Đảm bảo `onConfirm` không throw error
- Check console có lỗi không

**Q: Typing confirmation không hoạt động?**
- Kiểm tra `requireTyping={true}` và `typingConfirmText` đúng
- Input phải match chính xác (case-sensitive)

**Q: Làm sao để modal tự đóng sau khi xóa thành công?**
- Nếu dùng hook: Modal tự đóng sau `onConfirm` thành công
- Nếu dùng trực tiếp: Gọi `onClose()` trong `onConfirm`

## 📄 License

MIT - Free to use in your project!
