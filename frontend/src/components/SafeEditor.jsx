import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Editor Crash Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 border-2 border-red-100 rounded-xl bg-red-50 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-red-900 mb-2">Rich Editor Failed to Load</h3>
          <p className="text-red-600 text-sm mb-4 max-w-md">
            The rich text component encountered an error (possibly due to React 19 compatibility). 
            Please use **Plain Text** mode to continue editing your lesson safely.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition shadow-sm font-bold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SafeEditor({ children }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
