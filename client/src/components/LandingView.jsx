import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  ArrowRight, 
  Eye, 
  Cpu, 
  Radio, 
  Activity, 
  ChevronRight, 
  Check, 
  Maximize2, 
  Tv, 
  Lock, 
  Zap, 
  Users, 
  Smartphone,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import AuthModal from './AuthModal';

export default function LandingView({ session, onEnterDashboard, onLoginSuccess }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'

  // Mouse Parallax & Glow Tracking in Hero
  const heroRef = useRef(null);
  const canvasRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [cursorPx, setCursorPx] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
    setCursorPx({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const openAuth = (mode = 'signin') => {
    if (session) {
      onEnterDashboard();
    } else {
      setAuthMode(mode);
      setAuthModalOpen(true);
    }
  };

  // Interactive Rover Radar Canvas in Hero
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      angle += 0.015;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // 1. Subtle Radar Rings
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 140, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
      ctx.beginPath();
      ctx.arc(cx, cy, 210, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Rotating Sweeper Beam
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const sweepGradient = ctx.createConicGradient(0, 0, 0);
      sweepGradient.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
      sweepGradient.addColorStop(0.15, 'rgba(37, 99, 235, 0.05)');
      sweepGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = sweepGradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 220, 0, Math.PI * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Central Rover Chassis Schematic
      const pxOffset = (mousePos.x - 0.5) * 20;
      const pyOffset = (mousePos.y - 0.5) * 20;

      ctx.save();
      ctx.translate(cx + pxOffset, cy + pyOffset);

      // Chassis Body Base
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-60, -80, 120, 160, 24);
      ctx.fill();
      ctx.stroke();

      // Wheel Tracks
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.fillRect(-78, -70, 14, 140);
      ctx.fillRect(64, -70, 14, 140);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.strokeRect(-78, -70, 14, 140);
      ctx.strokeRect(64, -70, 14, 140);

      // Optical Camera Sensor Eye
      ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
      ctx.beginPath();
      ctx.arc(0, -35, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -35, 7, 0, Math.PI * 2);
      ctx.fill();

      // Laser Scanner Line Jitter
      const scanY = Math.sin(angle * 3) * 60;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-50, scanY);
      ctx.lineTo(50, scanY);
      ctx.stroke();

      // AI Bounding Reticle
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.7)';
      ctx.lineWidth = 1.5;
      const cornerSize = 10;
      // Top Left
      ctx.beginPath(); ctx.moveTo(-70, -90); ctx.lineTo(-70 + cornerSize, -90); ctx.moveTo(-70, -90); ctx.lineTo(-70, -90 + cornerSize); ctx.stroke();
      // Top Right
      ctx.beginPath(); ctx.moveTo(70, -90); ctx.lineTo(70 - cornerSize, -90); ctx.moveTo(70, -90); ctx.lineTo(70, -90 + cornerSize); ctx.stroke();
      // Bottom Left
      ctx.beginPath(); ctx.moveTo(-70, 90); ctx.lineTo(-70 + cornerSize, 90); ctx.moveTo(-70, 90); ctx.lineTo(-70, 90 - cornerSize); ctx.stroke();
      // Bottom Right
      ctx.beginPath(); ctx.moveTo(70, 90); ctx.lineTo(70 - cornerSize, 90); ctx.moveTo(70, 90); ctx.lineTo(70, 90 - cornerSize); ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [mousePos]);

  return (
    <div className="min-h-screen bg-[#070a16] text-slate-100 font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      
      {/* Royal Ambient Radial Light Source Overlays */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.22),transparent_60%)] z-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(37,99,235,0.32),transparent_70%)] z-0" />

      {/* 1. MINIMAL FLOATING HEADER */}
      <header className="fixed top-4 inset-x-4 max-w-6xl mx-auto z-50">
        <div className="backdrop-blur-xl bg-[#070a16]/80 border border-slate-800/90 rounded-full px-6 py-3 flex items-center justify-between shadow-2xl">
          
          {/* Left Logo */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-extrabold text-white tracking-tight">ExamShield AI</span>
          </div>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#technology" className="hover:text-white transition-colors">Technology</a>
            <a href="#rover" className="hover:text-white transition-colors">Rover</a>
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-3">
            {session ? (
              <button
                onClick={onEnterDashboard}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_4px_16px_rgba(37,99,235,0.4)]"
              >
                <span>Command Center</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => openAuth('signin')}
                  className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuth('signup')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_4px_16px_rgba(37,99,235,0.4)]"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section 
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative min-h-[92vh] pt-32 pb-16 px-6 max-w-6xl mx-auto flex flex-col justify-center relative z-10"
      >
        {/* Mouse Cursor Interactive Lighting Glow */}
        <div 
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[130px] transition-all duration-300 ease-out"
          style={{ left: `${cursorPx.x}px`, top: `${cursorPx.y}px` }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* ApiFlow-style Pill Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300 text-xs font-medium shadow-md">
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.9)] animate-pulse" />
              <span>AI-Powered Autonomous Examination Security</span>
            </div>

            {/* ApiFlow-style Gradient Headline */}
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.08]">
              Security that thinks <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                beyond the camera.
              </span>
            </h1>

            <p className="text-slate-400 text-lg sm:text-xl font-normal max-w-xl leading-relaxed">
              Access real-time AI vision patrols, thermal scanning, and RF spectrum surveillance to protect academic integrity effortlessly.
            </p>

            {/* ApiFlow-style Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center gap-4">
              <a
                href="#technology"
                className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm px-7 py-3.5 rounded-full shadow-[0_4px_25px_rgba(37,99,235,0.45)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Explore Platform</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <button
                onClick={() => session ? onEnterDashboard() : openAuth('signin')}
                className="bg-white text-slate-900 hover:bg-slate-100 font-semibold text-sm px-7 py-3.5 rounded-full shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Enter Command Center</span>
              </button>
            </div>
          </div>

          {/* Hero Right Column: Rover Visual + Integrated Telemetry */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            
            {/* Interactive Canvas */}
            <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">
              <canvas 
                ref={canvasRef} 
                width={480} 
                height={480} 
                className="w-full h-full object-contain"
              />

              {/* Integrated Floating Telemetry Cards */}
              
              {/* Telemetry Tag 1: Rover Status (Top Left) */}
              <div className="absolute top-6 left-4 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-2.5 shadow-lg">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-white uppercase">ROVER 01</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">ONLINE</span>
              </div>

              {/* Telemetry Tag 2: AI Vision Confidence (Top Right) */}
              <div className="absolute top-16 right-4 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-mono shadow-lg">
                <span className="block text-[10px] text-slate-500 uppercase">AI VISION</span>
                <span className="block text-sm font-bold text-cyan-400">98.4%</span>
              </div>

              {/* Telemetry Tag 3: Patrol Mode (Bottom Right) */}
              <div className="absolute bottom-8 right-6 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg">
                <span className="text-[10px] text-slate-400">PATROL</span>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase">ACTIVE</span>
              </div>

            </div>

          </div>

        </div>

        {/* ApiFlow-style Floating Feature Icons Row */}
        <div className="pt-16 max-w-5xl mx-auto flex items-center justify-center gap-3 sm:gap-6 flex-wrap relative z-20">
          {[
            { icon: Eye, label: "Vision AI" },
            { icon: Cpu, label: "Edge Inference" },
            { icon: Shield, label: "Encrypted Control" },
            { icon: Radio, label: "RF Spectrum Scan" },
            { icon: Lock, label: "Auth Portal" },
            { icon: Activity, label: "Live Telemetry" },
            { icon: Zap, label: "Zero-Latency" },
            { icon: Smartphone, label: "Device Signal AI" }
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div 
                key={index} 
                title={item.label}
                className="h-13 w-13 sm:h-16 sm:w-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-blue-400 shadow-xl backdrop-blur-md hover:border-blue-500/50 hover:bg-slate-900 hover:scale-110 transition-all duration-300 cursor-pointer group"
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 group-hover:text-cyan-300 transition-colors" />
              </div>
            );
          })}
        </div>

      </section>

      {/* 3. ONE SIMPLE PRODUCT SECTION (HOW IT WORKS) */}
      <section id="technology" className="py-24 px-6 border-t border-slate-900 bg-[#070b16]">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <span className="text-[10px] font-mono tracking-widest text-blue-400 uppercase">HOW IT WORKS</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              See. Understand. Respond.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1: SEE */}
            <div className="flex flex-col items-center text-center space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 transition-all hover:border-slate-700">
              <div className="h-12 w-12 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                <Eye className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-wider font-mono uppercase">SEE</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Computer vision detects anomalies.
              </p>
            </div>

            {/* Step 2: UNDERSTAND */}
            <div className="flex flex-col items-center text-center space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 transition-all hover:border-slate-700">
              <div className="h-12 w-12 rounded-2xl bg-cyan-600/15 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-wider font-mono uppercase">UNDERSTAND</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                AI analyzes behavior and signals.
              </p>
            </div>

            {/* Step 3: RESPOND */}
            <div className="flex flex-col items-center text-center space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 transition-all hover:border-slate-700">
              <div className="h-12 w-12 rounded-2xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-wider font-mono uppercase">RESPOND</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Operators receive real-time alerts.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. ROVER SECTION */}
      <section id="rover" className="py-24 px-6 border-t border-slate-900 bg-[#060913]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Chassis Visual */}
          <div className="lg:col-span-6 relative">
            <div className="aspect-square w-full max-w-[440px] mx-auto rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden relative flex flex-col justify-between p-6">
              
              {/* Header HUD */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">CHASSIS_ID: ROV-01</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  OPTICAL ACTIVE
                </span>
              </div>

              {/* Center HUD reticle */}
              <div className="relative h-48 w-full flex items-center justify-center">
                <div className="absolute inset-0 border border-blue-500/20 rounded-2xl flex items-center justify-center">
                  <div className="h-24 w-24 border border-cyan-400/40 rounded-full animate-pulse flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                </div>
              </div>

              {/* Bottom HUD info */}
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-3 border-t border-slate-800">
                <span>BATTERY: 88%</span>
                <span>PAN-TILT: 1080p HUD</span>
              </div>

            </div>
          </div>

          {/* Right Column: Copy */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-[10px] font-mono tracking-widest text-blue-400 uppercase">AUTONOMOUS PATROL</span>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Security that moves.
            </h2>

            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              ExamShield brings autonomous monitoring into the examination hall with live camera intelligence and real-time rover telemetry.
            </p>

            <div className="space-y-3 pt-2">
              {[
                "Autonomous Patrol",
                "Live Vision",
                "Real-Time Telemetry",
                "Operator Control"
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm font-medium text-slate-200 font-mono">
                  <div className="h-5 w-5 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* 5. COMMAND CENTER PREVIEW SECTION */}
      <section id="platform" className="py-24 px-6 border-t border-slate-900 bg-[#070b16] text-center">
        <div className="max-w-6xl mx-auto space-y-10">
          
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              One command center. Complete visibility.
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              A real-time command dashboard engineered for complete situational awareness and instant incident response.
            </p>
          </div>

          {/* Tilted Browser Mockup Container */}
          <div className="group relative max-w-4xl mx-auto [perspective:1000px] cursor-pointer" onClick={() => session ? onEnterDashboard() : openAuth('signin')}>
            <div className="transform rotate-x-6 -rotate-y-2 transition-transform duration-500 ease-out group-hover:rotate-x-0 group-hover:rotate-y-0 group-hover:scale-[1.02] rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden text-left p-4 sm:p-6 space-y-4">
              
              {/* Browser Mockup Top Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-mono text-slate-500">examshield-ai.edu/dashboard</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>CONNECTED</span>
                </div>
              </div>

              {/* Mockup Inner Body Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Mock Card 1 */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>Candidates</span>
                    <Users className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-2xl font-bold text-white block">158</span>
                  <span className="text-[10px] text-blue-400 font-mono block">142 verified safe</span>
                </div>

                {/* Mock Card 2 */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>Active Devices</span>
                    <Smartphone className="h-4 w-4 text-rose-500" />
                  </div>
                  <span className="text-2xl font-bold text-rose-500 block">4 Confirmed</span>
                  <span className="text-[10px] text-rose-400 font-mono block">Critical threat</span>
                </div>

                {/* Mock Card 3 */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>Patrol Chassis</span>
                    <Cpu className="h-4 w-4 text-cyan-400" />
                  </div>
                  <span className="text-2xl font-bold text-white block">Active</span>
                  <span className="text-[10px] text-emerald-400 font-mono block">88% battery</span>
                </div>

              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">INCIDENT LOG: Smartwatch signal detected at Seat B-4</span>
                <span className="text-rose-400 font-bold">CRITICAL</span>
              </div>

            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => session ? onEnterDashboard() : openAuth('signin')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Open Command Center</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="py-28 px-6 border-t border-slate-900 bg-[#060913] text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight">
            Make every examination smarter.
          </h2>

          <p className="text-slate-400 text-lg">
            Enter the ExamShield command center.
          </p>

          <div className="pt-2">
            <button
              onClick={() => session ? onEnterDashboard() : openAuth('signup')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-8 py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="py-8 px-6 border-t border-slate-900 bg-[#040710] text-xs font-mono text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <span className="font-bold text-white">ExamShield AI</span>
            <span className="text-slate-600">·</span>
            <span>AI-powered examination security</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#technology" className="hover:text-white transition-colors">Technology</a>
            <a href="#rover" className="hover:text-white transition-colors">Contact</a>
            <span>© 2026 ExamShield AI</span>
          </div>
        </div>
      </footer>

      {/* AUTHENTICATION FLOATING MODAL */}
      {authModalOpen && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthModalOpen(false)}
          onLoginSuccess={(user) => {
            if (onLoginSuccess) onLoginSuccess(user);
            setAuthModalOpen(false);
            if (onEnterDashboard) onEnterDashboard();
          }}
        />
      )}

    </div>
  );
}
