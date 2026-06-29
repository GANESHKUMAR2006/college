import React from 'react';
import { logger } from '../../utils/logger';
import { RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error(`ErrorBoundary caught rendering exception in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    // Automatically reset error state when switching selected students (keys mismatch)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-200/60 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/10 p-5 shadow-sm text-center space-y-4">
          <div className="flex justify-center text-rose-500">
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {this.props.name || 'Platform Card'} Failed to Load
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              An unexpected rendering error occurred. The other elements remain active.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry Card
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
