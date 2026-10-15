import React from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ExamShield ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070a16] text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-[#0d1326] border border-rose-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="h-8 w-8 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold tracking-tight text-white">
                Terminal Runtime Anomaly
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                An unexpected exception was intercepted by the security shell.
              </p>
              {this.state.error?.message && (
                <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-rose-300 text-left overflow-x-auto max-h-28">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Terminal</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="h-4 w-4" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
