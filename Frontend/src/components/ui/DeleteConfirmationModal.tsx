import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Trash2, AlertTriangle, Info } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  itemName?: string;
  itemType?: string;
  confirmText?: string;
  cancelText?: string;
  requireTyping?: boolean;
  typingConfirmText?: string;
  showWarnings?: boolean;
  warnings?: string[];
  customIcon?: React.ReactNode;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Xác nhận xóa',
  message,
  itemName,
  itemType = 'mục',
  confirmText = 'Xóa',
  cancelText = 'Hủy',
  requireTyping = false,
  typingConfirmText = 'DELETE',
  showWarnings = false,
  warnings = [],
  customIcon,
  variant = 'danger',
  loading = false,
}) => {
  const [typedText, setTypedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const canConfirm = requireTyping
    ? typedText === typingConfirmText && !isProcessing && !loading
    : !isProcessing && !loading;

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error('Delete confirmation error:', error);
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setTypedText('');
    setIsProcessing(false);
    onClose();
  };

  const getIcon = () => {
    if (customIcon) return customIcon;

    return variant === 'danger' ? (
      <Trash2 className="w-8 h-8 text-[var(--error)]" />
    ) : (
      <AlertTriangle className="w-8 h-8 text-[var(--warning)]" />
    );
  };

  const getDefaultMessage = () => {
    if (message) return message;
    if (itemName) {
      return `Bạn có chắc chắn muốn xóa ${itemType} "${itemName}"? Hành động này không thể hoàn tác.`;
    }
    return `Bạn có chắc chắn muốn xóa ${itemType} này? Hành động này không thể hoàn tác.`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      showCloseButton={false}
      closeOnBackdropClick={!isProcessing && !loading}
      closeOnEscape={!isProcessing && !loading}
    >
      <div className="flex flex-col items-center text-center py-4">
        {/* Icon */}
        <div
          className={`p-3 rounded-full mb-4 ${
            variant === 'danger'
              ? 'bg-[var(--error-100)]'
              : 'bg-[var(--warning-100)]'
          }`}
        >
          {getIcon()}
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-[var(--text-secondary)] mb-4 whitespace-pre-line">
          {getDefaultMessage()}
        </p>

        {/* Warnings */}
        {showWarnings && warnings.length > 0 && (
          <div className="w-full mb-4 p-4 rounded-lg bg-[var(--warning-100)] border border-[var(--warning-200)]">
            <div className="flex items-start gap-2 mb-2">
              <Info className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-semibold text-[var(--warning-text)] text-sm mb-2">
                  Lưu ý quan trọng:
                </p>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-[var(--warning)] mt-0.5">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Typing Confirmation */}
        {requireTyping && (
          <div className="w-full mb-4">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2 text-left">
              Để xác nhận, vui lòng nhập{' '}
              <code className="px-2 py-0.5 bg-[var(--bg-surface)] rounded text-[var(--error)] font-mono">
                {typingConfirmText}
              </code>
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg 
                       text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--error)] focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={typingConfirmText}
              disabled={isProcessing || loading}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isProcessing || loading}
            fullWidth
          >
            {cancelText}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={isProcessing || loading}
            disabled={!canConfirm}
            fullWidth
            leftIcon={!isProcessing && !loading ? <Trash2 size={18} /> : undefined}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteConfirmationModal;
