import React from 'react';
import Spinner from './Spinner';

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  blur?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message,
  fullScreen = false,
  blur = true,
}) => {
  if (!isLoading) return null;

  const containerClass = fullScreen
    ? 'fixed inset-0 z-[var(--z-modal)]'
    : 'absolute inset-0 z-10';

  return (
    <div
      className={`
        ${containerClass}
        flex flex-col items-center justify-center
        bg-[var(--bg-app)]/80
        ${blur ? 'backdrop-blur-sm' : ''}
      `}
    >
      <Spinner size="lg" />
      {message && (
        <p className="mt-4 text-sm text-[var(--text-secondary)] animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingOverlay;
