import React, { InputHTMLAttributes, forwardRef, useState } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const [isFocused, setIsFocused] = useState(false);

    const containerClass = fullWidth ? 'w-full' : '';
    
    const inputWrapperClass = `
      flex items-center gap-2
      bg-[var(--input-bg)] 
      border rounded-lg
      transition-all duration-200
      ${error 
        ? 'border-[var(--border-error)] focus-within:border-[var(--border-error)] focus-within:ring-2 focus-within:ring-[var(--error-100)]' 
        : isFocused
        ? 'border-[var(--border-focus)] ring-2 ring-[var(--accent-subtle)]'
        : 'border-[var(--border-color)] hover:border-[var(--border-hover)]'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--input-bg-disabled)]' : ''}
    `;

    const inputClass = `
      flex-1 h-10 px-3
      bg-transparent
      text-[var(--text-primary)] text-sm
      placeholder:text-[var(--text-tertiary)]
      focus:outline-none
      disabled:cursor-not-allowed
      ${className}
    `;

    return (
      <div className={containerClass}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className={inputWrapperClass}>
          {leftIcon && (
            <span className="pl-3 text-[var(--text-secondary)] flex-shrink-0">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={inputClass}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
          {rightIcon && (
            <span className="pr-3 text-[var(--text-secondary)] flex-shrink-0">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-[var(--error)]">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
