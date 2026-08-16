import React from 'react';

export default function GlassCard({ 
  children, 
  className = '', 
  id, 
  hoverEffect = false, 
  theme = 'dark',
  variant = 'default' // 'default' | 'blue' | 'green' | 'red'
}) {
  const isLight = theme === 'light';

  // Variant styling matching the UI component kit theme
  const variantStyle = 
    variant === 'blue' ? 'border-blue-500/40 bg-[#141724] shadow-[0_8px_30px_rgba(37,99,235,0.15)]' :
    variant === 'green' ? 'border-emerald-500/40 bg-[#141a24] shadow-[0_8px_30px_rgba(16,185,129,0.15)]' :
    variant === 'red' ? 'border-rose-500/40 bg-[#1e1520] shadow-[0_8px_30px_rgba(244,63,94,0.15)]' :
    'border-slate-800/80 bg-[#121520] shadow-[0_12px_32px_rgba(0,0,0,0.5)]';

  return (
    <div
      id={id}
      className={`
        relative overflow-hidden rounded-3xl border p-6 transition-all duration-300
        ${isLight 
          ? 'border-slate-200 bg-white text-slate-900 shadow-md' 
          : `text-slate-100 ${variantStyle}`}
        ${hoverEffect 
          ? isLight 
            ? 'hover:border-slate-300 hover:shadow-lg' 
            : 'hover:border-slate-700 hover:bg-[#161928] hover:shadow-[0_16px_40px_rgba(0,0,0,0.7)]' 
          : ''}
        ${className}
      `}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
