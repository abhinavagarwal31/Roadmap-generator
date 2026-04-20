// src/components/ErrorBoundary.jsx
// Class-based error boundary that catches render-time errors in child trees.
// Prevents the entire app from crashing on bad Firestore data or component errors.

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught a render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="fixed inset-0 bg-bg-primary flex flex-col items-center justify-center z-50 px-6">
        <div className="w-full max-w-md text-center">
          {/* Icon */}
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center
                        rounded-full border border-red-900 bg-red-950"
          >
            <span className="text-2xl">⚠️</span>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            An unexpected error occurred while rendering this page. Your progress data is safe.
          </p>

          {this.state.error?.message && (
            <pre
              className="mb-6 rounded border border-neutral-800 bg-bg-card px-4 py-3
                         text-xs text-red-400 text-left overflow-x-auto whitespace-pre-wrap"
            >
              {this.state.error.message}
            </pre>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={this.handleReset}
              className="rounded border border-accent-red bg-accent-red px-5 py-2.5
                         text-sm font-medium text-white hover:bg-accent-redHover transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="rounded border border-neutral-700 px-5 py-2.5 text-sm
                         text-gray-300 hover:border-neutral-500 hover:text-white transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
