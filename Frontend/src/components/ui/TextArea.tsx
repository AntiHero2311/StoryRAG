import React, { TextareaHTMLAttributes, forwardRef, useState } from 'react';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  showCharCount?: boolean;
  maxLength?: number;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      showCharCount = false,
      maxLength,
      className = '',
      id,
      disabled,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const [isFocused, setIsFocused] = useState(false);
    const [charCount, setCharCount] = useState(
      typeof value === 'string' ? value.length : 0
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    const containerClass = fullWidth ? 'w-full' : '';
    
    const wrapperClass = `
      flex flex-col
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

    const textareaClass = `
      w-full min-h-[100px] p-3
      bg-transparent
      text-[var(--text-primary)] text-sm
      placeholder:text-[var(--text-tertiary)]
      focus:outline-none
      resize-y
      disabled:cursor-not-allowed
      ${className}
    `;

    return (
      <div className={containerClass}>
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-[var(--text-primary)]"
            >
              {label}
            </label>
          )}
          {showCharCount && maxLength && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {charCount}/{maxLength}
            </span>
          )}
        </div>
        <div className={wrapperClass}>
          <textarea
            ref={ref}
            id={inputId}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            onChange={handleChange}
            className={textareaClass}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
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

TextArea.displayName = 'TextArea';

export default TextArea;
