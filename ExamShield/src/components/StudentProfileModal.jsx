import React, { useState } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  Activity, 
  Calendar, 
  BookOpen, 
  ShieldAlert, 
  CheckCircle, 
  AlertOctagon, 
  Camera, 
  Lock, 
  Smartphone,
  Check,
  ChevronRight
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function StudentProfileModal({ 
  student = {}, 
  role, 
  onClose, 
  onUpdateDecision 
}) {
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const isControllerOrAdmin = role === 'Exam Controller' || role === 'Admin';

  const handleDecisionChange = async (decision) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/students/${student.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (data.success) {
        onUpdateDecision(student.id, decision);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal content glass box */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#020617] border border-blue-900/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-blue-900/30 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-bold font-mono tracking-wider text-slate-300 uppercase">SYS_PROFILE_QUERY // {student.id}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-blue-950/40 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Main Visual Header Row */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Student Photo */}
            <div className="relative w-full md:w-44 h-52 rounded-2xl overflow-hidden border border-blue-900/30 bg-slate-950 flex-shrink-0">
              <img 
                src={student.photo} 
                alt={student.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className={`absolute bottom-3 left-3 right-3 text-center py-1 rounded text-[9px] font-bold font-mono uppercase border tracking-wider ${
                student.status === 'Device Detected' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                student.status === 'Suspicious' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {student.status}
              </div>
            </div>

            {/* Core Details Grid */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-2xl font-extrabold text-white leading-none font-sans">{student.name}</h2>
                  <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30">
                    {student.hallTicket}
                  </span>
                </div>
                
                <p className="text-slate-400 text-sm mt-1">{student.branch} · Semester VI</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Exam Room</span>
                    <span className="block font-bold text-white mt-1">{student.room}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Seat Index</span>
                    <span className="block font-bold text-white mt-1">{student.seat}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Face Confidence</span>
                    <span className="block font-bold text-emerald-400 mt-1">{student.faceConfidence || 99}% Match</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Entry decision</span>
                    <span className={`block font-bold mt-1 ${
                      student.entryDecision === 'Allowed' ? 'text-emerald-400' :
                      student.entryDecision === 'Denied' ? 'text-rose-400' :
                      'text-amber-400'
                    }`}>{student.entryDecision || 'Pending'}</span>
                  </div>
                </div>
              </div>

              {/* Security Decision Buttons for controller roles */}
              <div className="mt-6 pt-4 border-t border-blue-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">GATE ACCESS DECISION CONTROLLER</h4>
                  <p className="text-[10px] text-slate-500">Requires Exam Controller or Admin authorization to override entry state.</p>
                </div>

                <div className="flex gap-2">
                  {!isControllerOrAdmin ? (
                    <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5 p-2 bg-blue-950/10 rounded-xl border border-blue-900/20">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Privilege required to update status</span>
                    </div>
                  ) : (
                    <>
                      <button
                        disabled={submitting || student.entryDecision === 'Denied'}
                        onClick={() => handleDecisionChange('Denied')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer border ${
                          student.entryDecision === 'Denied' 
                            ? 'bg-rose-600 border-rose-500 text-white shadow shadow-rose-600/20' 
                            : 'bg-rose-950/20 hover:bg-rose-950/40 border-rose-800/30 text-rose-300'
                        }`}
                      >
                        {submitting ? '...' : 'Deny Entrance'}
                      </button>
                      <button
                        disabled={submitting || student.entryDecision === 'Allowed'}
                        onClick={() => handleDecisionChange('Allowed')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer border ${
                          student.entryDecision === 'Allowed' 
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-600/20' 
                            : 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-800/30 text-emerald-300'
                        }`}
                      >
                        {submitting ? '...' : 'Approve & Clear Entry'}
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Tab Subsystem */}
          <div className="flex border-b border-blue-900/30">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 font-mono uppercase transition-all cursor-pointer ${activeTab === 'profile' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              Academic Profile
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 font-mono uppercase transition-all cursor-pointer ${activeTab === 'security' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              AI Security Analysis
            </button>
            <button 
              onClick={() => setActiveTab('timeline')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 font-mono uppercase transition-all cursor-pointer ${activeTab === 'timeline' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              History & Log Timeline
            </button>
          </div>

          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Student Academic Record</h3>
                <div className="rounded-2xl border border-blue-900/20 bg-[#010409]/40 p-4 space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-blue-900/20">
                    <span className="text-slate-500">Degree Course</span>
                    <span className="text-slate-300 font-semibold">Bachelor of Technology</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-blue-900/20">
                    <span className="text-slate-500">Academic Year</span>
                    <span className="text-slate-300 font-semibold">Third Year (Semester VI)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-blue-900/20">
                    <span className="text-slate-500">Exam Name</span>
                    <span className="text-slate-300 font-semibold">Design & Analysis of Algorithms</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">RFID SmartCard ID</span>
                    <span className="text-slate-300 font-mono">#RFID-942-B-405</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Exam Hall Placement</h3>
                <div className="rounded-2xl border border-blue-900/20 bg-[#010409]/40 p-4 space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-blue-900/20">
                    <span className="text-slate-500">Assigned Hall Room</span>
                    <span className="text-slate-300 font-semibold">{student.room}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-blue-900/20">
                    <span className="text-slate-500">Desk Row Seat</span>
                    <span className="text-slate-300 font-semibold">{student.seat}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-blue-900/20">
                    <span className="text-slate-500">Scheduled Exam Hour</span>
                    <span className="text-slate-300 font-semibold">10:00 AM - 01:00 PM</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Proctor In-Charge</span>
                    <span className="text-slate-300 font-semibold">Dr. A. K. Sastri</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI Security Analysis */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              
              {/* Snapshot Display if flagged */}
              {(student.snapshot || student.status !== 'Verified Safe') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-2.5">Flagged Frame Capture</h3>
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-rose-500/20 bg-[#010409]">
                      <img 
                        src={student.snapshot || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=80'} 
                        alt="Flagged frame snapshot" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 left-3 bg-rose-600 text-white text-[8px] font-bold font-mono px-1.5 py-0.5 rounded uppercase tracking-wider">
                        ROVER_CAM_HUD_FLAG
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-2.5">Spectral RF Scan</h3>
                    <div className="rounded-xl border border-blue-900/20 bg-[#010409]/40 p-4 space-y-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-rose-400" />
                        <div>
                          <span className="block font-bold text-white">Radio frequency Beacon</span>
                          <span className="block text-[10px] text-slate-500">Continuous telemetry handshake registered</span>
                        </div>
                      </div>
                      <div className="h-16 w-full bg-[#010409] rounded border border-blue-900/20 p-2 flex items-end justify-between overflow-hidden">
                        {/* Fake spectrum wave bars */}
                        {Array.from({ length: 32 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="w-1 rounded-full bg-blue-600" 
                            style={{ height: `${20 + Math.sin(i * 1.2) * 20 + Math.random() * 25}%` }} 
                          />
                        ))}
                      </div>
                      <span className="block text-[9px] text-slate-500 font-mono">CENTER_FREQ: 2.4540 GHz // SIGNAL_STRENGTH: -52 dBm</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Infraction Log details */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">LOGGED INFRACTIONS & SECURITY VIOLATIONS</h3>
                <div className="rounded-2xl border border-rose-500/10 bg-rose-950/5 p-4 text-xs space-y-2.5">
                  {student.violationHistory && student.violationHistory.length > 0 ? (
                    student.violationHistory.map((violation, i) => (
                      <div key={i} className="flex gap-2.5 items-start">
                        <ShieldAlert className="h-4.5 w-4.5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <span className="text-rose-200 font-sans leading-relaxed">{violation}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex gap-2.5 items-center text-emerald-400">
                      <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" />
                      <span>Zero Infractions registered against this student. Academic profile safe.</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: History & Log Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Gate Check & Rover Patrol Timeline</h3>
              
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-blue-900/30">
                {student.verificationHistory && student.verificationHistory.map((historyItem, i) => (
                  <div key={i} className="relative group text-xs">
                    <span className="absolute -left-6 top-1 h-4.5 w-4.5 rounded-full bg-slate-900 border border-blue-500 flex items-center justify-center font-bold text-[8px] text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      {i + 1}
                    </span>
                    <div className="p-3 rounded-xl bg-[#010409]/40 border border-blue-900/20 font-sans text-slate-300">
                      {historyItem}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4.5 border-t border-blue-900/30 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>OPERATOR TERMINAL SYSTEM v2.84</span>
          <span>DATE QUERY: 2026-07-21</span>
        </div>

      </div>
    </div>
  );
}
