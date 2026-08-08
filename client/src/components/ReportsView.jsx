import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  Download,
  Eye, 
  ShieldCheck
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function ReportsView({ students = [], role, operatorName, theme = 'dark' }) {
  const flaggedStudents = useMemo(() => {
    return students.filter(s => s.status !== 'Verified Safe');
  }, [students]);

  const [selectedStudentId, setSelectedStudentId] = useState(flaggedStudents[0]?.id || students[0]?.id || '');
  const [violationType, setViolationType] = useState('Unsanctioned RF Transmission');
  const [customNotes, setCustomNotes] = useState('Student was flagged by Rover CV model near wrist area. Secondary RF beacon inspection confirmed active transmission. Dispatched floor supervisor. Student removed from examination hall with logged device.');
  const [roverId, setRoverId] = useState('ROV-SHIELD-09');
  const [reportSuccess, setReportSuccess] = useState(false);

  const isLight = theme === 'light';

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const handlePrint = () => window.print();

  const handleDownloadSim = () => {
    setReportSuccess(true);
    setTimeout(() => setReportSuccess(false), 4000);
    window.print();
  };

  return (
    <div className="space-y-7 pb-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Incident Report Center
            <FileText className="h-6 w-6 text-blue-500" />
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Compile, customize, and print formal academic violation records backed by AI sensor telemetry.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        
        <div className="lg:col-span-5 space-y-6">
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              Report Parameters Compiler
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Select Flagged Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500'
                  }`}
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.hallTicket}) - {s.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Primary Violation Classifier</label>
                <select
                  value={violationType}
                  onChange={(e) => setViolationType(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500'
                  }`}
                >
                  <option value="Unsanctioned RF Transmission">Unsanctioned RF Transmission</option>
                  <option value="Smart Wearable Electronic Device">Smart Wearable Electronic Device</option>
                  <option value="Severe Posture Deviance">Severe Posture Deviance</option>
                  <option value="Impersonation / Gate Identity Mismatch">Impersonation / Gate Identity Mismatch</option>
                </select>
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Assigned Rover Telemetry Vessel</label>
                <input
                  type="text"
                  value={roverId}
                  onChange={(e) => setRoverId(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Inspector Synopsis & Incident Summary</label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={4}
                  className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none resize-none ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Printer className="h-4 w-4" />
                  <span>PRINT REPORT</span>
                </button>
                
                <button
                  onClick={handleDownloadSim}
                  className={`flex-1 py-2.5 border text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isLight ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50' : 'bg-slate-900 border-blue-900/30 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Download className="h-4 w-4 text-cyan-500" />
                  <span>EXPORT PDF</span>
                </button>
              </div>

              {reportSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Document generated successfully for archival export.</span>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Live Document Sheet Preview */}
        <div className="lg:col-span-7">
          <GlassCard theme={theme} className="p-6">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider mb-4 flex items-center gap-2 ${
              isLight ? 'text-slate-700' : 'text-slate-400'
            }`}>
              <Eye className="h-4 w-4 text-cyan-500" />
              Live Official Report Sheet Preview
            </h3>

            {/* Document Paper Container */}
            {selectedStudent ? (
              <div className="bg-white text-slate-900 p-8 rounded-xl shadow-xl border border-slate-200 font-sans space-y-6 text-xs leading-relaxed">
                {/* Official Letterhead */}
                <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">UNIVERSITY EXAM CONTROLLER OFFICE</h2>
                    <p className="text-[10px] text-slate-600 font-mono">AUTONOMOUS ACADEMIC INTEGRITY & AI SURVEILLANCE SUITE</p>
                  </div>
                  <div className="text-right font-mono text-[10px] text-slate-500">
                    <span className="block font-bold text-slate-900">REF: EXM-2026-{(selectedStudent.id || '').toUpperCase()}</span>
                    <span>DATE: {new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Report Title */}
                <div className="text-center bg-slate-100 p-2.5 rounded-lg border border-slate-300">
                  <h3 className="text-sm font-black text-rose-700 uppercase tracking-wide">FORMAL EXAMINATION INCIDENT REPORT</h3>
                  <span className="text-[10px] font-mono text-slate-600">INCIDENT CLASSIFICATION: {violationType.toUpperCase()}</span>
                </div>

                {/* Candidate Info Grid */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Candidate Name</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedStudent.name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Hall Ticket Registration</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{selectedStudent.hallTicket}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Branch / Course</span>
                    <span className="font-semibold text-slate-800">{selectedStudent.branch}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Exam Center Room & Seat</span>
                    <span className="font-mono font-bold text-slate-900">{selectedStudent.room} · {selectedStudent.seat}</span>
                  </div>
                </div>

                {/* Telemetry Evidence Box */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] font-mono">1. Telemetry Evidence Vector</h4>
                  <div className="p-3 bg-slate-100 rounded-lg border border-slate-300 font-mono text-[11px] space-y-1">
                    <div>ROVER VESSEL: {roverId}</div>
                    <div>CONFIDENCE PROBABILITY: {selectedStudent.detectionConfidence || 98}%</div>
                    <div>SCANNED STATUS: {selectedStudent.status}</div>
                    <div>FLAG REASON: {selectedStudent.suspicionReason || selectedStudent.detectedDevice || 'Flagged by posture scan'}</div>
                  </div>
                </div>

                {/* Synopsis */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] font-mono">2. Invigilator Synopsis</h4>
                  <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-sans">
                    {customNotes}
                  </p>
                </div>

                {/* Signatures */}
                <div className="pt-8 flex justify-between items-end text-[10px] font-mono text-slate-600 border-t border-slate-300">
                  <div className="text-center">
                    <div className="font-bold text-slate-900 mb-1">{operatorName || 'Dr. Helen Carter'}</div>
                    <div className="border-t border-slate-400 pt-1 w-36">Chief Exam Controller</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-slate-900 mb-1">AUTOMATED SYSTEM</div>
                    <div className="border-t border-slate-400 pt-1 w-36">AI Telemetry Gateway Seal</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 font-mono">
                No student selected. Select a student from the left compiler panel.
              </div>
            )}
          </GlassCard>
        </div>

      </div>

    </div>
  );
}
