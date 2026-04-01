import React, { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center
      font-medium rounded-lg
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      ${fullWidth ? 'w-full' : ''}
    `;

    const variantStyles = {
      primary: `
        bg-[var(--accent)] text-[var(--text-on-accent)]
        hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]
        focus:ring-[var(--accent)] shadow-sm hover:shadow-md
      `,
      secondary: `
        bg-[var(--bg-surface)] text-[var(--text-primary)]
        border border-[var(--border-color)]
        hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]
        focus:ring-[var(--accent)]
      `,
      outline: `
        bg-transparent text-[var(--accent-text)]
        border border-[var(--accent)]
        hover:bg-[var(--accent-subtle)] active:bg-[var(--accent-subtle)]
        focus:ring-[var(--accent)]
      `,
      ghost: `
        bg-transparent text-[var(--text-primary)]
        hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]
        focus:ring-[var(--accent)]
      `,
      danger: `
        bg-[var(--error)] text-[var(--text-on-error)]
        hover:bg-[var(--error-600)] active:bg-[var(--error-700)]
        focus:ring-[var(--error)] shadow-sm hover:shadow-md
      `,
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-sm gap-1.5',
      md: 'h-10 px-4 text-base gap-2',
      lg: 'h-12 px-6 text-lg gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && leftIcon && leftIcon}
        {children}
        {!loading && rightIcon && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
