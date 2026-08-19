import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  ShieldAlert, 
  Tv, 
  Battery, 
  Search, 
  Clock, 
  Cpu, 
  AlertOctagon, 
  CheckCircle, 
  ChevronRight, 
  Sparkles,
  Wifi,
  Smartphone,
  TrendingUp,
  Activity,
  User
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function DashboardView({ students = [], rover = {}, alerts = [], onSelectStudent, theme = 'dark' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'devices' | 'suspicious' | 'verified'
  const isLight = theme === 'light';

  // Strict deduplication of students by hallTicket / name / id to keep original entries only
  const uniqueStudents = useMemo(() => {
    const map = new Map();
    students.forEach(s => {
      const key = (s.hallTicket || s.name || s.id || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [students]);

  // Strict deduplication of alerts
  const uniqueAlerts = useMemo(() => {
    const map = new Map();
    alerts.forEach(a => {
      const key = (a.id || (a.title + '_' + a.location)).trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, a);
      }
    });
    return Array.from(map.values());
  }, [alerts]);

  // 1. Calculate stats from deduplicated live variables
  const stats = useMemo(() => {
    const total = uniqueStudents.length;
    const verified = uniqueStudents.filter(s => s.status === 'Verified Safe').length;
    const suspicious = uniqueStudents.filter(s => s.status === 'Suspicious').length;
    const devices = uniqueStudents.filter(s => s.status === 'Device Detected').length;
    const activeAlertCount = uniqueAlerts.filter(a => a.status === 'Active' || a.status === 'Investigating').length;

    return {
      total,
      verified,
      suspicious,
      devices,
      activeAlertCount
    };
  }, [uniqueStudents, uniqueAlerts]);

  // 2. Filter deduplicated students based on search input & category tab
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return uniqueStudents.filter(s => {
      // Category filter
      if (activeCategory === 'devices' && s.status !== 'Device Detected') return false;
      if (activeCategory === 'suspicious' && s.status !== 'Suspicious') return false;
      if (activeCategory === 'verified' && s.status !== 'Verified Safe') return false;

      // Text query filter
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) || 
        s.hallTicket.toLowerCase().includes(q) || 
        s.seat.toLowerCase().includes(q) ||
        (s.detectedDevice && s.detectedDevice.toLowerCase().includes(q)) ||
        (s.suspicionReason && s.suspicionReason.toLowerCase().includes(q))
      );
    });
  }, [uniqueStudents, searchQuery, activeCategory]);

  // 3. Separate into 3 priority groups
  const { group1, group2, group3 } = useMemo(() => {
    const g1 = [];
    const g2 = [];
    const g3 = [];

    filteredStudents.forEach(s => {
      if (s.status === 'Device Detected') {
        g1.push(s);
      } else if (s.status === 'Suspicious') {
        g2.push(s);
      } else {
        g3.push(s);
      }
    });

    return { group1: g1, group2: g2, group3: g3 };
  }, [filteredStudents]);

  const CATEGORY_TABS = [
    { id: 'all', label: 'All Candidates', count: stats.total },
    { id: 'devices', label: 'Device Intercepts', count: stats.devices },
    { id: 'suspicious', label: 'Suspicious Pose', count: stats.suspicious },
    { id: 'verified', label: 'Verified Safe', count: stats.verified },
  ];

  return (
    <div className="space-y-7 sm:space-y-8 pb-8">
      
      {/* 1. HERO GRADIENT BANNER WITH FLOATING STAT CARDS (Matching Reference Theme) */}
      <div className={`relative rounded-[28px] overflow-hidden p-6 sm:p-8 transition-all shadow-2xl border ${
        isLight 
          ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 border-blue-400/30 text-white' 
          : 'bg-gradient-to-br from-[#1d4ed8] via-[#1e40af] to-[#312e81] border-blue-400/20 text-white'
      }`}>

        {/* Ambient background glow shapes */}
        <div className="pointer-events-none absolute -right-16 -top-16 w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 -bottom-20 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />

        {/* Hero Content Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] font-mono tracking-wide uppercase text-blue-100">
              <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
              <span>ExamShield AI Patrol Suite</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight font-sans">
              AI Command Center
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/80 max-w-xl">
              Real-time candidate telemetry, camera patrols, and RF spectrum tracking.
            </p>
          </div>

          {/* User Account / Location Pill */}
          <div className="flex items-center gap-3 bg-slate-950/40 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-2xl shadow-lg">
            <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center font-bold text-slate-950 text-sm shadow-md">
              <User className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <span className="block text-xs font-bold text-white leading-tight">Admin Operator</span>
              <span className="block text-[10px] font-mono text-blue-200 mt-0.5">
                PORT: 3000 · <span className="text-cyan-300 font-semibold">{rover.hall || 'LH-302'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 3 FLOATING BENTO METRIC CARDS (Embedded inside Hero Banner) */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 pt-2">
          
          {/* Card 1: Total Candidates (Lime Sparkline) */}
          <div className={`rounded-2xl p-5 border backdrop-blur-xl transition-all shadow-xl flex flex-col justify-between ${
            isLight ? 'bg-white/95 text-slate-900 border-white/40' : 'bg-[#090d16]/90 text-white border-white/15'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`block text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Total Candidates
                </span>
                <span className={`text-3xl font-extrabold mt-1 block tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {stats.total}
                </span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
            </div>

            {/* Sparkline Graphic (Lime Green Wave) */}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="text-[11px] font-mono font-medium text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+100% active in hall</span>
              </div>
              <svg className="w-24 h-9 overflow-visible" viewBox="0 0 100 35">
                <path
                  d="M 0,25 Q 25,5 50,20 T 100,8"
                  fill="none"
                  stroke="#a3e635"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 2: Device Intercepts (Cyan Sparkline) */}
          <div className={`rounded-2xl p-5 border backdrop-blur-xl transition-all shadow-xl flex flex-col justify-between ${
            isLight ? 'bg-white/95 text-slate-900 border-white/40' : 'bg-[#090d16]/90 text-white border-white/15'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`block text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Device Intercepts
                </span>
                <span className="text-3xl font-extrabold mt-1 block tracking-tight text-rose-500 dark:text-rose-400">
                  {stats.devices}
                </span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Smartphone className="h-5 w-5 text-rose-400 animate-bounce" />
              </div>
            </div>

            {/* Sparkline Graphic (Cyan Wave) */}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="text-[11px] font-mono font-medium text-rose-400 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{stats.activeAlertCount} flags requiring action</span>
              </div>
              <svg className="w-24 h-9 overflow-visible" viewBox="0 0 100 35">
                <path
                  d="M 0,20 Q 30,30 60,10 T 100,18"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 3: Verified Safe Students (Purple Sparkline) */}
          <div className={`rounded-2xl p-5 border backdrop-blur-xl transition-all shadow-xl flex flex-col justify-between ${
            isLight ? 'bg-white/95 text-slate-900 border-white/40' : 'bg-[#090d16]/90 text-white border-white/15'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`block text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Verified Safe
                </span>
                <span className="text-3xl font-extrabold mt-1 block tracking-tight text-emerald-500 dark:text-emerald-400">
                  {stats.verified}
                </span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <CheckCircle className="h-5 w-5 text-purple-400" />
              </div>
            </div>

            {/* Sparkline Graphic (Purple Wave) */}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="text-[11px] font-mono font-medium text-purple-400 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>99.4% AI Match Confidence</span>
              </div>
              <svg className="w-24 h-9 overflow-visible" viewBox="0 0 100 35">
                <path
                  d="M 0,28 Q 20,10 50,22 T 100,5"
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

        </div>
      </div>

      {/* 2. PILL NAVIGATION FILTER TABS (Matching Reference Pill Row) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className={`inline-flex items-center p-1.5 rounded-2xl border transition-all ${
          isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-[#0d121f] border-slate-800'
        }`}>
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`
                  px-4 py-2 rounded-xl text-xs font-semibold font-sans cursor-pointer transition-all duration-200 flex items-center gap-2
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 font-bold'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                `}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : isLight ? 'bg-slate-300 text-slate-700' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Rover Quick Telemetry Metric */}
        <div className={`hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-mono ${
          isLight ? 'bg-white border-slate-200 text-slate-700 shadow-sm' : 'bg-[#0d121f] border-slate-800 text-slate-300'
        }`}>
          <Cpu className="h-4 w-4 text-blue-500 animate-pulse" />
          <span>ROVER: <span className="font-bold text-emerald-400 uppercase">{rover.motorStatus}</span> ({rover.battery}%)</span>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="relative">
        <Search className={`absolute left-4 top-3.5 h-4.5 w-4.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search candidates by Name, Hall Ticket, Room, Seat, or flagged device..."
          className={`w-full border rounded-2xl py-3.5 pl-11 pr-12 text-sm focus:outline-none transition-all shadow-sm ${
            isLight
              ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              : 'bg-[#0d121f] border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
          }`}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className={`absolute right-4 top-3.5 text-xs font-medium cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            Clear
          </button>
        )}
      </div>

      {/* 4. TELEMETRY WAVE OVERVIEW SECTION (Matching Commission Overview curve in reference UI) */}
      <div className={`rounded-2xl border p-5 transition-all shadow-md ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#0d121f] border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className={`text-sm font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Activity className="h-4 w-4 text-blue-500" />
              Telemetry Overview & Live Patrol Status
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Real-time RF emission density & AI vision scanning stream history.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-mono font-bold text-blue-400">
            <span>Scan Rate: 1,420 events / min</span>
          </div>
        </div>

        {/* Interactive Wave Graph Graphic */}
        <div className="relative h-20 w-full overflow-hidden flex items-end">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 80">
            <defs>
              <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M 0,60 Q 75,20 150,45 T 300,30 T 450,50 L 500,25 L 500,80 L 0,80 Z"
              fill="url(#waveGradient)"
            />
            <path
              d="M 0,60 Q 75,20 150,45 T 300,30 T 450,50 L 500,25"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
            />
          </svg>

          {/* Hover / Highlight Tooltip Pill matching reference design */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-950 border border-blue-500/40 px-3 py-1 rounded-xl shadow-lg text-[10px] font-mono text-cyan-300 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Live Stream Active: <span className="font-bold text-white">99.4% Sync</span></span>
          </div>
        </div>
      </div>

      {/* 5. Priority Sorted Student Groups */}
      <div className="space-y-8">
        
        {/* GROUP 1: Electronic Device Detected (RED) */}
        {group1.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-rose-500 dark:text-rose-400">
                Group 1: CONFIRMED DEVIATIONS & DEVIATING DEVICES ({group1.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {group1.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className={`group relative rounded-2xl border p-5 flex gap-4 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 ${
                    isLight
                      ? 'bg-rose-50/90 border-rose-300 text-slate-900 shadow-sm hover:border-rose-400 hover:bg-rose-100/90'
                      : 'bg-[#0d121f] border-rose-500/40 text-slate-100 hover:bg-rose-950/20 shadow-[0_0_15px_rgba(244,63,94,0.08)]'
                  }`}
                >
                  <div className={`relative w-20 h-24 rounded-xl overflow-hidden border flex-shrink-0 ${
                    isLight ? 'border-rose-300 bg-slate-200' : 'border-rose-500/30 bg-slate-900'
                  }`}>
                    <img 
                      src={student.photo} 
                      alt={student.name} 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Cadet')}&background=0D8ABC&color=fff&bold=true`;
                      }}
                    />
                    <div className="absolute top-1.5 left-1.5 bg-rose-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shadow">
                      Threat
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-1.5">
                        <h3 className={`text-base font-extrabold transition-colors truncate ${
                          isLight ? 'text-slate-900 group-hover:text-rose-700' : 'text-white group-hover:text-rose-400'
                        }`}>{student.name}</h3>
                        <ChevronRight className={`h-4 w-4 transition-all flex-shrink-0 ${
                          isLight ? 'text-slate-400 group-hover:text-rose-600' : 'text-slate-500 group-hover:text-rose-400'
                        }`} />
                      </div>
                      <span className={`block text-xs font-mono mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{student.hallTicket} · {student.branch}</span>
                      
                      <div className={`mt-2 p-2 rounded-xl border ${
                        isLight
                          ? 'bg-white/90 border-rose-200 text-rose-900 shadow-sm'
                          : 'bg-rose-950/40 border-rose-800/30 text-rose-300'
                      }`}>
                        <span className="block text-xs font-semibold">
                          🚨 {student.detectedDevice}
                        </span>
                        <span className={`block text-[10px] font-mono mt-0.5 ${isLight ? 'text-rose-700' : 'text-rose-400/90'}`}>
                          Confidence: {student.detectionConfidence}% · scanned at {new Date(student.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between text-xs font-mono">
                      <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>{student.room} · {student.seat}</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-bold uppercase tracking-wider text-[9px]">
                        {student.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GROUP 2: Suspicious Activity Flags (ORANGE) */}
        {group2.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Group 2: SUSPICIOUS BEHAVIOR METRICS ({group2.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {group2.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className={`group relative rounded-2xl border p-5 flex gap-4 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 ${
                    isLight
                      ? 'bg-amber-50/90 border-amber-300 text-slate-900 shadow-sm hover:border-amber-400 hover:bg-amber-100/90'
                      : 'bg-[#0d121f] border-amber-500/30 text-slate-100 hover:bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                  }`}
                >
                  <div className={`relative w-20 h-24 rounded-xl overflow-hidden border flex-shrink-0 ${
                    isLight ? 'border-amber-300 bg-slate-200' : 'border-amber-500/20 bg-slate-900'
                  }`}>
                    <img 
                      src={student.photo} 
                      alt={student.name} 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Cadet')}&background=0D8ABC&color=fff&bold=true`;
                      }}
                    />
                    <div className="absolute top-1.5 left-1.5 bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-mono shadow">
                      FLAG: {student.suspicionScore}%
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-1.5">
                        <h3 className={`text-base font-extrabold transition-colors truncate ${
                          isLight ? 'text-slate-900 group-hover:text-amber-800' : 'text-white group-hover:text-amber-400'
                        }`}>{student.name}</h3>
                        <ChevronRight className={`h-4 w-4 transition-all flex-shrink-0 ${
                          isLight ? 'text-slate-400 group-hover:text-amber-600' : 'text-slate-500 group-hover:text-amber-400'
                        }`} />
                      </div>
                      <span className={`block text-xs font-mono mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{student.hallTicket} · {student.branch}</span>
                      
                      <p className={`mt-2 text-xs font-sans line-clamp-2 leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {student.suspicionReason}
                      </p>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between text-xs font-mono">
                      <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>{student.room} · {student.seat}</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wider text-[9px]">
                        SUSPECT POSE
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GROUP 3: Verified Safe Students (GREEN) */}
        {group3.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Group 3: VERIFIED SAFE STUDENTS & EXAM ENTRY COMPLETED ({group3.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group3.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className={`group rounded-2xl border p-4 flex gap-3.5 transition-all duration-300 cursor-pointer shadow-sm ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md'
                      : 'bg-[#0d121f] border-slate-800 hover:border-emerald-500/40 hover:bg-[#111728]'
                  }`}
                >
                  <img 
                    src={student.photo} 
                    alt={student.name} 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-white/5 grayscale group-hover:grayscale-0 transition-all bg-slate-100 dark:bg-slate-900 flex-shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Cadet')}&background=0D8ABC&color=fff&bold=true`;
                    }}
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-extrabold truncate leading-snug transition-colors ${
                        isLight ? 'text-slate-900 group-hover:text-emerald-700' : 'text-slate-200 group-hover:text-emerald-400'
                      }`}>{student.name}</h4>
                      <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    </div>
                    <span className={`block text-[10px] font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{student.hallTicket} · {student.seat}</span>
                    <div className="flex items-center justify-between mt-1 text-[9px] font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verified ({student.faceConfidence || 99}%)</span>
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Entry: Allowed</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredStudents.length === 0 && (
          <div className={`p-12 text-center rounded-2xl border border-dashed ${
            isLight ? 'bg-white border-slate-300' : 'bg-[#0d121f] border-white/10'
          }`}>
            <Search className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <h4 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>No Student Records Found</h4>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Try modifying your query or selecting another tab filter.</p>
          </div>
        )}

      </div>

    </div>
  );
}
