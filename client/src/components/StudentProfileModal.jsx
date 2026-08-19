import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  Database,
  ExternalLink,
  Sparkles,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import GlassCard from './GlassCard';
import { supabase } from '../lib/supabase';
import { listStudentImagesFromBucket } from '../services/storageService';

export default function StudentProfileModal({ 
  student = {}, 
  role, 
  onClose, 
  onUpdateDecision,
  theme = 'dark'
}) {
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [bucketImages, setBucketImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [activePhotoUrl, setActivePhotoUrl] = useState(student.photo || '');
  const [localStudent, setLocalStudent] = useState(student);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const isControllerOrAdmin = !role || ['admin', 'exam controller', 'controller'].includes(String(role).toLowerCase());
  const isLight = theme === 'light';

  // Keep localStudent synced if prop changes
  useEffect(() => {
    setLocalStudent(student);
  }, [student]);

  // Fetch exact images from Supabase Storage bucket on mount / student change
  useEffect(() => {
    let isMounted = true;
    async function loadBucketPhotos() {
      setLoadingImages(true);
      try {
        const images = await listStudentImagesFromBucket(student);
        if (isMounted) {
          setBucketImages(images);
          if (images.length > 0) {
            setActivePhotoUrl(images[0].url);
          } else if (student.photo) {
            setActivePhotoUrl(student.photo);
          }
        }
      } catch (err) {
        console.warn('Failed to load bucket images:', err);
      } finally {
        if (isMounted) setLoadingImages(false);
      }
    }
    loadBucketPhotos();
    return () => { isMounted = false; };
  }, [student]);

  const handleDecisionChange = async (decision) => {
    if (submitting) return;
    setSubmitting(true);
    setFeedbackMsg(null);

    const updateFields = {
      entryDecision: decision,
      entryAllowed: decision === 'Allowed',
      status: decision === 'Allowed' ? 'Verified Safe' : 'Device Detected'
    };

    // 1. Optimistic UI update
    const updatedStudent = { ...localStudent, ...updateFields };
    setLocalStudent(updatedStudent);

    try {
      // 2. Call Express API endpoint
      const response = await fetch(`/api/students/${localStudent.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      // 3. Fallback direct Supabase DB sync
      try {
        await supabase.from('students').update(updateFields).eq('id', localStudent.id);
      } catch (subErr) {
        console.warn('Direct Supabase update notice:', subErr.message);
      }

      // 4. Notify parent component
      if (onUpdateDecision) {
        onUpdateDecision(localStudent.id, decision, updateFields);
      }

      setFeedbackMsg({
        type: decision === 'Allowed' ? 'success' : 'danger',
        text: decision === 'Allowed' 
          ? `ENTRANCE APPROVED: Clear access granted for ${localStudent.name}.`
          : `ENTRANCE DENIED: Access revoked for ${localStudent.name} (Status: Device Intercept).`
      });

    } catch (e) {
      console.error('Decision update error:', e);
      setFeedbackMsg({
        type: 'danger',
        text: `Error saving decision: ${e.message}`
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isSupabaseUrl = activePhotoUrl && activePhotoUrl.includes('/storage/v1/object/public/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal content glass box */}
      <div className={`relative w-full max-w-4xl max-h-[90vh] border rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200 transition-colors ${
        isLight 
          ? 'bg-white border-slate-200 text-slate-900 shadow-xl' 
          : 'bg-[#090d16] border-slate-800 text-slate-100 shadow-2xl'
      }`}>
        
        {/* Top Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-blue-900/30'
        }`}>
          <div className="flex items-center gap-2">
            <User className={`h-5 w-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
            <span className={`text-sm font-bold font-mono tracking-wider uppercase ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>SYS_PROFILE_QUERY // {student.id}</span>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Feedback banner if updated */}
          {feedbackMsg && (
            <div className={`p-3 rounded-2xl border text-xs font-mono flex items-center justify-between animate-in fade-in ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {feedbackMsg.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-rose-400" />}
                <span className="font-bold">{feedbackMsg.text}</span>
              </div>
              <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Main Visual Header Row */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Student Photo */}
            <div className="relative w-full md:w-44 h-52 rounded-2xl overflow-hidden border border-blue-900/30 bg-slate-950 flex-shrink-0 group">
              <img 
                src={activePhotoUrl || localStudent.photo} 
                alt={localStudent.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(localStudent.name || 'Cadet')}&background=0D8ABC&color=fff&bold=true`;
                }}
              />
              
              {/* Storage Badge */}
              <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
                <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 shadow ${
                  isSupabaseUrl
                    ? 'bg-blue-600 text-white border border-blue-400'
                    : 'bg-slate-900/80 text-slate-300 border border-slate-700'
                }`}>
                  <Database className="h-2.5 w-2.5" />
                  {isSupabaseUrl ? 'Supabase Bucket' : 'Standard Avatar'}
                </span>
              </div>

              <div className={`absolute bottom-3 left-3 right-3 text-center py-1 rounded text-[9px] font-bold font-mono uppercase border tracking-wider ${
                localStudent.status === 'Device Detected' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                localStudent.status === 'Suspicious' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {localStudent.status}
              </div>
            </div>

            {/* Core Details Grid */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-2xl font-extrabold text-white leading-none font-sans">{localStudent.name}</h2>
                  <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30">
                    {localStudent.hallTicket}
                  </span>
                </div>
                
                <p className="text-slate-400 text-sm mt-1">{localStudent.branch} · Semester VI</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Exam Room</span>
                    <span className="block font-bold text-white mt-1">{localStudent.room}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Seat Index</span>
                    <span className="block font-bold text-white mt-1">{localStudent.seat}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Face Confidence</span>
                    <span className="block font-bold text-emerald-400 mt-1">{localStudent.faceConfidence || 99}% Match</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#010409] border border-blue-900/20 text-xs">
                    <span className="block text-slate-500 font-mono text-[10px] uppercase">Entry decision</span>
                    <span className={`block font-bold mt-1 ${
                      localStudent.entryDecision === 'Allowed' ? 'text-emerald-400' :
                      localStudent.entryDecision === 'Denied' ? 'text-rose-400' :
                      'text-amber-400'
                    }`}>{localStudent.entryDecision || 'Pending'}</span>
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
                        disabled={submitting || localStudent.entryDecision === 'Denied'}
                        onClick={() => handleDecisionChange('Denied')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer border ${
                          localStudent.entryDecision === 'Denied' 
                            ? 'bg-rose-600 border-rose-500 text-white shadow shadow-rose-600/20' 
                            : 'bg-rose-950/20 hover:bg-rose-950/40 border-rose-800/30 text-rose-300'
                        }`}
                      >
                        {submitting ? 'Updating...' : 'Deny Entrance'}
                      </button>
                      <button
                        disabled={submitting || localStudent.entryDecision === 'Allowed'}
                        onClick={() => handleDecisionChange('Allowed')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer border ${
                          localStudent.entryDecision === 'Allowed' 
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-600/20' 
                            : 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-800/30 text-emerald-300'
                        }`}
                      >
                        {submitting ? 'Updating...' : 'Approve & Clear Entry'}
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Tab Subsystem */}
          <div className="flex border-b border-blue-900/30 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 font-mono uppercase transition-all cursor-pointer whitespace-nowrap ${activeTab === 'profile' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              Academic Profile
            </button>
            <button 
              onClick={() => setActiveTab('bucket')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 font-mono uppercase transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'bucket' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <Database className="h-3.5 w-3.5 text-blue-400" />
              <span>Supabase Storage Vault ({bucketImages.length})</span>
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 font-mono uppercase transition-all cursor-pointer whitespace-nowrap ${activeTab === 'security' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              AI Security Analysis
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

          {/* TAB 2: Supabase Storage Bucket Vault */}
          {activeTab === 'bucket' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    Supabase Storage Bucket Image Registry
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Images stored in <code className="text-blue-400 font-mono">student-photos</code> bucket for cadet <span className="font-bold text-white">{student.name}</span> ({student.hallTicket || student.id})
                  </p>
                </div>
                
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {bucketImages.length} OBJECTS FETCHED
                </span>
              </div>

              {loadingImages ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 font-mono text-xs space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
                  <span>Querying Supabase Storage Bucket 'student-photos'...</span>
                </div>
              ) : bucketImages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bucketImages.map((img, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setActivePhotoUrl(img.url)}
                      className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer p-3 space-y-2 ${
                        activePhotoUrl === img.url
                          ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/20'
                          : 'bg-[#010409]/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                        <img 
                          src={img.url} 
                          alt={img.filename} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {activePhotoUrl === img.url && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white text-[9px] font-bold font-mono px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                            <Check className="h-3 w-3" /> ACTIVE PROFILE
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span className="truncate max-w-[140px] text-white font-semibold">{img.filename}</span>
                          <a 
                            href={img.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> CDN
                          </a>
                        </div>
                        <span className="block text-[9px] font-mono text-slate-500">
                          Uploaded: {new Date(img.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-[#010409]/40 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">No Dedicated Bucket Images Found</h4>
                    <p className="text-xs text-slate-500 max-w-md mt-1 font-sans">
                      This student currently relies on the default photo avatar URL (<code className="text-slate-400 font-mono text-[10px]">{student.photo}</code>). When a new photo is taken during enrollment, it will be uploaded directly to the <code className="text-blue-400 font-mono text-[10px]">student-photos</code> bucket and displayed here.
                    </p>
                  </div>
                  {student.photo && (
                    <div className="pt-2 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700">
                        <img src={student.photo} alt="Current photo" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left text-xs font-mono">
                        <span className="block text-slate-400 font-bold">Active Avatar Image</span>
                        <span className="block text-[10px] text-slate-500 truncate max-w-xs">{student.photo}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
