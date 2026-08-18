import React, { useState, useRef, useEffect } from 'react';
import {
  UserPlus,
  Shield,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  QrCode,
  FileSpreadsheet,
  Zap,
  Lock,
  Layers,
  Search,
  Check,
  Cpu,
  Scan,
  UserCheck,
  Eye,
  Radio,
  Fingerprint,
  ArrowRight,
  Database,
  Hash,
  MapPin,
  Award,
  Maximize2
} from 'lucide-react';

const PRESET_AVATARS = [
  { id: 'av1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', label: 'Cadet Female A' },
  { id: 'av2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', label: 'Cadet Male A' },
  { id: 'av3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80', label: 'Cadet Female B' },
  { id: 'av4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', label: 'Cadet Male B' },
  { id: 'av5', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80', label: 'Cadet Female C' },
  { id: 'av6', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80', label: 'Cadet Male C' },
];

const BRANCH_OPTIONS = [
  'Computer Science & AI',
  'Cyber Security & Forensics',
  'Robotics & Automation',
  'Electronics & Quantum Computing',
  'Data Science & Analytics',
  'Aerospace & Defense'
];

const ROOM_OPTIONS = [
  'LH-302',
  'LH-304',
  'Auditorium-1',
  'Main Lab',
  'LH-101',
  'LH-205'
];

export default function AddStudentView({ onAddStudent, onNavigateToDashboard, theme = 'dark' }) {
  const isLight = theme === 'light';

  // Mode: 'single' | 'batch'
  const [enrollmentMode, setEnrollmentMode] = useState('single');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    hallTicket: '',
    branch: 'Computer Science & AI',
    room: 'LH-302',
    seat: 'Seat 15',
    status: 'Verified Safe',
    photo: PRESET_AVATARS[0].url,
    faceConfidence: 99.2,
    detectedDevice: '',
    suspicionReason: '',
  });

  // UI state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanProgress, setScanProgress] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [tiltStyle, setTiltStyle] = useState({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' });
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [parsedBulkStudents, setParsedBulkStudents] = useState([]);
  const [bulkError, setBulkError] = useState('');

  const fileInputRef = useRef(null);
  const cardRef = useRef(null);
  const videoRef = useRef(null);

  // Auto-generate Hall Ticket ID
  const generateHallTicket = () => {
    const year = new Date().getFullYear();
    const randNum = Math.floor(10000 + Math.random() * 90000);
    const code = `HT-${year}-${randNum}`;
    setFormData(prev => ({ ...prev, hallTicket: code }));
  };

  // Set default hall ticket if empty on mount
  useEffect(() => {
    if (!formData.hallTicket) {
      generateHallTicket();
    }
  }, []);

  // Calculate Form Completion / Biometric Readiness (0-100%)
  const calculateReadiness = () => {
    let score = 0;
    if (formData.name.trim().length >= 3) score += 30;
    if (formData.hallTicket.trim().length >= 4) score += 25;
    if (formData.branch) score += 15;
    if (formData.room) score += 15;
    if (formData.photo) score += 15;
    return score;
  };

  const readinessScore = calculateReadiness();

  // 3D Holographic Tilt Card Effect on Mouse Move
  const handleCardMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = (-y / rect.height) * 18;
    const rotateY = (x / rect.width) * 18;
    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`
    });
  };

  const handleCardMouseLeave = () => {
    setTiltStyle({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)' });
  };

  // Image Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({ ...prev, photo: reader.result }));
        triggerBiometricScan();
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger Biometric Scan Animation
  const triggerBiometricScan = () => {
    setScanProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      if (p >= 100) {
        setScanProgress(100);
        clearInterval(interval);
      } else {
        setScanProgress(p);
      }
    }, 40);
  };

  // Simulated Camera Capture
  const toggleCameraStream = async () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      return;
    }
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera access not available, simulating live capture.", err);
      triggerBiometricScan();
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 300;
      canvas.height = videoRef.current.videoHeight || 300;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setFormData(prev => ({ ...prev, photo: dataUrl }));
      
      // stop stream
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraActive(false);
    triggerBiometricScan();
  };

  // Submit Single Student Form
  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter cadet full name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newStudent = {
        id: `STU-${Math.floor(1000 + Math.random() * 9000)}`,
        name: formData.name.trim(),
        hallTicket: formData.hallTicket.trim() || `HT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        branch: formData.branch,
        room: formData.room,
        seat: formData.seat,
        photo: formData.photo,
        status: formData.status,
        detectedDevice: formData.status === 'Device Detected' ? (formData.detectedDevice || 'Mobile Phone RF Signal') : null,
        suspicionReason: formData.status === 'Suspicious' ? (formData.suspicionReason || 'Unusual head movement telemetry') : null,
        suspicionScore: formData.status === 'Suspicious' ? 68 : formData.status === 'Device Detected' ? 92 : 0,
        faceConfidence: parseFloat(formData.faceConfidence) || 99.2,
        entryDecision: formData.status === 'Device Detected' ? 'Denied' : 'Allowed',
        entryAllowed: formData.status !== 'Device Detected',
        verificationCompleted: true,
        timestamp: new Date().toISOString(),
        verificationHistory: [
          { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'Quantum Biometric Enrolled' }
        ],
        violationHistory: formData.status === 'Device Detected' ? [
          { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'Device Detected', detail: 'RF signature match on registration' }
        ] : []
      };

      if (onAddStudent) {
        await onAddStudent(newStudent);
      }
      
      setSuccessModal(newStudent);
    } catch (err) {
      console.error("Failed to enroll student:", err);
      alert("Error saving student to database: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse CSV Bulk Input
  const handleParseCsv = (text) => {
    setBulkCsvText(text);
    setBulkError('');
    if (!text.trim()) {
      setParsedBulkStudents([]);
      return;
    }

    const lines = text.trim().split('\n');
    const parsed = [];
    let err = '';

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('name')) return; // header skip
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        const [name, hallTicket, branch, room, seat, status] = parts;
        parsed.push({
          id: `STU-CSV-${index + 100}`,
          name: name || `Cadet #${index}`,
          hallTicket: hallTicket || `HT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
          branch: branch || 'Computer Science & AI',
          room: room || 'LH-302',
          seat: seat || `Seat ${index + 1}`,
          status: status || 'Verified Safe',
          photo: PRESET_AVATARS[index % PRESET_AVATARS.length].url,
          faceConfidence: 98.4,
          entryDecision: 'Allowed',
          entryAllowed: true,
          verificationCompleted: true
        });
      }
    });

    if (parsed.length === 0) {
      err = "No valid records found. Format: Name, HallTicket, Branch, Room, Seat, Status";
    }
    setBulkError(err);
    setParsedBulkStudents(parsed);
  };

  // Submit Bulk Batch
  const handleSubmitBatch = async () => {
    if (parsedBulkStudents.length === 0) return;
    setIsSubmitting(true);
    try {
      if (onAddStudent) {
        await onAddStudent(parsedBulkStudents);
      }
      alert(`Successfully registered ${parsedBulkStudents.length} cadets into Supabase!`);
      if (onNavigateToDashboard) onNavigateToDashboard();
    } catch (err) {
      alert("Bulk registration error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      
      {/* Dynamic Cyber Header Banner */}
      <div className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden shadow-2xl transition-all ${
        isLight
          ? 'bg-gradient-to-r from-blue-50 via-indigo-50/60 to-white border-blue-200 text-slate-900'
          : 'bg-gradient-to-r from-[#0d1326] via-[#101935] to-[#0a0e1a] border-blue-500/30 text-white'
      }`}>
        {/* Animated Cyber Gridlines & Glows */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none opacity-40" />
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 animate-spin" />
                QUANTUM ENROLLMENT SUITE v4.2
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                SUPABASE DB SYNC ACTIVE
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Biometric Student Registration
            </h1>
            <p className={`text-xs sm:text-sm font-medium mt-1 max-w-2xl ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Enroll new examinees into the AI surveillance neural registry. Registered cadets are instantly synchronized across all autonomous rover units and proctoring command terminals.
            </p>
          </div>

          {/* Mode Selector Tabs */}
          <div className={`p-1.5 rounded-2xl border flex items-center gap-1 shrink-0 ${
            isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-[#151c33] border-slate-800'
          }`}>
            <button
              onClick={() => setEnrollmentMode('single')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                enrollmentMode === 'single'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : isLight ? 'text-slate-700 hover:bg-slate-300/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Single Cadet</span>
            </button>
            <button
              onClick={() => setEnrollmentMode('batch')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                enrollmentMode === 'batch'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : isLight ? 'text-slate-700 hover:bg-slate-300/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Bulk CSV Import</span>
            </button>
          </div>
        </div>

        {/* Biometric Readiness Progress Bar */}
        {enrollmentMode === 'single' && (
          <div className="mt-6 pt-6 border-t border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 font-mono text-xs font-bold">
                <Fingerprint className="h-4 w-4 text-blue-400" />
                <span>BIOMETRIC READINESS:</span>
                <span className={`text-sm font-extrabold ${readinessScore >= 80 ? 'text-emerald-400' : readinessScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {readinessScore}%
                </span>
              </div>
              <div className="flex-1 max-w-md h-2 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    readinessScore >= 80 ? 'bg-gradient-to-r from-blue-500 to-emerald-400' : readinessScore >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${readinessScore}%` }}
                />
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-blue-400" />
              <span>256-BIT ENCRYPTED NEURAL REGISTRY</span>
            </div>
          </div>
        )}
      </div>


      {/* SINGLE STUDENT ENROLLMENT MODE */}
      {enrollmentMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={handleSubmitSingle} className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 transition-all ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#0b1021] border-slate-800'
            }`}>
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-400" />
                  Cadet Credentials & Details
                </h3>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">STEP 1 OF 2</span>
              </div>

              {/* Name & Hall Ticket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-slate-300">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sophia Vance"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-2xl text-sm font-medium border outline-none transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-blue-500 focus:bg-white text-slate-900'
                        : 'bg-[#12182c] border-slate-800 focus:border-blue-500/80 focus:bg-[#161d36] text-white'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Hall Ticket ID <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateHallTicket}
                      className="text-[10px] font-mono font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" /> Auto-Gen
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="HT-2026-XXXXX"
                      value={formData.hallTicket}
                      onChange={(e) => setFormData(prev => ({ ...prev, hallTicket: e.target.value }))}
                      className={`w-full px-4 py-3 rounded-2xl text-sm font-mono font-semibold border outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900'
                          : 'bg-[#12182c] border-slate-800 focus:border-blue-500/80 text-white'
                      }`}
                    />
                    <Hash className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Department & Exam Hall */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-slate-300">
                    Department / Branch
                  </label>
                  <select
                    value={formData.branch}
                    onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-2xl text-xs font-semibold border outline-none transition-all cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900'
                        : 'bg-[#12182c] border-slate-800 focus:border-blue-500/80 text-white'
                    }`}
                  >
                    {BRANCH_OPTIONS.map(b => (
                      <option key={b} value={b} className="bg-slate-900 text-white">{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-slate-300">
                    Assigned Exam Hall
                  </label>
                  <select
                    value={formData.room}
                    onChange={(e) => setFormData(prev => ({ ...prev, room: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-2xl text-xs font-semibold border outline-none transition-all cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900'
                        : 'bg-[#12182c] border-slate-800 focus:border-blue-500/80 text-white'
                    }`}
                  >
                    {ROOM_OPTIONS.map(r => (
                      <option key={r} value={r} className="bg-slate-900 text-white">{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seat & Initial Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-slate-300">
                    Seat Designation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aisle B - Seat 15"
                    value={formData.seat}
                    onChange={(e) => setFormData(prev => ({ ...prev, seat: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-2xl text-xs font-medium border outline-none transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900'
                        : 'bg-[#12182c] border-slate-800 focus:border-blue-500/80 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-slate-300">
                    Initial Security Clearance Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-2xl text-xs font-semibold border outline-none transition-all cursor-pointer ${
                      formData.status === 'Verified Safe'
                        ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
                        : formData.status === 'Suspicious'
                        ? 'text-amber-400 border-amber-500/40 bg-amber-950/20'
                        : 'text-rose-400 border-rose-500/40 bg-rose-950/20'
                    }`}
                  >
                    <option value="Verified Safe" className="bg-slate-900 text-emerald-400">Verified Safe (Green)</option>
                    <option value="Suspicious" className="bg-slate-900 text-amber-400">Suspicious (Amber Watch)</option>
                    <option value="Device Detected" className="bg-slate-900 text-rose-400">Device Detected (Red Alert)</option>
                  </select>
                </div>
              </div>

              {/* Conditional Alert Detail Fields */}
              {formData.status === 'Device Detected' && (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-3 animate-in fade-in">
                  <label className="block text-xs font-bold text-rose-300">Flagged Device Name / Signature</label>
                  <input
                    type="text"
                    placeholder="e.g. Bluetooth Earpiece RF 2.4GHz"
                    value={formData.detectedDevice}
                    onChange={(e) => setFormData(prev => ({ ...prev, detectedDevice: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-900 border border-rose-500/30 text-rose-200 outline-none"
                  />
                </div>
              )}

              {formData.status === 'Suspicious' && (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3 animate-in fade-in">
                  <label className="block text-xs font-bold text-amber-300">Suspicion Telemetry Flag Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Frequent lateral gaze towards desk B"
                    value={formData.suspicionReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, suspicionReason: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-900 border border-amber-500/30 text-amber-200 outline-none"
                  />
                </div>
              )}


              {/* Photo & Biometric Scanner Section */}
              <div className="pt-4 border-t border-slate-800/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-400" />
                    Biometric Photo & Facial Mesh Selection
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-400">99.4% AI Match Confidence</span>
                </div>

                {/* Preset Avatars Bar */}
                <div>
                  <span className="block text-[11px] text-slate-400 mb-2 font-medium">Quick Preset Profiles:</span>
                  <div className="grid grid-cols-6 gap-2">
                    {PRESET_AVATARS.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, photo: av.url }));
                          triggerBiometricScan();
                        }}
                        className={`relative rounded-xl overflow-hidden border-2 aspect-square transition-all cursor-pointer group ${
                          formData.photo === av.url ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/30' : 'border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                        {formData.photo === av.url && (
                          <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Photo Upload & Live Camera Capture */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                      isLight ? 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800' : 'bg-[#131a30] border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <Upload className="h-4 w-4 text-blue-400" />
                    Upload Custom Photo File
                  </button>

                  <button
                    type="button"
                    onClick={toggleCameraStream}
                    className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                      isCameraActive ? 'bg-rose-600 text-white border-rose-500' : 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                    }`}
                  >
                    <Camera className="h-4 w-4" />
                    {isCameraActive ? 'Cancel Optical Scan' : 'Live Camera Feed Scan'}
                  </button>
                </div>

                {/* Live Video Canvas Modal preview if camera active */}
                {isCameraActive && (
                  <div className="relative rounded-2xl overflow-hidden border border-blue-500/50 bg-black p-2 flex flex-col items-center">
                    <video ref={videoRef} autoPlay playsInline className="w-full max-h-64 object-cover rounded-xl" />
                    <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-400/60 rounded-2xl m-3 flex items-center justify-center">
                      <div className="w-32 h-32 border border-blue-400 rounded-full animate-ping opacity-30" />
                    </div>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="mt-3 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg cursor-pointer"
                    >
                      SNAP & EXTRACT BIOMETRIC VECTOR
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white font-extrabold text-sm tracking-wide uppercase shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    PERSISTING CADET TO SUPABASE DATABASE...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 fill-current" />
                    REGISTER CADET TO DATABASE
                  </>
                )}
              </button>

            </form>
          </div>


          {/* Right Column: 3D Holographic ID Card Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-6 sticky top-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-400" />
                Live Holographic ID Pass Preview
              </h3>
              <span className="text-[10px] font-mono text-blue-400 flex items-center gap-1">
                <Radio className="h-3 w-3 animate-pulse" /> 3D INTERACTIVE TILT
              </span>
            </div>

            {/* 3D Hologram Card */}
            <div
              ref={cardRef}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              style={{ ...tiltStyle, transition: 'transform 0.15s ease-out' }}
              className="relative rounded-3xl p-6 overflow-hidden border border-blue-500/40 bg-gradient-to-br from-[#0d1428] via-[#101a35] to-[#070b15] shadow-2xl text-white select-none group"
            >
              {/* Scanlines & Hologram Watermark */}
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.4)_51%)] bg-[size:100%_4px] pointer-events-none opacity-40" />
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              
              {/* Top Security Header */}
              <div className="flex items-center justify-between pb-4 border-b border-blue-500/30 relative z-10">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-blue-400" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">EXAMSHIELD ACADEMIC PASS</h4>
                    <p className="text-[9px] font-mono text-slate-400">STATE UNIVERSITY SURVEILLANCE</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                  formData.status === 'Verified Safe'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : formData.status === 'Suspicious'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {formData.status}
                </span>
              </div>

              {/* Student Photo & Reticle Grid */}
              <div className="my-5 flex gap-4 items-center relative z-10">
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-blue-500/60 shrink-0 bg-slate-900 shadow-inner">
                  <img
                    src={formData.photo}
                    alt={formData.name}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Cyber Facial Scan Mesh Overlay */}
                  <div className="absolute inset-0 border border-blue-400/40 rounded-2xl pointer-events-none flex flex-col justify-between p-1">
                    <div className="flex justify-between">
                      <div className="w-2 h-2 border-t-2 border-l-2 border-blue-400" />
                      <div className="w-2 h-2 border-t-2 border-r-2 border-blue-400" />
                    </div>
                    {scanProgress < 100 && (
                      <div
                        className="w-full h-0.5 bg-blue-400 shadow-[0_0_8px_#3b82f6] transition-all duration-75"
                        style={{ marginTop: `${scanProgress}%` }}
                      />
                    )}
                    <div className="flex justify-between">
                      <div className="w-2 h-2 border-b-2 border-l-2 border-blue-400" />
                      <div className="w-2 h-2 border-b-2 border-r-2 border-blue-400" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest block">REGISTERED EXAMINEE</span>
                  <h3 className="text-lg font-black truncate text-white leading-tight">
                    {formData.name || 'Full Name'}
                  </h3>
                  <p className="text-xs font-mono font-bold text-slate-300 tracking-wider">
                    {formData.hallTicket || 'HT-2026-XXXXX'}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 truncate">
                    {formData.branch}
                  </p>
                </div>
              </div>

              {/* Location Details Grid */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono relative z-10">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Exam Hall Room</span>
                  <span className="font-bold text-slate-200">{formData.room}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Seat Allocation</span>
                  <span className="font-bold text-slate-200">{formData.seat}</span>
                </div>
              </div>

              {/* Bottom Holographic Watermark Bar */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 relative z-10">
                <div className="flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-blue-400" />
                  <span>NEURAL EMBEDDING OK</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-amber-400" />
                  <span>VERIFIED PROCTOR</span>
                </div>
              </div>

            </div>

            {/* Quick Helper Banner */}
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#0f152a] border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2 font-bold text-slate-200">
                <Database className="h-4 w-4 text-blue-400" />
                Real-Time Database Sync Info
              </div>
              <p className="text-[11px] leading-relaxed">
                When you click <strong className="text-blue-400">Register Cadet to Database</strong>, ExamShield instantly pushes this record to the Supabase PostgreSQL <code className="text-xs text-blue-300 font-mono">public.students</code> table.
              </p>
            </div>

          </div>

        </div>
      )}


      {/* BULK CSV IMPORT MODE */}
      {enrollmentMode === 'batch' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#0b1021] border-slate-800'
          }`}>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2 text-white">
                <FileSpreadsheet className="h-5 w-5 text-blue-400" />
                Bulk Cadet CSV Roster Import
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Paste or import a list of students in CSV format. Format: <code className="font-mono text-blue-300">Name, HallTicket, Branch, Room, Seat, Status</code>
              </p>
            </div>

            {/* Sample CSV Format snippet */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">CSV Template Format:</div>
              <div className="text-emerald-400">Name, HallTicket, Branch, Room, Seat, Status</div>
              <div>Arjun Mehta, HT-2026-90112, Computer Science & AI, LH-302, Seat 01, Verified Safe</div>
              <div>Priya Sharma, HT-2026-90113, Cyber Security & Forensics, LH-304, Seat 04, Suspicious</div>
              <div>Rohan Verma, HT-2026-90114, Robotics & Automation, Main Lab, Seat 12, Verified Safe</div>
            </div>

            {/* Textarea Input */}
            <div>
              <label className="block text-xs font-semibold mb-2 text-slate-300">
                Paste CSV Contents Here
              </label>
              <textarea
                rows={6}
                value={bulkCsvText}
                onChange={(e) => handleParseCsv(e.target.value)}
                placeholder="Paste CSV lines here..."
                className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-blue-500"
              />
            </div>

            {bulkError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {bulkError}
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedBulkStudents.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>PRE-FLIGHT VALIDATION: {parsedBulkStudents.length} CADETS READY</span>
                  <span className="text-emerald-400">VALID FORMAT</span>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-2 space-y-1">
                  {parsedBulkStudents.map((s, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-900/80 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-3">
                        <img src={s.photo} alt={s.name} className="h-7 w-7 rounded-full object-cover" />
                        <div>
                          <span className="font-bold text-white block">{s.name}</span>
                          <span className="text-[10px] text-slate-400">{s.hallTicket} · {s.branch}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-300 block">{s.room} - {s.seat}</span>
                        <span className={`text-[10px] ${s.status === 'Verified Safe' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSubmitBatch}
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Database className="h-4 w-4" />
                  IMPORT & SAVE {parsedBulkStudents.length} CADETS TO SUPABASE
                </button>
              </div>
            )}

          </div>
        </div>
      )}


      {/* SUCCESS MODAL OVERLAY */}
      {successModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-[#0e162c] to-[#070b15] border border-blue-500/50 shadow-2xl text-center space-y-6">
            
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 animate-bounce" />
            </div>

            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-extrabold block mb-1">
                SUPABASE DATABASE INSERTION SUCCESSFUL
              </span>
              <h2 className="text-2xl font-extrabold text-white">Cadet Enrolled!</h2>
              <p className="text-xs text-slate-300 mt-2">
                <strong className="text-white">{successModal.name}</strong> ({successModal.hallTicket}) has been registered and synced with all ground-patrolling rovers.
              </p>
            </div>

            {/* Quick Pass Info Card */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left text-xs font-mono space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Hall:</span>
                <span className="text-white font-bold">{successModal.room} ({successModal.seat})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branch:</span>
                <span className="text-white font-bold">{successModal.branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clearance:</span>
                <span className="text-emerald-400 font-bold">{successModal.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSuccessModal(null);
                  setFormData(prev => ({
                    ...prev,
                    name: '',
                    hallTicket: '',
                    status: 'Verified Safe'
                  }));
                  generateHallTicket();
                }}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                + Add Another
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessModal(null);
                  if (onNavigateToDashboard) onNavigateToDashboard();
                }}
                className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-600/30"
              >
                Go to Dashboard →
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
