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

export default function HealthView({ metrics = {} }) {
  
  const HEALTH_SERVICES = [
    { name: 'Core express API Server', status: metrics.backend === 'online', type: 'Backend', desc: 'Port 3000 REST services & controller handles.' },
    { name: 'YOLO-v8 AI Vision Engine', status: metrics.aiModel === 'online', type: 'Inference', desc: 'Pose-estimation & smartwatch classifier pipelines.' },
    { name: 'SysRover Cam Stream HUD_SYS', status: metrics.camera === 'online', type: 'Hardware', desc: '640x360 active MJPEG over HTTP feed.' },
    { name: 'Local JSON-db Database Link', status: metrics.database === 'online', type: 'Storage', desc: 'Durable in-memory records buffer.' },
  ];

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          System Diagnostics & Hardware Health
          <Activity className="h-5 w-5 text-blue-400" />
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Real-time surveillance cluster telemetry, CPU thermal threads, and inference pipelines state.</p>
      </div>

      {/* 2. Top row: Micro Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-blue-600/15 flex items-center justify-center border border-blue-500/20">
            <Cpu className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase">Average Inference</span>
            <span className="block text-base font-extrabold text-white mt-0.5">{metrics.inferenceTime} ms</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-600/15 flex items-center justify-center border border-emerald-500/20">
            <Zap className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase">MODEL PIPELINE FPS</span>
            <span className="block text-base font-extrabold text-white mt-0.5">{metrics.modelFps} FPS</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-purple-600/15 flex items-center justify-center border border-purple-500/20">
            <Server className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase">CONTAINER CPU INGRESS</span>
            <span className="block text-base font-extrabold text-white mt-0.5">{metrics.cpu}%</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-cyan-600/15 flex items-center justify-center border border-cyan-500/20">
            <Globe className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-slate-500 uppercase">SYS TELEM STATUS</span>
            <span className="block text-xs font-bold text-emerald-400 uppercase tracking-wide mt-0.5">EXCELLENT</span>
          </div>
        </GlassCard>

      </div>

      {/* 3. Hardware Resource Utilization Dials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Resource bars */}
        <div className="lg:col-span-7 space-y-4">
          <GlassCard className="p-5 space-y-5">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Container Core Performance Pools</h3>
            
            <div className="space-y-4">
              {/* CPU utilization */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5"><Cpu className="h-4 w-4 text-slate-500" /> Central CPU Load</span>
                  <span className="text-white font-bold">{metrics.cpu}%</span>
                </div>
                <div className="h-2 w-full bg-[#010409] border border-blue-900/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500" style={{ width: `${metrics.cpu}%` }} />
                </div>
              </div>

              {/* Memory utilization */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5"><Server className="h-4 w-4 text-slate-500" /> Memory Buffer Heap (RAM)</span>
                  <span className="text-white font-bold">{metrics.memory}%</span>
                </div>
                <div className="h-2 w-full bg-[#010409] border border-blue-900/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500" style={{ width: `${metrics.memory}%` }} />
                </div>
              </div>

              {/* GPU utilization */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5"><Zap className="h-4 w-4 text-slate-500" /> YOLO Tensor Core GPU Ingress</span>
                  <span className="text-white font-bold">{metrics.gpu}%</span>
                </div>
                <div className="h-2 w-full bg-[#010409] border border-blue-900/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-rose-500 transition-all duration-500" style={{ width: `${metrics.gpu}%` }} />
                </div>
              </div>

              {/* Storage heap */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-slate-500" /> Optical Logs Buffer (Storage)</span>
                  <span className="text-white font-bold">{metrics.storage}%</span>
                </div>
                <div className="h-2 w-full bg-[#010409] border border-blue-900/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500" style={{ width: `${metrics.storage}%` }} />
                </div>
              </div>

            </div>
          </GlassCard>
        </div>

        {/* Services Health */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Service Infrastructure Locks</h3>
            
            <div className="space-y-3">
              {HEALTH_SERVICES.map((serv, i) => (
                <div key={i} className="flex gap-3.5 p-3 rounded-xl bg-[#010409]/40 border border-blue-900/20 items-start">
                  {serv.status ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-200 truncate">{serv.name}</h4>
                      <span className="text-[8px] font-mono font-bold bg-blue-950/20 border border-blue-900/20 px-1 rounded uppercase text-slate-400">
                        {serv.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{serv.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

      </div>

    </div>
  );
}
