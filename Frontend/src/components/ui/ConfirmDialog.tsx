import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'danger',
  loading = false,
}) => {
  const icons = {
    danger: { icon: AlertTriangle, color: 'text-[var(--error)]', bg: 'bg-[var(--error-100)]' },
    warning: { icon: AlertTriangle, color: 'text-[var(--warning)]', bg: 'bg-[var(--warning-100)]' },
    info: { icon: AlertTriangle, color: 'text-[var(--info)]', bg: 'bg-[var(--info-100)]' },
  };

  const { icon: Icon, color, bg } = icons[variant];

  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
    >
      <div className="flex flex-col items-center text-center py-4">
        <div className={`p-3 rounded-full ${bg} mb-4`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>

        {title && (
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {title}
          </h3>
        )}

        <p className="text-[var(--text-secondary)] mb-6">
          {message}
        </p>

        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            fullWidth
          >
            {cancelText}
          </Button>
          <Button
            variant={buttonVariant}
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
            fullWidth
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
