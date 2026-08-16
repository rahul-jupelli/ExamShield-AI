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
  Smartphone
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function DashboardView({ students = [], rover = {}, alerts = [], onSelectStudent, theme = 'dark' }) {
  const [searchQuery, setSearchQuery] = useState('');
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

  // 2. Filter deduplicated students based on search input
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return uniqueStudents;
    return uniqueStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.hallTicket.toLowerCase().includes(q) || 
      s.seat.toLowerCase().includes(q) ||
      (s.detectedDevice && s.detectedDevice.toLowerCase().includes(q)) ||
      (s.suspicionReason && s.suspicionReason.toLowerCase().includes(q))
    );
  }, [uniqueStudents, searchQuery]);

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

  return (
    <div className="space-y-7 sm:space-y-8 pb-8">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 font-sans ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Live AI Patrol Terminal
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse inline-block" />
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Active camera scan & RF emission surveillance system online.
          </p>
        </div>
        <div className={`text-right text-xs font-mono px-3 py-1.5 rounded-xl border ${
          isLight ? 'bg-white border-slate-200 text-slate-600 shadow-sm' : 'bg-slate-900/80 border-slate-800 text-slate-300'
        }`}>
          <span className="font-semibold">PORT: 3000</span>
          <span className="mx-2 opacity-40">|</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{rover.hall}</span>
        </div>
      </div>

      {/* 2. Top Bento-Stats Row with Perfect Gaps */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        
        {/* Stat 1: Total & Verified */}
        <GlassCard theme={theme} className="p-5 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>All Students</span>
            <Users className={`h-4.5 w-4.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          </div>
          <div className="mt-3">
            <span className={`text-3xl font-extrabold leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>{stats.total}</span>
            <div className={`text-xs mt-1.5 flex items-center gap-1.5 font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <span className={`font-bold ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>{stats.verified}</span> verified cleared
            </div>
          </div>
        </GlassCard>

        {/* Stat 2: Active Infractions (Red) */}
        <GlassCard 
          theme={theme} 
          className={`p-5 flex flex-col justify-between border transition-all ${
            isLight 
              ? 'bg-rose-50/80 border-rose-200 text-rose-900 shadow-sm hover:border-rose-300' 
              : 'border-rose-500/30 bg-rose-950/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>Active Devices</span>
            <Smartphone className="h-4.5 w-4.5 text-rose-500 animate-bounce" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-500 leading-none">{stats.devices}</span>
            <div className={`text-xs mt-1.5 font-medium ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
              Critical security threat
            </div>
          </div>
        </GlassCard>

        {/* Stat 3: Suspicion Flags (Orange) */}
        <GlassCard 
          theme={theme} 
          className={`p-5 flex flex-col justify-between border transition-all ${
            isLight 
              ? 'bg-amber-50/80 border-amber-200 text-amber-900 shadow-sm hover:border-amber-300' 
              : 'border-amber-500/30 bg-amber-950/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>Suspicious Pose</span>
            <ShieldAlert className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-amber-500 leading-none">{stats.suspicious}</span>
            <div className={`text-xs mt-1.5 font-medium ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
              Verification pending
            </div>
          </div>
        </GlassCard>

        {/* Stat 4: Rover Status */}
        <GlassCard theme={theme} className="p-5 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Patrol Rover</span>
            <Cpu className={`h-4.5 w-4.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-extrabold uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>{rover.motorStatus}</span>
              <span className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>({rover.battery}%)</span>
            </div>
            <div className={`text-xs mt-1.5 font-mono flex items-center gap-1.5 font-semibold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              {rover.currentMission}
            </div>
          </div>
        </GlassCard>

        {/* Stat 5: Active Alerts log */}
        <GlassCard 
          theme={theme} 
          className={`p-5 col-span-2 md:col-span-1 flex flex-col justify-between border transition-all ${
            isLight 
              ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-sm hover:border-blue-300' 
              : 'border-blue-500/30 bg-blue-950/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-blue-800' : 'text-blue-400'}`}>Threat Stream</span>
            <AlertOctagon className={`h-4.5 w-4.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
          </div>
          <div className="mt-3">
            <span className={`text-3xl font-extrabold leading-none ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>{stats.activeAlertCount}</span>
            <div className={`text-xs mt-1.5 font-medium ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>
              Unresolved flags in log
            </div>
          </div>
        </GlassCard>

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
              : 'bg-[#141622] border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
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

      {/* 4. Priority Sorted Student Groups */}
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
                      : 'bg-rose-950/20 border-rose-500/40 text-slate-100 hover:bg-rose-950/30 shadow-[0_0_15px_rgba(244,63,94,0.08)]'
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
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
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
                      : 'bg-amber-950/20 border-amber-500/30 text-slate-100 hover:bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
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
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
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
                      : 'bg-slate-900/40 border-blue-900/20 hover:border-emerald-500/40 hover:bg-slate-900/60'
                  }`}
                >
                  <img 
                    src={student.photo} 
                    alt={student.name} 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-white/5 grayscale group-hover:grayscale-0 transition-all bg-slate-100 dark:bg-slate-900 flex-shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
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
            isLight ? 'bg-white border-slate-300' : 'bg-slate-950/20 border-white/10'
          }`}>
            <Search className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <h4 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>No Student Records Found</h4>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Try modifying your query or filter term.</p>
          </div>
        )}

      </div>

    </div>
  );
}
