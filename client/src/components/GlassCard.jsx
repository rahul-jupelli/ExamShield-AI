import React from 'react';

export default function GlassCard({ children, className = '', id, hoverEffect = false }) {
  return (
    <div
      id={id}
      className={`
        relative overflow-hidden rounded-2xl border border-blue-900/30 bg-slate-900/40 backdrop-blur-md p-6
        ${hoverEffect ? 'hover:border-blue-500/40 hover:bg-slate-900/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(37,99,235,0.1)]' : ''}
        ${className}
      `}
    >
      {/* Decorative inner ambient glow */}
      <div className="absolute -left-16 -top-16 h-32 w-32 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
