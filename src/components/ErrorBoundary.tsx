import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('React application crashed.', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="error-shell" role="alert" aria-live="assertive">
        <div className="error-panel">
          <p className="error-title">Something went wrong.</p>
          <p className="error-message">{this.state.error.message}</p>
          <button type="button" className="error-button" onClick={this.handleReload}>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
