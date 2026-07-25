import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  Battery, 
  Gauge, 
  Compass, 
  MapPin, 
  Signal, 
  Video, 
  Thermometer, 
  Cpu, 
  HardDrive, 
  RotateCw, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Play,
  Square,
  Zap,
  Radio,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Hand,
  Anchor
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function RoverView({ rover = {}, role, onSendCommand }) {
  const [showBboxes, setShowBboxes] = useState(true);
  const [videoFilter, setVideoFilter] = useState('normal');
  const canvasRef = useRef(null);

  // Quick action restriction check
  const isReadOnly = role === 'Viewer';

  const roverRef = useRef(rover);
  useEffect(() => {
    roverRef.current = rover;
  }, [rover]);

  // Live Canvas drawing loop to overlay fake AI tracking boxes with high-performance animations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      angle += 0.02;

      // 1. Draw Simulated Camera Footage background grid/graphics
      if (videoFilter === 'infrared') {
        ctx.fillStyle = 'rgba(153, 27, 27, 0.15)'; // Red infrared tint
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Heat ripples
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.height; i += 20) {
          ctx.beginPath();
          ctx.moveTo(0, i + Math.sin(angle + i) * 3);
          ctx.lineTo(canvas.width, i + Math.sin(angle + i) * 3);
          ctx.stroke();
        }
      } else if (videoFilter === 'wireframe') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Deep tech void
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid pattern
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 30) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let j = 0; j < canvas.height; j += 30) {
          ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'; // Clean slate
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw stylized desk rows
      ctx.strokeStyle = videoFilter === 'wireframe' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 80, 140, 60); // Row A desk
      ctx.strokeRect(220, 80, 140, 60); // Row B desk
      ctx.strokeRect(40, 180, 140, 60); // Row C desk
      ctx.strokeRect(220, 180, 140, 60); // Row D desk

      // 2. Draw AI Detection Bounding Boxes
      if (showBboxes) {
        const jitter = Math.sin(angle * 4) * 1.5;

        // Bbox 1: Highlighted student head/pose (Suspicious)
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)'; // Orange
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        const box1 = { x: 70 + jitter, y: 90, w: 80, h: 45 };
        ctx.strokeRect(box1.x, box1.y, box1.w, box1.h);
        
        // Corners
        ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.fillRect(box1.x - 2, box1.y - 2, 8, 8);
        ctx.fillRect(box1.x + box1.w - 6, box1.y - 2, 8, 8);
        
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('FLAGGED POSE: GAZE-DEVIATED (82%)', box1.x, box1.y - 6);

        // Bbox 2: Smartwatch detected on desk (Device Critical)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // Red
        ctx.lineWidth = 2.5;
        const box2 = { x: 260 + Math.cos(angle * 2) * 1, y: 195, w: 65, h: 35 };
        ctx.strokeRect(box2.x, box2.y, box2.w, box2.h);
        
        // Corners
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.fillRect(box2.x - 2, box2.y - 2, 8, 8);
        ctx.fillRect(box2.x + box2.w - 6, box2.y - 2, 8, 8);
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('ANOMALY: SMART WATCH (98.6%)', box2.x, box2.y - 6);

        // Bbox 3: Cleared student (Green)
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'; // Green
        ctx.lineWidth = 1.5;
        const box3 = { x: 100, y: 195, w: 70, h: 40 };
        ctx.strokeRect(box3.x, box3.y, box3.w, box3.h);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('FACEMATCH: APPROVED (99.8%)', box3.x, box3.y - 6);
      }

      // 3. Draw Scan overlay bar
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
      ctx.lineWidth = 2;
      const scanY = (canvas.height / 2) + Math.sin(angle) * (canvas.height / 2 - 10);
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(canvas.width, scanY);
      ctx.stroke();

      // Laser dot on the side
      ctx.fillStyle = 'rgba(14, 165, 233, 0.8)';
      ctx.beginPath();
      ctx.arc(10, scanY, 4, 0, Math.PI * 2);
      ctx.fill();

      // HUD Telemetry overlay text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px monospace';
      ctx.fillText(`IRIS FOCUS: AUTO`, 20, 20);
      ctx.fillText(`SENS-FREQ: 2.45GHz`, 20, 35);
      ctx.fillText(`COMP: ${showBboxes ? 'AI-ON' : 'AI-MUTED'}`, 20, 50);

      // Frame time stamp
      const currentBatt = roverRef.current ? roverRef.current.battery : 88;
      const dateStr = new Date().toLocaleTimeString();
      ctx.fillText(`FRAME_T: ${dateStr}`, canvas.width - 130, 20);
      ctx.fillText(`BATTERY_V: ${(3.7 + (currentBatt / 100) * 0.5).toFixed(2)}V`, canvas.width - 130, 35);

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [showBboxes, videoFilter]);

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-sans flex items-center gap-2">
            Surveillance & Drone Control
            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${rover.manualMode ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {rover.manualMode ? 'MANUAL STEERING ACTIVE' : 'AUTONOMOUS PATROL'}
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Control rover movement parameters and adjust camera optics triggers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Large Live Feed & Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* A. Large Video Box */}
          <GlassCard className="p-0 overflow-hidden border-blue-500/20">
            {/* Top Toolbar */}
            <div className="px-5 py-3.5 border-b border-blue-900/30 bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider">HUD_SYS_1: CH302_STREAM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setShowBboxes(!showBboxes)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${showBboxes ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-slate-950 border-white/10 text-slate-500'}`}
                >
                  AI HUD: {showBboxes ? 'SHOW' : 'HIDE'}
                </button>
                <div className="flex bg-[#010409] p-0.5 rounded-lg border border-blue-900/30">
                  {['normal', 'infrared', 'wireframe'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setVideoFilter(mode)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono capitalize transition-all cursor-pointer ${videoFilter === mode ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-video bg-slate-950 w-full overflow-hidden">
              <canvas 
                ref={canvasRef} 
                width={640} 
                height={360} 
                className="w-full h-full object-cover block"
              />
              
              {/* Custom Bounding box graphics details overlays */}
              <div className="absolute top-4 right-4 p-2 rounded bg-black/75 border border-blue-900/30 text-[9px] font-mono text-slate-300 space-y-1">
                <div className="flex justify-between gap-4"><span>COORDS:</span> <span className="text-white">X:{rover.posX} Y:{rover.posY}</span></div>
                <div className="flex justify-between gap-4"><span>SPEED:</span> <span className="text-cyan-400">{rover.speed} m/s</span></div>
                <div className="flex justify-between gap-4"><span>SYS_FPS:</span> <span className="text-emerald-400">29.8 FPS</span></div>
              </div>

              {/* Bottom HUD Bar */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-slate-400 bg-black/60 p-2 rounded border border-blue-900/20 backdrop-blur-sm">
                <span>SECTOR: 3RD FLOOR LOBBY TO LH-302</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  MOTOR_STABILITY_LOCK: ACTIVE
                </span>
              </div>
            </div>
          </GlassCard>

          {/* B. Movement Controls Panel */}
          <GlassCard className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-cyan-400" />
                  Manual Rover Steering Overrides
                </h3>
                <p className="text-xs text-slate-400">Toggle manual mode to directly command the motor driving systems.</p>
              </div>

              {/* Manual mode Switch */}
              <button
                disabled={isReadOnly}
                onClick={() => onSendCommand(rover.manualMode ? 'manual_toggle_off' : 'manual_toggle_on')}
                className={`
                  px-4 py-2 rounded-xl text-xs font-bold font-mono border transition-all flex items-center gap-2 cursor-pointer
                  ${isReadOnly ? 'opacity-40 cursor-not-allowed' : ''}
                  ${rover.manualMode 
                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-300' 
                    : 'bg-[#010409] border-blue-900/30 text-slate-400 hover:text-white'}
                `}
              >
                <Radio className={`h-3.5 w-3.5 ${rover.manualMode ? 'animate-pulse' : ''}`} />
                {rover.manualMode ? 'DISABLE MANUAL CONTROL' : 'ACTIVATE MANUAL MODE'}
              </button>
            </div>

            {isReadOnly && (
              <div className="p-2.5 mb-4 text-center rounded-lg bg-blue-950/20 border border-blue-900/20 text-[11px] text-slate-500 font-mono">
                🛑 Viewer role has read-only permission. Steering controls locked.
              </div>
            )}

            {/* Stepper controls Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 ${(!rover.manualMode || isReadOnly) ? 'opacity-40 pointer-events-none' : ''}`}>
              
              {/* Directional Pad */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-[#010409]/40 border border-blue-900/20">
                <div className="grid grid-cols-3 gap-2 w-44">
                  <div />
                  <button 
                    onClick={() => onSendCommand('fwd')}
                    className="h-12 rounded-xl bg-slate-900 border border-blue-900/20 hover:border-blue-500/50 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer"
                    title="Move Forward"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                  <div />

                  <button 
                    onClick={() => onSendCommand('left')}
                    className="h-12 rounded-xl bg-slate-900 border border-blue-900/20 hover:border-blue-500/50 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer"
                    title="Steer Left"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => onSendCommand('stop')}
                    className="h-12 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-xs transition-all cursor-pointer"
                    title="Stop Drive Motors"
                  >
                    STOP
                  </button>
                  <button 
                    onClick={() => onSendCommand('right')}
                    className="h-12 rounded-xl bg-slate-900 border border-blue-900/20 hover:border-blue-500/50 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer"
                    title="Steer Right"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>

                  <div />
                  <button 
                    onClick={() => onSendCommand('bwd')}
                    className="h-12 rounded-xl bg-slate-900 border border-blue-900/20 hover:border-blue-500/50 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer"
                    title="Move Backward"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </button>
                  <div />
                </div>
              </div>

              {/* Auxiliary Quick Commands */}
              <div className="md:col-span-7 flex flex-col justify-between space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onSendCommand('home')}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-blue-500/40 text-left text-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Anchor className="h-4 w-4 text-cyan-400" />
                    <div>
                      <span className="block font-bold text-white">Dock Station</span>
                      <span className="block text-[9px] text-slate-500">Auto Home Alignment</span>
                    </div>
                  </button>

                  <button
                    onClick={() => onSendCommand('stop')}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-blue-500/40 text-left text-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Hand className="h-4 w-4 text-amber-400" />
                    <div>
                      <span className="block font-bold text-white">Soft Lock</span>
                      <span className="block text-[9px] text-slate-500">Brakes Engagement</span>
                    </div>
                  </button>
                </div>

                {/* BIG RED EMERGENCY BUTTON */}
                <button
                  onClick={() => onSendCommand('estop')}
                  className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/30 flex items-center justify-center gap-3 shadow-lg shadow-rose-950/25 active:translate-y-px transition-all font-sans cursor-pointer"
                >
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                  <div className="text-left">
                    <span className="block text-sm font-extrabold tracking-wider uppercase leading-none">EMERGENCY HARDFILE E-STOP</span>
                    <span className="block text-[10px] text-rose-200 mt-1">Disengages drive motors & locks magnetic chassis brakes</span>
                  </div>
                </button>
              </div>

            </div>
          </GlassCard>

        </div>

        {/* RIGHT COLUMN: Rover Telemetry Cards & Map (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* A. Vector Mini Map */}
          <GlassCard className="p-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-3">ROOM LAYOUT RADAR (LH-302)</h3>
            
            <div className="relative aspect-square w-full rounded-xl bg-[#010409] border border-blue-900/20 overflow-hidden p-4">
              {/* Mock Classroom Layout Grid Drawing */}
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#0284c7_1px,transparent_1px),linear-gradient(to_bottom,#0284c7_1px,transparent_1px)] bg-[size:20px_20px]" />
              
              {/* Outline walls */}
              <div className="absolute inset-4 rounded border border-cyan-500/20 flex flex-col justify-between p-2 pointer-events-none">
                <div className="text-[8px] font-mono text-cyan-600/60 uppercase">PROCTOR STATION</div>
                <div className="text-[8px] font-mono text-cyan-600/60 text-right uppercase">ENTRANCE GATE</div>
              </div>

              {/* Rows Representation (Desk blocks) */}
              <div className="absolute inset-x-8 top-12 bottom-12 grid grid-cols-3 gap-3 opacity-30 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="rounded border border-white/15 bg-slate-900/40 flex items-center justify-center text-[8px] font-mono text-slate-500">
                    Desk {String.fromCharCode(65 + Math.floor(i/3))}-{i%3+1}
                  </div>
                ))}
              </div>

              {/* Charging Dock */}
              <div className="absolute bottom-6 left-6 h-6 w-6 rounded border border-amber-500/40 bg-amber-950/20 flex items-center justify-center pointer-events-none">
                <Zap className="h-3 w-3 text-amber-400" />
              </div>

              {/* ACTIVE GLOWING BLIP FOR ROVER */}
              <div 
                className="absolute h-5 w-5 -ml-2.5 -mt-2.5 transition-all duration-1000 ease-out"
                style={{ left: `${rover.posX}%`, top: `${rover.posY}%` }}
              >
                <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-40" />
                <div className="absolute inset-0.5 rounded-full bg-blue-400 border border-white flex items-center justify-center shadow-lg shadow-blue-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
                
                {/* Micro Label */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-slate-900/90 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-mono text-white whitespace-nowrap shadow">
                  ROV_01
                </div>
              </div>

            </div>
            
            <div className="mt-3 flex justify-between text-[10px] font-mono text-slate-500 bg-blue-950/20 border border-blue-900/10 p-2 rounded">
              <span>POSITION CORNER: (X: {rover.posX}, Y: {rover.posY})</span>
              <span>FLOOR: {rover.floor}F</span>
            </div>
          </GlassCard>

          {/* B. Rover Status Card */}
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">TELEM_STREAM_LOCK</h3>
            
            <div className="space-y-2.5 text-xs">
              
              <div className="flex items-center justify-between py-1.5 border-b border-blue-900/20">
                <span className="text-slate-400 font-sans">Power reserves</span>
                <div className="flex items-center gap-1.5 font-bold font-mono text-white">
                  <Battery className={`h-4 w-4 ${rover.battery < 20 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
                  <span>{rover.battery}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-blue-900/20">
                <span className="text-slate-400 font-sans">Telemetry Link</span>
                <div className="flex items-center gap-1.5 font-bold font-mono text-cyan-400">
                  <Signal className="h-4 w-4 text-cyan-400" />
                  <span>{rover.wifiStatus}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-blue-900/20">
                <span className="text-slate-400 font-sans">Camera Array</span>
                <span className="font-bold font-mono text-emerald-400">ONLINE</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-blue-900/20">
                <span className="text-slate-400 font-sans">Thermal CPU Temp</span>
                <div className="flex items-center gap-1.5 font-mono text-white font-bold">
                  <Thermometer className="h-4 w-4 text-amber-400" />
                  <span>{rover.temperature} °C</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-blue-900/20">
                <span className="text-slate-400 font-sans">Storage Index</span>
                <div className="flex items-center gap-1.5 font-mono text-white font-bold">
                  <HardDrive className="h-4 w-4 text-blue-400" />
                  <span>{Number(rover.storageUsed || 0).toFixed(0)} / {rover.storageTotal} GB</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-blue-900/20">
                <span className="text-slate-400 font-sans">Chassis Controller</span>
                <span className="font-bold font-mono text-cyan-400">{rover.motorStatus}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400 font-sans">Est. Battery Life</span>
                <div className="flex items-center gap-1 font-mono text-white font-bold">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span>{rover.estimatedTimeRemaining} min</span>
                </div>
              </div>

            </div>
          </GlassCard>

        </div>

      </div>

    </div>
  );
}
