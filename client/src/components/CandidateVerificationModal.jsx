import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  RefreshCw,
  Sparkles,
  Search,
  Scan,
  Maximize2,
  Cpu,
  Power
} from 'lucide-react';
import jsQR from 'jsqr';
import { cosineSimilarity, parseEmbedding } from '../services/embeddingService';
import { getBucketPublicUrl } from '../services/storageService';

const MATCH_THRESHOLD = 0.65; // FaceNet standard cosine similarity threshold (65.0%)
const EMBED_SERVER_URL = import.meta.env.VITE_EMBED_SERVER_URL || 'http://localhost:5005/embed';

export default function CandidateVerificationModal({
  isOpen,
  onClose,
  exam,
  students = [],
  initialStudent = null,
  onUpdateStatus,
  theme = 'dark',
  piConnected = false,
  fvRunning = false,
  fvEnabled = false,
  canToggleFV = false,
  onToggleFaceVerification = null,
  error = null,
  busy = false,
  fvProgress = null,
  modelPhase = null
}) {
  const isLight = theme === 'light';

  // State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [qrScanning, setQrScanning] = useState(true);
  const [qrDetectedText, setQrDetectedText] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [browserCameraEnabled, setBrowserCameraEnabled] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Filter assigned students for search selection
  const filteredStudents = students.filter(s => {
    const student = s.student || s;
    const q = studentSearch.toLowerCase().trim();
    if (!q) return true;
    const name = (student.name || '').toLowerCase();
    const id = (student.hallTicket || student.id || s.student_id || '').toLowerCase();
    return name.includes(q) || id.includes(q);
  });

  // Start webcam
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('[VerificationModal] Camera start error:', err);
      setCameraError('Could not access laptop webcam. Please grant camera permission.');
      setIsCameraActive(false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Camera management when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (initialStudent) {
        setSelectedStudent(initialStudent);
        setQrScanning(false);
      } else {
        setSelectedStudent(null);
        setQrScanning(true);
      }
      setVerificationResult(null);
      setQrDetectedText(null);
      if (!fvRunning && browserCameraEnabled) {
        startCamera();
      } else {
        stopCamera();
      }
    } else {
      stopCamera();
      setSelectedStudent(null);
      setVerificationResult(null);
      setQrDetectedText(null);
      setQrScanning(true);
      setBrowserCameraEnabled(false);
    }
    return () => stopCamera();
  }, [isOpen, initialStudent, fvRunning, browserCameraEnabled]);

  // QR Scanning Loop using jsQR on video canvas
  useEffect(() => {
    if (!isCameraActive || !qrScanning || selectedStudent) return;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    scanIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        const decoded = code.data.trim();
        setQrDetectedText(decoded);

        // Find candidate by decoded ID or Hall Ticket
        const matched = students.find(s => {
          const student = s.student || s;
          const sid = String(student.id || s.student_id || '').trim();
          const ticket = String(student.hallTicket || '').trim();
          return decoded === sid || decoded === ticket || decoded.includes(sid);
        });

        if (matched) {
          setSelectedStudent(matched);
          setQrScanning(false);
          setVerificationResult(null);
        }
      }
    }, 250);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isCameraActive, qrScanning, selectedStudent, students]);

  // Execute Real Biometric Face Verification
  const handleVerifyFace = async () => {
    if (!selectedStudent || !videoRef.current) return;
    const student = selectedStudent.student || selectedStudent;
    const storedEmbedding = parseEmbedding(student.faceEmbedding);

    if (!storedEmbedding) {
      setVerificationResult({
        success: false,
        error: 'Candidate has no valid FaceNet 512-D embedding enrolled in database. Please enroll biometric photo first.'
      });
      return;
    }

    setVerifying(true);
    setVerificationResult(null);

    try {
      // 1. Capture current frame from live laptop webcam
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageB64 = canvas.toDataURL('image/jpeg', 0.95);

      // 2. Transmit to FaceNet Microserver (embedding_server.py)
      const res = await fetch(EMBED_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: imageB64 })
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Microserver error (HTTP ${res.status})`);
      }

      if (!Array.isArray(body.embedding) || body.embedding.length !== 512) {
        throw new Error('Server did not return a valid 512-D FaceNet embedding vector.');
      }

      // 3. Compute real Cosine Similarity between live webcam embedding and enrolled database embedding
      const liveEmbedding = body.embedding.map(Number);
      const similarity = cosineSimilarity(liveEmbedding, storedEmbedding);
      const matchPercentage = Math.max(0, Math.min(100, similarity * 100));
      const passed = similarity >= MATCH_THRESHOLD;

      const result = {
        success: passed,
        similarity: similarity,
        matchPercentage: matchPercentage.toFixed(1),
        thresholdPercentage: (MATCH_THRESHOLD * 100).toFixed(1),
        faceCount: body.face_count || 1,
        liveDims: liveEmbedding.length,
        timestamp: new Date().toISOString(),
        candidateName: student.name,
        candidateId: student.id || selectedStudent.student_id
      };

      setVerificationResult(result);

      // 4. Update status in Supabase exam_students
      if (onUpdateStatus && selectedStudent.student_id) {
        const nextStatus = passed ? 'verified' : 'failed';
        await onUpdateStatus(selectedStudent.student_id, nextStatus);
      }
    } catch (err) {
      console.error('[CandidateVerification] Verification failed:', err);
      setVerificationResult({
        success: false,
        error: err.message || 'Face verification failed.'
      });
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  const currentStudent = selectedStudent ? (selectedStudent.student || selectedStudent) : null;
  const currentPhoto = currentStudent ? (getBucketPublicUrl(currentStudent.photo) || currentStudent.photo) : null;
  const hasStoredEmbedding = currentStudent ? Boolean(parseEmbedding(currentStudent.faceEmbedding)) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0b0f19] border-slate-800 text-white'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Candidate Verification Station
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  REAL AI (FaceNet 512D)
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Exam: <strong className="text-slate-200">{exam?.exam_name || 'Active Exam'}</strong> • Zone: {exam?.room || 'LH-302'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {cameraError && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Camera Viewport */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2 font-mono">
                  <Camera className="h-4 w-4 text-blue-400" />
                  Camera Viewport
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  fvRunning
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 animate-pulse'
                    : isCameraActive
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {fvRunning
                    ? 'Python Runtime Active'
                    : isCameraActive
                    ? (qrScanning ? 'Scanning for QR…' : 'Face Ready')
                    : 'Camera Idle'}
                </span>
              </div>

              {/* Mode 1: Python Runtime is Actively Running */}
              {fvRunning ? (
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0d1322] border border-emerald-500/40 p-6 flex flex-col items-center justify-center text-center shadow-lg">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-2 animate-pulse">
                    <Cpu className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    Python Laptop Pi Runtime Active
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  </span>
                  <p className="text-xs text-slate-400 font-mono mt-1 max-w-sm">
                    OpenCV live preview window is running on your desktop. The Python worker is scanning candidate QR codes and running FaceNet 512-D identity verification.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    {onToggleFaceVerification && (
                      <button
                        onClick={onToggleFaceVerification}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 text-xs font-bold font-mono cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Power className="h-3.5 w-3.5" /> Stop Face Verification
                      </button>
                    )}
                  </div>
                </div>
              ) : !browserCameraEnabled ? (
                /* Mode 2: Idle (Prompt to start Python Runtime or enable Browser Fallback) */
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0d1322] border border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-inner">
                  <div className={`p-3.5 rounded-2xl border mb-2 ${
                    piConnected ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                  }`}>
                    <Camera className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-bold text-white">
                    {piConnected ? 'Python Laptop Pi Runtime Connected' : 'Python Pi Bridge Offline'}
                  </span>
                  <p className="text-xs text-slate-400 font-mono mt-1 max-w-sm">
                    {piConnected
                      ? 'Start face verification to open the laptop webcam in the Python runtime. Candidate QR scanning and FaceNet matching will run directly on the webcam.'
                      : 'Start the Python bridge (python hardware/raspberry_pi_bridge.py) or enable browser webcam fallback.'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {piConnected && onToggleFaceVerification && (
                      <button
                        onClick={onToggleFaceVerification}
                        disabled={!canToggleFV}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold font-mono cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Power className="h-3.5 w-3.5" /> Start Face Verification (Python Runtime)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setBrowserCameraEnabled(true);
                        startCamera();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer transition-all border border-slate-700"
                    >
                      Use Browser Webcam Fallback
                    </button>
                  </div>
                </div>
              ) : (
                /* Mode 3: Browser Webcam Fallback */
                <>
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {isCameraActive && qrScanning && !selectedStudent && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 bg-black/30">
                        <div className="h-44 w-44 rounded-2xl border-2 border-dashed border-blue-400/80 animate-pulse flex items-center justify-center relative">
                          <div className="absolute inset-x-0 h-0.5 bg-blue-400 animate-bounce top-1/2" />
                          <QrCode className="h-10 w-10 text-blue-400/60" />
                        </div>
                        <span className="mt-3 text-[11px] font-mono font-bold text-white bg-black/60 px-3 py-1 rounded-full border border-white/20">
                          Hold Student QR Code up to Camera
                        </span>
                      </div>
                    )}

                    {isCameraActive && selectedStudent && !verificationResult && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                        <div className="h-52 w-40 rounded-full border-2 border-dashed border-emerald-400/70" />
                        <span className="mt-2 text-[10px] font-mono font-bold text-emerald-300 bg-black/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          Center Candidate Face Inside Oval
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {selectedStudent ? (
                      <>
                        <button
                          onClick={handleVerifyFace}
                          disabled={verifying || !isCameraActive}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                        >
                          {verifying ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Running FaceNet Inference…</span>
                            </>
                          ) : (
                            <>
                              <Scan className="h-4 w-4" />
                              <span>Capture & Verify Face Biometric</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudent(null);
                            setVerificationResult(null);
                            setQrScanning(true);
                          }}
                          className="py-2.5 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
                          title="Clear candidate and rescan QR"
                        >
                          Rescan QR
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setQrScanning(true)}
                        className="w-full py-2 px-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-mono flex items-center justify-center gap-2"
                      >
                        <QrCode className="h-4 w-4" />
                        <span>Point Candidate QR Code at Laptop Camera</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Candidate Profile & Verification Decision */}
            <div className="space-y-4">
              {selectedStudent ? (
                <div className={`p-5 rounded-2xl border space-y-4 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121626] border-slate-800'
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
                      Identified Candidate
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                      ID: {currentStudent?.id || selectedStudent.student_id}
                    </span>
                  </div>

                  {/* Student Details Strip */}
                  <div className="flex items-start gap-4">
                    {currentPhoto ? (
                      <img
                        src={currentPhoto}
                        alt=""
                        className="h-16 w-16 rounded-2xl object-cover border border-slate-700 shrink-0 shadow-md"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <User className="h-8 w-8" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <h3 className="text-base font-bold truncate">
                        {currentStudent?.name}
                      </h3>
                      <div className="text-xs font-mono text-slate-400">
                        Hall Ticket: <strong className="text-slate-200">{currentStudent?.hallTicket || currentStudent?.id}</strong>
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        Branch: <strong className="text-slate-200">{currentStudent?.branch || 'CSE'}</strong> • Seat: <strong className="text-slate-200">{currentStudent?.seat || '01'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Embedding status */}
                  <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11px] font-mono flex items-center justify-between">
                    <span className="text-slate-400">Database Biometric:</span>
                    {hasStoredEmbedding ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled (512-D FaceNet)
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> No Embedding Enrolled
                      </span>
                    )}
                  </div>

                  {/* Verification Outcome Card */}
                  {verificationResult && (
                    <div className={`p-4 rounded-2xl border space-y-2 animate-in zoom-in-95 duration-150 ${
                      verificationResult.success
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                          {verificationResult.success ? (
                            <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Biometric Verified — Entry Allowed</>
                          ) : (
                            <><XCircle className="h-4 w-4 text-rose-400" /> Verification Failed — Mismatch</>
                          )}
                        </span>
                        {verificationResult.matchPercentage && (
                          <span className="text-sm font-extrabold font-mono">
                            {verificationResult.matchPercentage}% Match
                          </span>
                        )}
                      </div>

                      {verificationResult.similarity != null && (
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1 text-slate-300 border-t border-white/10">
                          <div>
                            Cosine Sim: <strong>{verificationResult.similarity.toFixed(4)}</strong>
                          </div>
                          <div>
                            Threshold: <strong>{MATCH_THRESHOLD.toFixed(4)} (65.0%)</strong>
                          </div>
                        </div>
                      )}

                      {verificationResult.error && (
                        <p className="text-xs text-rose-300 font-mono mt-1">
                          {verificationResult.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`p-5 rounded-2xl border space-y-4 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121626] border-slate-800'
                }`}>
                  <span className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider block">
                    Or Select Candidate Manually
                  </span>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search candidates by name or ID…"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#151a2d] border-slate-800 text-white placeholder-slate-500'
                      }`}
                    />
                  </div>

                  {/* Candidates List */}
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {filteredStudents.slice(0, 8).map(s => {
                      const student = s.student || s;
                      const sid = s.student_id || student.id;
                      const hasEmb = Boolean(parseEmbedding(student.faceEmbedding));
                      return (
                        <button
                          key={sid}
                          onClick={() => {
                            setSelectedStudent(s);
                            setQrScanning(false);
                            setVerificationResult(null);
                          }}
                          className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isLight
                              ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-900'
                              : 'bg-[#151a2d] border-slate-800 hover:border-slate-700 text-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{student.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 block truncate">
                              ID: {student.hallTicket || sid}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                            hasEmb ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          }`}>
                            {hasEmb ? '512D Ready' : 'No Embedding'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>FaceNet InceptionResnetV1 • MTCNN Face Alignment • Supabase Postgres</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
