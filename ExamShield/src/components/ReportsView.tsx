import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  User, 
  AlertOctagon, 
  Calendar, 
  Compass, 
  Cpu, 
  Award, 
  Clock, 
  Eye, 
  Download,
  Check,
  ShieldCheck
} from 'lucide-react';
import { Student, UserRole } from '../types';
import GlassCard from './GlassCard';

interface ReportsViewProps {
  students: Student[];
  role: UserRole;
  operatorName: string;
}

export default function ReportsView({ students, role, operatorName }: ReportsViewProps) {
  // Only students with some flagged or suspicious status by default
  const flaggedStudents = useMemo(() => {
    return students.filter(s => s.status !== 'Verified Safe');
  }, [students]);

  const [selectedStudentId, setSelectedStudentId] = useState(flaggedStudents[0]?.id || students[0]?.id || '');
  const [violationType, setViolationType] = useState('Unsanctioned RF Transmission');
  const [customNotes, setCustomNotes] = useState('Student was flagged by Rover CV model near wrist area. Secondary RF beacon inspection confirmed active transmission. Dispatched floor supervisor. Student removed from examination hall with logged device.');
  const [roverId, setRoverId] = useState('ROV-SHIELD-09');
  const [reportSuccess, setReportSuccess] = useState(false);

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSim = () => {
    setReportSuccess(true);
    setTimeout(() => {
      setReportSuccess(false);
    }, 4000);
    
    // Fallback to native print to save as PDF
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            Incident Report Center
            <FileText className="h-5 w-5 text-blue-400" />
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Compile, customize, and print formal academic violation records backed by AI sensor telemetry.</p>
        </div>
      </div>

      {/* 2. Interactive Compiler Form (Hidden on Print) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        
        {/* Compiler controls */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Report Parameters Compiler</h3>
            
            <div className="space-y-3 text-xs">
              
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Select Flagged Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {flaggedStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.hallTicket})</option>
                  ))}
                  <option disabled>--- Safe Students ---</option>
                  {students.filter(s => s.status === 'Verified Safe').map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.hallTicket}) - Cleared</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Infraction Classification</label>
                <select
                  value={violationType}
                  onChange={(e) => setViolationType(e.target.value)}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Unsanctioned RF Transmission">Unsanctioned RF Transmission</option>
                  <option value="Smart Watch Device Concealment">Smart Watch Device Concealment</option>
                  <option value="Bluetooth Audio Beacon Active">Bluetooth Audio Beacon Active</option>
                  <option value="Nervous Posture Model - Verified Sheet Peek">Nervous Posture Model - Verified Sheet Peek</option>
                  <option value="Prohibited Electronic Accessory Detected">Prohibited Electronic Accessory Detected</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Rover Hardware ID</label>
                  <input
                    type="text"
                    value={roverId}
                    onChange={(e) => setRoverId(e.target.value)}
                    className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Reporting Operator</label>
                  <input
                    type="text"
                    value={operatorName}
                    readOnly
                    className="w-full bg-[#010409]/60 border border-blue-900/30 rounded-lg p-2 text-xs text-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Operator Notes & Action Actions</label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Summarize exact visual cues, RF strengths, and physical measures..."
                />
              </div>

            </div>

            <div className="pt-3 border-t border-blue-900/20 space-y-2">
              <button
                onClick={handlePrint}
                className="w-full py-2.5 bg-slate-950 border border-white/10 hover:border-blue-500 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4 text-slate-400" />
                <span>NATIVE PRINT REPORT</span>
              </button>

              <button
                onClick={handleDownloadSim}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>DOWNLOAD COMPILED PDF</span>
              </button>
            </div>
          </GlassCard>

          {reportSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 items-center text-emerald-300 text-xs animate-in fade-in duration-300">
              <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="block font-bold">PDF Successfully Prepared</span>
                <span className="block text-[10px] text-emerald-400/80">Check your print queue or local downloads folder.</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Document Preview */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-cyan-400" />
            LIVE DOCUMENT RENDER (100% SCALE)
          </h3>
          
          <div className="p-8 rounded-2xl bg-white text-slate-950 shadow-2xl relative border-4 border-slate-300 min-h-[600px] font-serif">
            {/* Top watermarked grid style */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />
            
            <div className="relative z-10 space-y-6">
              
              {/* Report Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans uppercase">EXAMSHIELD SECURITY COMMISSION</h2>
                  <p className="text-[10px] font-sans font-semibold tracking-wider text-slate-500">OFFICIAL INCIDENT REPORT RECORD // academic compliance</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 text-[10px] font-mono font-bold uppercase rounded">
                    CONTRABAND DETECTED
                  </span>
                </div>
              </div>

              {/* General details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans text-slate-700">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">CASE FILE ID</span>
                  <span className="block font-semibold text-slate-900 font-mono">#ES-2026-{(selectedStudent?.id || '99').toUpperCase()}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">TELEMETRY SOURCE</span>
                  <span className="block font-semibold text-slate-900 font-mono">{roverId}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">DATE RENDER</span>
                  <span className="block font-semibold text-slate-900 font-mono">July 21, 2026</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">SECTOR</span>
                  <span className="block font-semibold text-slate-900 font-mono">{selectedStudent?.room || 'LH-302'}</span>
                </div>
              </div>

              {/* Student details box */}
              {selectedStudent ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Small black and white portrait photo */}
                  <div className="md:col-span-3 h-28 w-full bg-slate-200 rounded border border-slate-300 overflow-hidden">
                    <img 
                      src={selectedStudent.photo} 
                      alt="Student portrait" 
                      className="w-full h-full object-cover grayscale"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  {/* Student details */}
                  <div className="md:col-span-9 flex flex-col justify-between text-xs font-sans">
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">INCIDENTEE DETAIL</span>
                      <span className="block text-base font-extrabold text-slate-900 leading-tight">{selectedStudent.name}</span>
                      <span className="block text-slate-500">Branch Course: {selectedStudent.branch}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-600 mt-2">
                      <span>Hall ticket: <strong className="text-slate-900 font-mono">{selectedStudent.hallTicket}</strong></span>
                      <span>Assigned Seat: <strong className="text-slate-900 font-mono">{selectedStudent.seat}</strong></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-slate-400 font-sans bg-slate-50 border border-slate-200">
                  Select a student from the configuration dropdown list.
                </div>
              )}

              {/* Infraction metrics */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 font-sans uppercase tracking-wider">INCIDENTS & COMPLIANCE METRICS</h3>
                <div className="border-t border-slate-300 pt-2 text-xs font-sans text-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Classification Type:</span>
                    <span className="text-slate-900 font-bold font-mono">{violationType}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Identified Object Tag:</span>
                    <span className="text-slate-900 font-bold font-mono">{selectedStudent?.detectedDevice || 'Concealed smart device'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">AI Confidence Matrix:</span>
                    <span className="text-red-700 font-bold font-mono">{(selectedStudent?.detectionConfidence || selectedStudent?.suspicionScore || 95)}% POSITIVE CONFIRMATION</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Incident Capture Hour:</span>
                    <span className="text-slate-900 font-mono">{selectedStudent ? new Date(selectedStudent.timestamp).toLocaleTimeString() : '10:05 AM'}</span>
                  </div>
                </div>
              </div>

              {/* Operator comments */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 font-sans uppercase tracking-wider">OFFICIAL TELEMETRY OBSERVATION LOG</h3>
                <div className="border-t border-slate-300 pt-2 text-xs font-serif italic text-slate-800 leading-relaxed">
                  "{customNotes}"
                </div>
              </div>

              {/* Signature grid */}
              <div className="grid grid-cols-2 gap-8 pt-10 text-[10px] font-sans text-slate-600">
                <div className="border-t border-slate-400 pt-2">
                  <span className="block font-bold text-slate-950 uppercase">{operatorName}</span>
                  <span className="block text-[8px]">LOGGED OPERATING TECHNICIAN</span>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <span className="block border-b border-dashed border-slate-300 h-4 w-full" />
                  <span className="block text-[8px] mt-1">EXAMINATIONS CONTROLLER / DEAN APPROVAL</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* 3. PRINT ONLY STYLE FOR window.print() */}
      <div className="hidden print:block bg-white text-slate-950 font-serif p-10 w-full min-h-screen">
        <div className="space-y-6">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans uppercase">EXAMSHIELD SECURITY COMMISSION</h2>
              <p className="text-[10px] font-sans font-semibold tracking-wider text-slate-500">OFFICIAL INCIDENT REPORT RECORD // ACADEMIC COMPLIANCE</p>
            </div>
            <div>
              <span className="inline-block px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 text-[10px] font-mono font-bold uppercase rounded">
                CONTRABAND DETECTED
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 text-xs font-sans text-slate-700">
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase">CASE FILE ID</span>
              <span className="block font-semibold text-slate-900 font-mono">#ES-2026-{(selectedStudent?.id || '99').toUpperCase()}</span>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase">TELEMETRY SOURCE</span>
              <span className="block font-semibold text-slate-900 font-mono">{roverId}</span>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase">DATE RENDER</span>
              <span className="block font-semibold text-slate-900 font-mono">July 21, 2026</span>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase">SECTOR</span>
              <span className="block font-semibold text-slate-900 font-mono">{selectedStudent?.room || 'LH-302'}</span>
            </div>
          </div>

          {selectedStudent && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-12 gap-4">
              <div className="col-span-3 h-28 bg-slate-200 rounded border border-slate-300 overflow-hidden">
                <img 
                  src={selectedStudent.photo} 
                  alt="Student portrait" 
                  className="w-full h-full object-cover grayscale"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="col-span-9 flex flex-col justify-between text-xs font-sans">
                <div className="space-y-1">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">INCIDENTEE DETAIL</span>
                  <span className="block text-base font-extrabold text-slate-900 leading-tight">{selectedStudent.name}</span>
                  <span className="block text-slate-500">Branch Course: {selectedStudent.branch}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-600 mt-2">
                  <span>Hall ticket: <strong className="text-slate-900 font-mono">{selectedStudent.hallTicket}</strong></span>
                  <span>Assigned Seat: <strong className="text-slate-900 font-mono">{selectedStudent.seat}</strong></span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 font-sans uppercase tracking-wider">INCIDENTS & COMPLIANCE METRICS</h3>
            <div className="border-t border-slate-300 pt-2 text-xs font-sans text-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Classification Type:</span>
                <span className="text-slate-900 font-bold font-mono">{violationType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Identified Object Tag:</span>
                <span className="text-slate-900 font-bold font-mono">{selectedStudent?.detectedDevice || 'Concealed smart watch'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">AI Confidence Matrix:</span>
                <span className="text-red-700 font-bold font-mono">{(selectedStudent?.detectionConfidence || selectedStudent?.suspicionScore || 95)}% POSITIVE CONFIRMATION</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 font-sans uppercase tracking-wider">OFFICIAL TELEMETRY OBSERVATION LOG</h3>
            <div className="border-t border-slate-300 pt-2 text-xs font-serif italic text-slate-800 leading-relaxed">
              "{customNotes}"
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-10 text-[10px] font-sans text-slate-600">
            <div className="border-t border-slate-400 pt-2">
              <span className="block font-bold text-slate-950 uppercase">{operatorName}</span>
              <span className="block text-[8px]">LOGGED OPERATING TECHNICIAN</span>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <span className="block border-b border-dashed border-slate-300 h-4 w-full" />
              <span className="block text-[8px] mt-1">EXAMINATIONS CONTROLLER / DEAN APPROVAL</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
