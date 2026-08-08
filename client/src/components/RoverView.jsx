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

export default function RoverView({ rover = {}, role, onSendCommand, theme = 'dark' }) {
  const [showBboxes, setShowBboxes] = useState(true);
  const [videoFilter, setVideoFilter] = useState('normal');
  const canvasRef = useRef(null);

  // Quick action restriction check
  const isReadOnly = role === 'Viewer';
  const isLight = theme === 'light';

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

      // Camera Footage Viewport background (Always dark & crisp for realistic security camera feed)
      if (videoFilter === 'infrared') {
        ctx.fillStyle = 'rgba(153, 27, 27, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.height; i += 20) {
          ctx.beginPath();
          ctx.moveTo(0, i + Math.sin(angle + i) * 3);
          ctx.lineTo(canvas.width, i + Math.sin(angle + i) * 3);
          ctx.stroke();
        }
      } else if (videoFilter === 'wireframe') {
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 30) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let j = 0; j < canvas.height; j += 30) {
          ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw stylized desk rows inside camera feed
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 80, 140, 60);
      ctx.strokeRect(220, 80, 140, 60);
      ctx.strokeRect(40, 180, 140, 60);
      ctx.strokeRect(220, 180, 140, 60);

      // Draw AI Detection Bounding Boxes
      if (showBboxes) {
        const jitter = Math.sin(angle * 4) * 1.5;

        // Candidate 1 Bounding Box (Green)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(55 + jitter, 90, 75, 45);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('STUDENT #104 [99%]', 55 + jitter, 85);

        // Candidate 2 Bounding Box (Amber)
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(235, 90 + jitter, 75, 45);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('SUSPECT POSE [88%]', 235, 85 + jitter);

        // Candidate 3 Bounding Box (Red)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(55, 190 + jitter, 75, 45);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('ALERT: PHONE RECOGNIZED', 55, 185 + jitter);
      }

      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [showBboxes, videoFilter]);

  return (
    <div className="space-y-7 sm:space-y-8 pb-8">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Rover Flight Telemetry & Remote Control
            <Cpu className="h-6 w-6 text-blue-500" />
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Real-time chassis navigation, optical pan-tilt video feed, thermal sensors, and drive commands.
          </p>
        </div>

        {/* Quick Mode Status pill */}
        <div className="flex items-center gap-3">
          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 shadow-sm ${
            rover.manualMode 
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400' 
              : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-cyan-400'
          }`}>
            <span className="h-2 w-2 rounded-full bg-current animate-ping" />
            <span>MODE: {rover.manualMode ? 'MANUAL PILOT' : 'AUTONOMOUS PATROL'}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Grid Viewport & Telemetry Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT COLUMN: Live Camera Feed Viewport (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          <GlassCard theme={theme} className="p-5 overflow-hidden">
            {/* Viewport Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Video className="h-4.5 w-4.5 text-blue-500" />
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                  OPTICAL FLIGHT CAMERA STREAM (CAM_ROV_01)
                </span>
              </div>

              {/* Viewport Filter Buttons */}
              <div className={`flex p-1 rounded-xl border text-xs shadow-inner ${
                isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-blue-900/30'
              }`}>
                <button
                  onClick={() => setVideoFilter('normal')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                    videoFilter === 'normal' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  NORMAL
                </button>
                <button
                  onClick={() => setVideoFilter('infrared')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                    videoFilter === 'infrared' 
                      ? 'bg-rose-600 text-white shadow-sm' 
                      : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  THERMAL
                </button>
                <button
                  onClick={() => setVideoFilter('wireframe')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                    videoFilter === 'wireframe' 
                      ? 'bg-cyan-600 text-white shadow-sm' 
                      : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GRID
                </button>
              </div>
            </div>

            {/* Video Viewport Container (High-tech Dark Stream Box) */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 bg-[#090d16] shadow-2xl">
              <canvas 
                ref={canvasRef} 
                width={640} 
                height={360} 
                className="w-full h-full object-cover block"
              />

              {/* Viewport Floating HUD Overlays */}
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 text-white text-[10px] font-mono shadow-md">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span>LIVE FEED</span>
                <span className="opacity-40">|</span>
                <span>1080p @ 30FPS</span>
              </div>

              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 text-white text-[10px] font-mono shadow-md">
                LATENCY: 14ms
              </div>

              {/* Bottom Control Overlay inside Video */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-white text-xs font-mono shadow-md">
                <span>PATROL AISLE: LH-302 ROW B</span>
                <button
                  onClick={() => setShowBboxes(!showBboxes)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    showBboxes ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {showBboxes ? 'AI OVERLAY: ON' : 'AI OVERLAY: OFF'}
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Drive & Pilot Commands Section */}
          <GlassCard theme={theme} className="p-6 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              <Gauge className="h-4 w-4 text-blue-500" />
              Chassis Drive & Navigation Controller
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* D-Pad Controller Container */}
              <div className={`md:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl border shadow-sm ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-blue-900/20'
              }`}>
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider mb-3.5 ${
                  isLight ? 'text-slate-800' : 'text-slate-400'
                }`}>MANUAL JOYSTICK D-PAD</span>
                
                <div className="grid grid-cols-3 gap-2.5 w-44">
                  <div />
                  <button 
                    onClick={() => onSendCommand('fwd')}
                    className={`h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 hover:border-blue-400 font-extrabold' 
                        : 'bg-slate-900 border-blue-900/30 text-white hover:border-cyan-400 hover:bg-slate-800'
                    }`}
                    title="Move Forward"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                  <div />

                  <button 
                    onClick={() => onSendCommand('left')}
                    className={`h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 hover:border-blue-400 font-extrabold' 
                        : 'bg-slate-900 border-blue-900/30 text-white hover:border-cyan-400 hover:bg-slate-800'
                    }`}
                    title="Steer Left"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => onSendCommand('stop')}
                    className="h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs transition-all cursor-pointer hover:bg-rose-500/20 shadow-sm"
                    title="Stop Drive Motors"
                  >
                    STOP
                  </button>
                  <button 
                    onClick={() => onSendCommand('right')}
                    className={`h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 hover:border-blue-400 font-extrabold' 
                        : 'bg-slate-900 border-blue-900/30 text-white hover:border-cyan-400 hover:bg-slate-800'
                    }`}
                    title="Steer Right"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>

                  <div />
                  <button 
                    onClick={() => onSendCommand('bwd')}
                    className={`h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 hover:bg-blue-50 hover:border-blue-400 font-extrabold' 
                        : 'bg-slate-900 border-blue-900/30 text-white hover:border-cyan-400 hover:bg-slate-800'
                    }`}
                    title="Move Backward"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </button>
                  <div />
                </div>
              </div>

              {/* Auxiliary Quick Commands */}
              <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onSendCommand('home')}
                    className={`p-3.5 rounded-2xl border text-left text-xs transition-all flex items-center gap-3 cursor-pointer shadow-sm ${
                      isLight 
                        ? 'bg-white border-slate-300 hover:border-blue-400 hover:bg-blue-50/50' 
                        : 'bg-slate-900 border-white/5 hover:border-blue-500/40 hover:bg-slate-800'
                    }`}
                  >
                    <Anchor className="h-5 w-5 text-blue-600" />
                    <div>
                      <span className={`block font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>Dock Station</span>
                      <span className={`block text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Auto Home Alignment</span>
                    </div>
                  </button>

                  <button
                    onClick={() => onSendCommand('stop')}
                    className={`p-3.5 rounded-2xl border text-left text-xs transition-all flex items-center gap-3 cursor-pointer shadow-sm ${
                      isLight 
                        ? 'bg-white border-slate-300 hover:border-amber-400 hover:bg-amber-50/50' 
                        : 'bg-slate-900 border-white/5 hover:border-blue-500/40 hover:bg-slate-800'
                    }`}
                  >
                    <Hand className="h-5 w-5 text-amber-500" />
                    <div>
                      <span className={`block font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>Soft Lock</span>
                      <span className={`block text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Brakes Engagement</span>
                    </div>
                  </button>
                </div>

                {/* BIG RED EMERGENCY BUTTON */}
                <button
                  onClick={() => onSendCommand('estop')}
                  className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/30 flex items-center justify-center gap-3 shadow-lg shadow-rose-600/20 active:translate-y-px transition-all font-sans cursor-pointer"
                >
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                  <div className="text-left">
                    <span className="block text-sm font-extrabold tracking-wider uppercase leading-none">EMERGENCY E-STOP</span>
                    <span className="block text-[10px] text-rose-100 mt-1">Disengages drive motors & locks magnetic chassis brakes</span>
                  </div>
                </button>
              </div>

            </div>
          </GlassCard>

        </div>

        {/* RIGHT COLUMN: Rover Telemetry Cards & Map (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* A. Vector Mini Map */}
          <GlassCard theme={theme} className="p-5">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider mb-3.5 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
              ROOM LAYOUT RADAR (LH-302)
            </h3>
            
            <div className={`relative aspect-square w-full rounded-2xl border overflow-hidden p-4 shadow-sm ${
              isLight ? 'bg-white border-slate-300' : 'bg-[#010409] border-blue-900/20'
            }`}>
              <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#0284c7_1px,transparent_1px),linear-gradient(to_bottom,#0284c7_1px,transparent_1px)] bg-[size:20px_20px]" />
              
              <div className={`absolute inset-4 rounded-xl border flex flex-col justify-between p-2 pointer-events-none ${
                isLight ? 'border-blue-400/40' : 'border-cyan-500/20'
              }`}>
                <div className="text-[9px] font-mono text-blue-600 font-extrabold uppercase">PROCTOR STATION</div>
                <div className="text-[9px] font-mono text-blue-600 font-extrabold text-right uppercase">ENTRANCE GATE</div>
              </div>

              {/* ACTIVE GLOWING BLIP FOR ROVER */}
              <div 
                className="absolute h-5 w-5 -ml-2.5 -mt-2.5 transition-all duration-1000 ease-out z-20"
                style={{ left: `${rover.posX}%`, top: `${rover.posY}%` }}
              >
                <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-50" />
                <div className="absolute inset-0.5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-lg shadow-blue-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              </div>

            </div>
            
            <div className={`mt-3.5 flex justify-between text-[11px] font-mono p-2.5 rounded-xl border ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-blue-950/20 border-blue-900/20 text-slate-400'
            }`}>
              <span>POS: (X: {rover.posX}, Y: {rover.posY})</span>
              <span className="font-bold text-blue-600 dark:text-cyan-400">FLOOR: {rover.floor}F</span>
            </div>
          </GlassCard>

          {/* B. Rover Status Card */}
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
              TELEMETRY HARDWARE STATUS
            </h3>
            
            <div className="space-y-3 text-xs">
              
              <div className={`flex items-center justify-between py-2 border-b ${isLight ? 'border-slate-200' : 'border-blue-900/20'}`}>
                <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Power reserves</span>
                <div className="flex items-center gap-1.5 font-extrabold font-mono">
                  <Battery className={`h-4 w-4 ${rover.battery < 20 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>{rover.battery}%</span>
                </div>
              </div>

              <div className={`flex items-center justify-between py-2 border-b ${isLight ? 'border-slate-200' : 'border-blue-900/20'}`}>
                <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Telemetry Link</span>
                <div className="flex items-center gap-1.5 font-extrabold font-mono text-cyan-600 dark:text-cyan-400">
                  <Signal className="h-4 w-4 text-cyan-500" />
                  <span>{rover.wifiStatus}</span>
                </div>
              </div>

              <div className={`flex items-center justify-between py-2 border-b ${isLight ? 'border-slate-200' : 'border-blue-900/20'}`}>
                <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Camera Array</span>
                <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400">ONLINE</span>
              </div>

              <div className={`flex items-center justify-between py-2 border-b ${isLight ? 'border-slate-200' : 'border-blue-900/20'}`}>
                <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Thermal CPU Temp</span>
                <div className="flex items-center gap-1.5 font-mono font-extrabold">
                  <Thermometer className="h-4 w-4 text-amber-500" />
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>{rover.temperature} °C</span>
                </div>
              </div>

              <div className={`flex items-center justify-between py-2 border-b ${isLight ? 'border-slate-200' : 'border-blue-900/20'}`}>
                <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Storage Index</span>
                <div className="flex items-center gap-1.5 font-mono font-extrabold">
                  <HardDrive className="h-4 w-4 text-blue-500" />
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>{Number(rover.storageUsed || 0).toFixed(0)} / {rover.storageTotal} GB</span>
                </div>
              </div>

              <div className={`flex items-center justify-between py-2 border-b ${isLight ? 'border-slate-200' : 'border-blue-900/20'}`}>
                <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Chassis Controller</span>
                <span className="font-extrabold font-mono text-blue-600 dark:text-cyan-400">{rover.motorStatus}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Est. Battery Life</span>
                <div className="flex items-center gap-1 font-mono font-extrabold">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>{rover.estimatedTimeRemaining} min</span>
                </div>
              </div>

            </div>
          </GlassCard>

        </div>

      </div>

    </div>
  );
}
