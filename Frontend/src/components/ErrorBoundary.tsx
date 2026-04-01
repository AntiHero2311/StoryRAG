import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/home';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-app)] px-4">
          <div className="max-w-2xl w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-8 shadow-lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-[var(--error-100)] rounded-lg">
                <svg
                  className="w-8 h-8 text-[var(--error)]"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                  Đã xảy ra lỗi
                </h2>
                <p className="text-[var(--text-secondary)] mb-4">
                  Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang hoặc quay về trang chủ.
                </p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-color)]">
                <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)] mb-2">
                  Chi tiết lỗi (Development only)
                </summary>
                <div className="mt-2 text-xs font-mono text-[var(--error)] whitespace-pre-wrap break-all">
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <div className="mt-2 text-[var(--text-secondary)]">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <Button onClick={this.handleReload} variant="primary">
                Tải lại trang
              </Button>
              <Button onClick={this.handleReset} variant="secondary">
                Quay về trang chủ
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
