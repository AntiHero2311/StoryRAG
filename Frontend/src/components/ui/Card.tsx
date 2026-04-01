import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  header,
  footer,
  className = '',
  onClick,
  hoverable = false,
}) => {
  const baseStyles = `
    bg-[var(--bg-card)]
    rounded-lg
    transition-all duration-200
    ${onClick || hoverable ? 'cursor-pointer' : ''}
  `;

  const variantStyles = {
    default: `
      border border-[var(--border-color)]
      ${hoverable ? 'hover:border-[var(--border-hover)] hover:shadow-sm' : ''}
    `,
    outlined: `
      border-2 border-[var(--border-strong)]
      ${hoverable ? 'hover:border-[var(--accent)] hover:shadow-sm' : ''}
    `,
    elevated: `
      shadow-md
      ${hoverable ? 'hover:shadow-lg hover:-translate-y-0.5' : ''}
    `,
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      onClick={onClick}
    >
      {header && (
        <div className={`${paddingStyles[padding]} border-b border-[var(--border-color)] pb-4`}>
          {header}
        </div>
      )}
      <div className={paddingStyles[padding]}>
        {children}
      </div>
      {footer && (
        <div className={`${paddingStyles[padding]} border-t border-[var(--border-color)] pt-4`}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
