import React from 'react';
import { X, ArrowDownCircle, CheckCircle, XCircle } from 'lucide-react';

export function UploadCard({
  status = 'uploading', // 'uploading' | 'success' | 'error'
  progress = 0,
  title,
  description,
  primaryButtonText,
  onPrimaryButtonClick,
  secondaryButtonText,
  onSecondaryButtonClick,
  onClose
}) {
  const renderIcon = () => {
    switch (status) {
      case 'uploading':
        return (
          <div className="h-9 w-9 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
            <ArrowDownCircle className="h-5 w-5" />
          </div>
        );
      case 'success':
        return (
          <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <CheckCircle className="h-5 w-5" />
          </div>
        );
      case 'error':
        return (
          <div className="h-9 w-9 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
            <XCircle className="h-5 w-5" />
          </div>
        );
      default:
        return null;
    }
  };

  const borderColor = 
    status === 'uploading' ? 'border-blue-500/40 bg-slate-900/90' :
    status === 'success' ? 'border-emerald-500/40 bg-slate-900/90' :
    'border-rose-500/40 bg-slate-900/90';

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${borderColor} text-slate-100 p-5 shadow-lg transition-all duration-200`}>
      
      {/* Card Header Close Button */}
      <div className="flex justify-end mb-1">
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Card Body */}
      <div className="flex items-start gap-4">
        {renderIcon()}

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white tracking-tight leading-snug mb-1">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-4">
            {description}
          </p>

          {/* Progress Bar for Uploading Status */}
          {status === 'uploading' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex justify-end">
                  <span className="text-xs font-mono font-bold text-slate-300">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {primaryButtonText && (
                <button
                  onClick={onPrimaryButtonClick}
                  className="bg-[#242834] hover:bg-[#2e3344] text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer border border-white/5 flex-shrink-0"
                >
                  {primaryButtonText}
                </button>
              )}
            </div>
          )}

          {/* Success or Error Action Buttons */}
          {(status === 'success' || status === 'error') && (
            <div className="flex items-center gap-2.5 pt-1">
              {primaryButtonText && (
                <button
                  onClick={onPrimaryButtonClick}
                  className="bg-[#242834] hover:bg-[#2e3344] text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer border border-white/5"
                >
                  {primaryButtonText}
                </button>
              )}
              {secondaryButtonText && (
                <button
                  onClick={onSecondaryButtonClick}
                  className="bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  {secondaryButtonText}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default UploadCard;
