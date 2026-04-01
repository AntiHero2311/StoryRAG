import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const baseStyles = `
    inline-flex items-center gap-1.5
    font-medium rounded-full
    transition-colors duration-200
  `;

  const variantStyles = {
    success: 'bg-[var(--success-100)] text-[var(--success-700)] border border-[var(--success-200)]',
    error: 'bg-[var(--error-100)] text-[var(--error-700)] border border-[var(--error-200)]',
    warning: 'bg-[var(--warning-100)] text-[var(--warning-700)] border border-[var(--warning-200)]',
    info: 'bg-[var(--info-100)] text-[var(--info-700)] border border-[var(--info-200)]',
    neutral: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]',
    primary: 'bg-[var(--primary-100)] text-[var(--primary-700)] border border-[var(--primary-200)]',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const dotColorStyles = {
    success: 'bg-[var(--success-500)]',
    error: 'bg-[var(--error-500)]',
    warning: 'bg-[var(--warning-500)]',
    info: 'bg-[var(--info-500)]',
    neutral: 'bg-[var(--gray-500)]',
    primary: 'bg-[var(--accent)]',
  };

  const dotSizeStyles = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {dot && (
        <span className={`rounded-full ${dotColorStyles[variant]} ${dotSizeStyles[size]}`} />
      )}
      {children}
    </span>
  );
};

export default Badge;
