import React from 'react';
import { Clock, ShieldCheck, Cpu, CheckCircle2, Ban } from 'lucide-react';

const STATUS_CONFIG = {
  scheduled: {
    label: 'Scheduled',
    icon: Clock,
    badgeClass: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    lightBadgeClass: 'bg-blue-50 border-blue-200 text-blue-700',
    dotClass: 'bg-blue-400',
  },
  verification: {
    label: 'Verification Phase',
    icon: ShieldCheck,
    badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    lightBadgeClass: 'bg-amber-50 border-amber-200 text-amber-700',
    dotClass: 'bg-amber-400 animate-ping',
  },
  device_detection: {
    label: 'Active Device Detection',
    icon: Cpu,
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    lightBadgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    dotClass: 'bg-emerald-400 animate-pulse',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
    lightBadgeClass: 'bg-slate-100 border-slate-300 text-slate-700',
    dotClass: 'bg-slate-400',
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    badgeClass: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    lightBadgeClass: 'bg-rose-50 border-rose-200 text-rose-700',
    dotClass: 'bg-rose-400',
  },
};

export default function ExamStatusBadge({ status = 'scheduled', theme = 'dark', size = 'md' }) {
  const isLight = theme === 'light';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2',
    lg: 'text-sm px-3.5 py-1.5 gap-2.5',
  }[size] || 'text-xs px-2.5 py-1 gap-2';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border transition-all ${
        isLight ? config.lightBadgeClass : config.badgeClass
      } ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span className="tracking-wide uppercase">{config.label}</span>
    </span>
  );
}
