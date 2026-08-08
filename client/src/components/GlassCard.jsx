import React from 'react';

export default function GlassCard({ children, className = '', id, hoverEffect = false, theme = 'dark' }) {
  const isLight = theme === 'light';

  return (
    <div
      id={id}
      className={`
        relative overflow-hidden rounded-2xl border backdrop-blur-md p-6 transition-colors duration-200
        ${isLight 
          ? 'border-slate-200 bg-white/80 text-slate-800 shadow-sm' 
          : 'border-blue-900/30 bg-slate-900/40 text-slate-200'}
        ${hoverEffect 
          ? isLight 
            ? 'hover:border-blue-400 hover:bg-white transition-all duration-300 hover:shadow-md' 
            : 'hover:border-blue-500/40 hover:bg-slate-900/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(37,99,235,0.1)]' 
          : ''}
        ${className}
      `}
    >
      {/* Decorative inner ambient glow */}
      <div className={`absolute -left-16 -top-16 h-32 w-32 rounded-full blur-3xl pointer-events-none ${
        isLight ? 'bg-blue-500/10' : 'bg-blue-500/5'
      }`} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
