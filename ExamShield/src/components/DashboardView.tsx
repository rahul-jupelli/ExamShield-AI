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
import { Student, RoverStatus, LiveAlert } from '../types';
import GlassCard from './GlassCard';

interface DashboardViewProps {
  students: Student[];
  rover: RoverStatus;
  alerts: LiveAlert[];
  onSelectStudent: (student: Student) => void;
}

export default function DashboardView({ students, rover, alerts, onSelectStudent }: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculate stats from live variables
  const stats = useMemo(() => {
    const total = students.length;
    const verified = students.filter(s => s.status === 'Verified Safe').length;
    const suspicious = students.filter(s => s.status === 'Suspicious').length;
    const devices = students.filter(s => s.status === 'Device Detected').length;
    const activeAlertCount = alerts.filter(a => a.status === 'Active' || a.status === 'Investigating').length;

    return {
      total,
      verified,
      suspicious,
      devices,
      activeAlertCount
    };
  }, [students, alerts]);

  // 2. Filter students based on search input
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.hallTicket.toLowerCase().includes(q) || 
      s.seat.toLowerCase().includes(q) ||
      (s.detectedDevice && s.detectedDevice.toLowerCase().includes(q)) ||
      (s.suspicionReason && s.suspicionReason.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  // 3. Separate into 3 priority groups
  const { group1, group2, group3 } = useMemo(() => {
    const g1: Student[] = [];
    const g2: Student[] = [];
    const g3: Student[] = [];

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
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2 font-sans">
            Live AI Patrol Terminal
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse inline-block" />
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Active camera scan & RF emission surveillance system online.</p>
        </div>
        <div className="text-right text-xs font-mono text-slate-500">
          <span>OPERATIONAL PORT: 3000</span>
          <span className="mx-2">|</span>
          <span>LOCATION: {rover.hall}</span>
        </div>
      </div>

      {/* 2. Top Bento-Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* Stat 1: Total & Verified */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-medium uppercase">All Students</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-extrabold text-white leading-none">{stats.total}</span>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="text-cyan-400 font-bold">{stats.verified}</span> verified cleared
            </div>
          </div>
        </GlassCard>

        {/* Stat 2: Active Infractions (Red) */}
        <GlassCard className="p-4 border-rose-500/25 bg-rose-950/10 flex flex-col justify-between shadow-[0_0_15px_rgba(244,63,94,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-rose-400 font-medium uppercase">Active Devices</span>
            <Smartphone className="h-4 w-4 text-rose-400 animate-bounce" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-extrabold text-rose-400 leading-none">{stats.devices}</span>
            <div className="text-[10px] text-rose-300 mt-1 font-sans">
              Critical security threat logged
            </div>
          </div>
        </GlassCard>

        {/* Stat 3: Suspicion Flags (Orange) */}
        <GlassCard className="p-4 border-amber-500/25 bg-amber-950/10 flex flex-col justify-between shadow-[0_0_15px_rgba(245,158,11,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-amber-400 font-medium uppercase">Suspicious Pose</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-extrabold text-amber-400 leading-none">{stats.suspicious}</span>
            <div className="text-[10px] text-amber-300 mt-1">
              Active verification pending
            </div>
          </div>
        </GlassCard>

        {/* Stat 4: Rover Status */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-medium uppercase">Patrol Rover</span>
            <Cpu className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white uppercase">{rover.motorStatus}</span>
              <span className="text-xs text-slate-400 font-mono">({rover.battery}%)</span>
            </div>
            <div className="text-[10px] text-cyan-400 mt-1 font-mono flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {rover.currentMission}
            </div>
          </div>
        </GlassCard>

        {/* Stat 5: Active Alerts log */}
        <GlassCard className="p-4 col-span-2 md:col-span-1 border-blue-500/30 bg-blue-950/15 flex flex-col justify-between shadow-[0_0_15px_rgba(59,130,246,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-blue-400 font-medium uppercase">Threat Stream</span>
            <AlertOctagon className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-extrabold text-blue-400 leading-none">{stats.activeAlertCount}</span>
            <div className="text-[10px] text-blue-300 mt-1">
              Unresolved alerts in log
            </div>
          </div>
        </GlassCard>

      </div>

      {/* 3. Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search students by Name, Hall Ticket, Room, Seat, or flagged device..."
          className="w-full bg-slate-900/40 border border-blue-900/30 rounded-2xl py-3.5 pl-11 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-500"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-3.5 text-xs text-slate-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* 4. Priority Sorted Student Groups */}
      <div className="space-y-6">
        
        {/* GROUP 1: Electronic Device Detected (RED) */}
        {group1.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-rose-400">
                Group 1: CONFIRMED DEVIATIONS & DEVIATING DEVICES ({group1.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group1.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className="group relative rounded-2xl border border-rose-500/40 bg-rose-950/15 hover:bg-rose-950/25 p-4 flex gap-4 transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.05)] hover:-translate-y-0.5"
                >
                  <div className="relative w-20 h-24 rounded-xl overflow-hidden border border-rose-500/20 flex-shrink-0">
                    <img 
                      src={student.photo} 
                      alt={student.name} 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-1.5 left-1.5 bg-rose-500 text-white text-[8px] font-bold px-1 rounded uppercase font-mono tracking-wider">
                      Threat
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="text-sm font-extrabold text-white group-hover:text-rose-400 transition-colors truncate">{student.name}</h3>
                        <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </div>
                      <span className="block text-[10px] font-mono text-slate-400">{student.hallTicket} · {student.branch}</span>
                      
                      <div className="mt-1.5 p-1.5 rounded-lg bg-rose-950/40 border border-rose-800/20">
                        <span className="block text-[10px] text-rose-300 font-medium font-sans">
                          🚨 {student.detectedDevice}
                        </span>
                        <span className="block text-[9px] text-rose-400/80 font-mono mt-0.5">
                          Confidence: {student.detectionConfidence}% · scanned at {new Date(student.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400">{student.room} · {student.seat}</span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold uppercase tracking-wider text-[8px]">
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
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400">
                Group 2: SUSPICIOUS BEHAVIOR METRICS ({group2.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group2.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className="group relative rounded-2xl border border-amber-500/30 bg-amber-950/15 hover:bg-amber-950/25 p-4 flex gap-4 transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:-translate-y-0.5"
                >
                  <div className="relative w-20 h-24 rounded-xl overflow-hidden border border-amber-500/15 flex-shrink-0">
                    <img 
                      src={student.photo} 
                      alt={student.name} 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-1.5 left-1.5 bg-amber-500 text-slate-950 text-[8px] font-black px-1 rounded uppercase font-mono">
                      FLAG: {student.suspicionScore}%
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="text-sm font-extrabold text-white group-hover:text-amber-400 transition-colors truncate">{student.name}</h3>
                        <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </div>
                      <span className="block text-[10px] font-mono text-slate-400">{student.hallTicket} · {student.branch}</span>
                      
                      <p className="mt-1.5 text-xs text-slate-300 font-sans line-clamp-2">
                        {student.suspicionReason}
                      </p>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400">{student.room} · {student.seat}</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold uppercase tracking-wider text-[8px]">
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
          <div className="space-y-3">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Group 3: VERIFIED SAFE STUDENTS & EXAM ENTRY COMPLETED ({group3.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group3.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className="group rounded-xl border border-blue-900/20 bg-slate-900/25 hover:border-emerald-500/40 hover:bg-slate-900/40 p-3 flex gap-3 transition-all duration-300 cursor-pointer"
                >
                  <img 
                    src={student.photo} 
                    alt={student.name} 
                    className="w-11 h-11 rounded-lg object-cover border border-white/5 grayscale group-hover:grayscale-0 transition-all"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 truncate leading-tight">{student.name}</h4>
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    </div>
                    <span className="block text-[9px] font-mono text-slate-500 tracking-tight mt-0.5">{student.hallTicket} · {student.seat}</span>
                    <div className="flex items-center justify-between mt-1 text-[8px] font-mono">
                      <span className="text-emerald-400">Verified Gate Face Match ({student.faceConfidence || 99}%)</span>
                      <span className="text-slate-500">Entry: Allowed</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredStudents.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-950/20">
            <Search className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">No Student Records Found</h4>
            <p className="text-xs text-slate-500 mt-1">Try modifying your query or filter term.</p>
          </div>
        )}

      </div>

    </div>
  );
}
