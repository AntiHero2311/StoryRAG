import React from 'react';
import { Trash2 } from 'lucide-react';
import Button from './Button';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm';

/**
 * Component này là ví dụ cách sử dụng DeleteConfirmationModal
 * Bạn có thể xóa file này sau khi hiểu cách sử dụng
 */

const DeleteConfirmationExample: React.FC = () => {
  const deleteConfirm = useDeleteConfirm();

  // Ví dụ 1: Xóa đơn giản
  const handleSimpleDelete = () => {
    deleteConfirm.confirm({
      itemName: 'Chương 1',
      itemType: 'chương',
      onConfirm: async () => {
        // Gọi API xóa ở đây
        console.log('Đã xóa!');
      },
    });
  };

  // Ví dụ 2: Xóa với cảnh báo
  const handleDeleteWithWarnings = () => {
    deleteConfirm.confirm({
      itemName: 'Câu chuyện "Hành trình phiêu lưu"',
      itemType: 'câu chuyện',
      showWarnings: true,
      warnings: [
        'Tất cả các chương trong câu chuyện sẽ bị xóa',
        'Dữ liệu phân tích và thống kê sẽ bị mất',
        'Người dùng đã lưu câu chuyện này sẽ không thể truy cập',
      ],
      onConfirm: async () => {
        console.log('Đã xóa với cảnh báo!');
      },
    });
  };

  // Ví dụ 3: Xóa yêu cầu nhập text xác nhận
  const handleDeleteWithTyping = () => {
    deleteConfirm.confirm({
      itemName: 'Tài khoản người dùng',
      itemType: 'tài khoản',
      title: 'Xóa tài khoản vĩnh viễn?',
      requireTyping: true,
      typingConfirmText: 'DELETE',
      showWarnings: true,
      warnings: [
        'Mọi dữ liệu của tài khoản sẽ bị xóa vĩnh viễn',
        'Không thể khôi phục sau khi xóa',
      ],
      onConfirm: async () => {
        console.log('Đã xóa với typing confirmation!');
      },
    });
  };

  // Ví dụ 4: Xóa với custom message và variant warning
  const handleDeleteWithCustomMessage = () => {
    deleteConfirm.confirm({
      title: 'Xóa file tạm thời',
      message: 'Bạn có muốn xóa các file tạm thời không?\nViệc này có thể giúp giải phóng dung lượng.',
      confirmText: 'Xóa ngay',
      variant: 'warning',
      onConfirm: async () => {
        console.log('Đã xóa file tạm!');
      },
    });
  };

  return (
    <div className="p-8 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        Ví dụ sử dụng DeleteConfirmationModal
      </h1>

      <div className="space-y-4">
        {/* Ví dụ 1 */}
        <div className="p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-color)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">
            1. Xóa đơn giản
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Modal xóa cơ bản với message mặc định
          </p>
          <Button
            variant="danger"
            onClick={handleSimpleDelete}
            leftIcon={<Trash2 size={16} />}
          >
            Xóa chương
          </Button>
        </div>

        {/* Ví dụ 2 */}
        <div className="p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-color)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">
            2. Xóa với cảnh báo
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Hiển thị danh sách cảnh báo trước khi xóa
          </p>
          <Button
            variant="danger"
            onClick={handleDeleteWithWarnings}
            leftIcon={<Trash2 size={16} />}
          >
            Xóa câu chuyện
          </Button>
        </div>

        {/* Ví dụ 3 */}
        <div className="p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-color)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">
            3. Xóa với xác nhận gõ text
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Yêu cầu người dùng nhập "DELETE" để xác nhận
          </p>
          <Button
            variant="danger"
            onClick={handleDeleteWithTyping}
            leftIcon={<Trash2 size={16} />}
          >
            Xóa tài khoản
          </Button>
        </div>

        {/* Ví dụ 4 */}
        <div className="p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-color)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">
            4. Xóa với custom message và variant warning
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Sử dụng variant "warning" thay vì "danger"
          </p>
          <Button
            variant="outline"
            onClick={handleDeleteWithCustomMessage}
            leftIcon={<Trash2 size={16} />}
          >
            Xóa file tạm
          </Button>
        </div>
      </div>

      {/* Modal */}
      {deleteConfirm.options && (
        <DeleteConfirmationModal
          isOpen={deleteConfirm.isOpen}
          onClose={deleteConfirm.handleClose}
          onConfirm={deleteConfirm.handleConfirm}
          {...deleteConfirm.options}
        />
      )}
    </div>
  );
};

export default DeleteConfirmationExample;
