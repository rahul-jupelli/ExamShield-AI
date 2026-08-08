import React from 'react';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Cpu, 
  HardDrive, 
  Clock, 
  Zap, 
  ShieldAlert,
  Server,
  Database,
  Camera,
  Globe
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function HealthView({ metrics = {}, theme = 'dark' }) {
  const isLight = theme === 'light';

  const HEALTH_SERVICES = [
    { name: 'Core Express API Server', status: metrics.backend === 'online', type: 'Backend', desc: 'Port 3000 REST services & controller handles.' },
    { name: 'YOLO-v8 AI Vision Engine', status: metrics.aiModel === 'online', type: 'Inference', desc: 'Pose-estimation & smartwatch classifier pipelines.' },
    { name: 'SysRover Cam Stream HUD_SYS', status: metrics.camera === 'online', type: 'Hardware', desc: '640x360 active MJPEG over HTTP feed.' },
    { name: 'Local Database Persistence Link', status: metrics.database === 'online', type: 'Storage', desc: 'Durable in-memory records buffer.' },
  ];

  return (
    <div className="space-y-7 pb-8">
      
      {/* 1. Header Banner */}
      <div>
        <h1 className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
          System Diagnostics & Hardware Health
          <Activity className="h-6 w-6 text-blue-500" />
        </h1>
        <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Real-time surveillance cluster telemetry, CPU thermal threads, and inference pipelines state.
        </p>
      </div>

      {/* 2. Top row: Micro Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border flex-shrink-0 ${
            isLight ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-blue-600/15 border-blue-500/20 text-blue-400'
          }`}>
            <Cpu className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className={`block text-[10px] font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Average Inference</span>
            <span className={`block text-lg font-extrabold mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>{metrics.inferenceTime} ms</span>
          </div>
        </GlassCard>

        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border flex-shrink-0 ${
            isLight ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-emerald-600/15 border-emerald-500/20 text-emerald-400'
          }`}>
            <Zap className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className={`block text-[10px] font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>MODEL PIPELINE FPS</span>
            <span className={`block text-lg font-extrabold mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>{metrics.modelFps} FPS</span>
          </div>
        </GlassCard>

        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border flex-shrink-0 ${
            isLight ? 'bg-cyan-100 text-cyan-600 border-cyan-200' : 'bg-cyan-600/15 border-cyan-500/20 text-cyan-400'
          }`}>
            <HardDrive className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className={`block text-[10px] font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Local Storage</span>
            <span className={`block text-lg font-extrabold mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>{metrics.storage}% Used</span>
          </div>
        </GlassCard>

        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border flex-shrink-0 ${
            isLight ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-indigo-600/15 border-indigo-500/20 text-indigo-400'
          }`}>
            <Globe className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className={`block text-[10px] font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Telemetry Status</span>
            <span className="block text-lg font-extrabold text-emerald-500 mt-0.5">ONLINE</span>
          </div>
        </GlassCard>

      </div>

      {/* 3. Service Health Cards */}
      <GlassCard theme={theme} className="p-6 space-y-4">
        <h3 className={`text-xs font-bold font-mono uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
          Active Subsystem Operational Checks
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HEALTH_SERVICES.map((service, idx) => (
            <div 
              key={idx} 
              className={`p-4 rounded-2xl border flex items-start gap-4 transition-all shadow-sm ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-blue-900/20'
              }`}
            >
              <div className="mt-0.5">
                {service.status ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{service.name}</h4>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    isLight ? 'bg-blue-100 text-blue-800' : 'bg-blue-950 text-cyan-400'
                  }`}>
                    {service.type}
                  </span>
                </div>
                <p className={`text-[11px] mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {service.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

    </div>
  );
}
