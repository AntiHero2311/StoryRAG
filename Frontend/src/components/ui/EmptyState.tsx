import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-[var(--bg-surface)] text-[var(--text-tertiary)]">
          <Icon size={48} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="
            inline-flex items-center gap-2
            px-4 py-2
            bg-[var(--accent)] text-[var(--text-on-accent)]
            hover:bg-[var(--accent-hover)]
            rounded-lg font-medium text-sm
            transition-colors duration-200
          "
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
