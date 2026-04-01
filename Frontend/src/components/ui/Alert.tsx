import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const styles = {
    success: {
      container: 'bg-[var(--success-50)] border-[var(--success-200)] text-[var(--success-700)]',
      icon: 'text-[var(--success-500)]',
    },
    error: {
      container: 'bg-[var(--error-50)] border-[var(--error-200)] text-[var(--error-700)]',
      icon: 'text-[var(--error-500)]',
    },
    warning: {
      container: 'bg-[var(--warning-50)] border-[var(--warning-200)] text-[var(--warning-700)]',
      icon: 'text-[var(--warning-500)]',
    },
    info: {
      container: 'bg-[var(--info-50)] border-[var(--info-200)] text-[var(--info-700)]',
      icon: 'text-[var(--info-500)]',
    },
  };

  const Icon = icons[variant];
  const style = styles[variant];

  return (
    <div
      className={`
        flex gap-3 p-4 rounded-lg border
        ${style.container}
        ${className}
      `}
      role="alert"
    >
      <Icon className={`flex-shrink-0 w-5 h-5 ${style.icon}`} />
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-semibold mb-1">
            {title}
          </h4>
        )}
        <div className="text-sm">
          {children}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-0.5 hover:opacity-70 transition-opacity"
          aria-label="Close alert"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

export default Alert;
