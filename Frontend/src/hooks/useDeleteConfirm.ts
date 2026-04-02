import { useState } from 'react';

export interface DeleteConfirmOptions {
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

export const useDeleteConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DeleteConfirmOptions | null>(null);

  const confirm = (opts: DeleteConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  };

  const handleConfirm = async () => {
    if (options?.onConfirm) {
      await options.onConfirm();
    }
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    options,
    confirm,
    handleConfirm,
    handleClose,
  };
};
