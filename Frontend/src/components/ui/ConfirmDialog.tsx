import React from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';

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
  if (!isOpen) return null;

  const configs = {
    danger: {
      Icon: Trash2,
      iconGradient: 'from-red-500/20 to-red-600/10',
      iconRing: 'ring-red-500/20',
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/10',
      confirmGradient: 'from-red-500 to-red-600',
      confirmHover: 'hover:from-red-400 hover:to-red-500',
      confirmShadow: 'shadow-red-500/25',
      accent: '#ef4444',
    },
    warning: {
      Icon: AlertTriangle,
      iconGradient: 'from-amber-500/20 to-orange-500/10',
      iconRing: 'ring-amber-500/20',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      confirmGradient: 'from-violet-600 to-purple-600',
      confirmHover: 'hover:from-violet-500 hover:to-purple-500',
      confirmShadow: 'shadow-violet-500/25',
      accent: '#f59e0b',
    },
    info: {
      Icon: Info,
      iconGradient: 'from-blue-500/20 to-indigo-500/10',
      iconRing: 'ring-blue-500/20',
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      confirmGradient: 'from-blue-600 to-indigo-600',
      confirmHover: 'hover:from-blue-500 hover:to-indigo-500',
      confirmShadow: 'shadow-blue-500/25',
      accent: '#3b82f6',
    },
  };

  const cfg = configs[variant];
  const { Icon } = cfg;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      {/* Dialog card */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(30,30,40,0.98) 0%, rgba(20,20,30,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px ${cfg.accent}22`,
        }}
      >
        {/* Top accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${cfg.accent}90, transparent)`,
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center">
          {/* Icon */}
          <div
            className={`relative w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${cfg.iconBg} ring-1 ${cfg.iconRing}`}
            style={{ boxShadow: `0 8px 24px ${cfg.accent}22` }}
          >
            <div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cfg.iconGradient} opacity-60`}
            />
            <Icon className={`relative w-7 h-7 ${cfg.iconColor}`} strokeWidth={1.8} />
          </div>

          {/* Title */}
          {title && (
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{title}</h3>
          )}

          {/* Message */}
          <p
            className="text-sm leading-relaxed mb-8 max-w-[320px]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            {/* Cancel */}
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.7)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
              }}
            >
              {cancelText}
            </button>

            {/* Confirm */}
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 bg-gradient-to-r ${cfg.confirmGradient} ${cfg.confirmHover} shadow-lg ${cfg.confirmShadow}`}
              style={{ boxShadow: `0 4px 16px ${cfg.accent}35` }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Đang xử lý...
                </span>
              ) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
