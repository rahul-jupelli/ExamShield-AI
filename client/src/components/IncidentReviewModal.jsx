import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Image as ImageIcon,
  AlertTriangle,
  ZoomIn,
  Check,
  Building
} from 'lucide-react';
import { formatKolkata } from '../utils/timezone';
import { getEvidenceSignedUrl } from '../services/examService';

export default function IncidentReviewModal({
  incident,
  exam,
  assignedStudents = [],
  onUpdateReview,
  onClose,
  theme = 'dark',
  role = '',
  currentReviewer = 'Admin Officer'
}) {
  const isLight = theme === 'light';
  const canReview = ['Admin', 'Exam Controller', 'Operator'].includes(role);

  const [selectedStudentId, setSelectedStudentId] = useState(incident?.student_id || '');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [resolvedEvidenceUrls, setResolvedEvidenceUrls] = useState([]);
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomImage, setZoomImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Resolve signed URLs for all evidence images
  useEffect(() => {
    let isMounted = true;
    async function resolveUrls() {
      if (!incident?.evidence_paths || incident.evidence_paths.length === 0) {
        setResolvedEvidenceUrls([]);
        setLoadingUrls(false);
        return;
      }
      setLoadingUrls(true);
      try {
        const urls = await Promise.all(
          incident.evidence_paths.map(async (path) => {
            const url = await getEvidenceSignedUrl(path);
            return url || path;
          })
        );
        if (isMounted) {
          setResolvedEvidenceUrls(urls);
        }
      } catch (err) {
        console.warn('Error resolving signed evidence URLs:', err);
      } finally {
        if (isMounted) setLoadingUrls(false);
      }
    }
    resolveUrls();
    return () => { isMounted = false; };
  }, [incident]);

  const handleDecision = async (reviewStatus) => {
    if (isSubmitting || !canReview) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onUpdateReview(incident.id, {
        review_status: reviewStatus,
        student_id: selectedStudentId ? selectedStudentId : null,
        reviewed_by: currentReviewer
      });
      onClose();
    } catch (err) {
      console.error('Failed to update incident review:', err);
      setErrorMsg(err.message || 'Failed to save review decision to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0f1422] border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4.5 border-b ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#141a2c]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Incident Review & Evidence Audit
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400">
                  ID: {incident.id?.slice(0, 8)}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Examination: {exam?.exam_name || 'Scheduled Exam'} · Hall: {exam?.room || 'LH-302'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Key Incident Metadata Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-3 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Device Class</span>
              <span className="text-xs font-bold text-rose-400 mt-0.5 block truncate">
                {incident.detected_class}
              </span>
            </div>

            <div className={`p-3 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Model Confidence</span>
              <span className="text-xs font-bold text-amber-400 mt-0.5 block">
                {incident.confidence ? `${(incident.confidence * (incident.confidence > 1 ? 1 : 100)).toFixed(1)}%` : '—'}
              </span>
            </div>

            <div className={`p-3 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Evidence Frames</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-bold font-mono">
                  {incident.qualifying_frames || (incident.evidence_paths?.length || 0)} Frames
                </span>
                {incident.evidence_complete ? (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Complete (20)
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Fewer than 20 frames before timeout">
                    Incomplete (&lt;20)
                  </span>
                )}
              </div>
            </div>

            <div className={`p-3 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Captured At (IST)</span>
              <span className="text-xs font-bold font-mono mt-0.5 block truncate">
                {formatKolkata(incident.created_at, 'short')}
              </span>
            </div>
          </div>

          {/* Evidence Image Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Chronological Captured Frames ({resolvedEvidenceUrls.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Click any frame to inspect full-size
              </span>
            </div>

            {loadingUrls ? (
              <div className="h-64 rounded-2xl border border-slate-800 flex items-center justify-center font-mono text-xs text-slate-400">
                <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                Retrieving authenticated signed evidence frames...
              </div>
            ) : resolvedEvidenceUrls.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-700 text-center font-mono text-xs text-slate-400">
                No visual evidence frames uploaded for this detection.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Main Selected Frame */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-80 flex items-center justify-center group">
                  <img
                    src={resolvedEvidenceUrls[activeImageIndex]}
                    alt={`Evidence frame ${activeImageIndex + 1}`}
                    className="max-h-full max-w-full object-contain cursor-pointer"
                    onClick={() => setZoomImage(resolvedEvidenceUrls[activeImageIndex])}
                  />
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-mono text-white border border-white/10">
                    Frame {activeImageIndex + 1} of {resolvedEvidenceUrls.length}
                  </div>
                  <button
                    onClick={() => setZoomImage(resolvedEvidenceUrls[activeImageIndex])}
                    className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10"
                    title="Zoom Image"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>

                {/* Thumbnail Strip */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {resolvedEvidenceUrls.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-16 w-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-black ${
                        activeImageIndex === idx ? 'border-blue-500 shadow-md scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student Association Section */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
          }`}>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Student Responsibility Association
              </h4>
            </div>

            <p className="text-[11px] text-slate-400">
              Only associate a student if photographic or RF telemetry evidence conclusively identifies them.
              If multiple students are in the frame or identity is ambiguous, leave unassociated or dismiss.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400 uppercase">
                Associated Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1c2236] border-slate-700 text-white'
                }`}
              >
                <option value="">(No specific student assigned / Ambiguous Scene)</option>
                {assignedStudents.map((s) => {
                  const studentObj = s.student || s;
                  return (
                    <option key={studentObj.id} value={studentObj.id}>
                      {studentObj.name} ({studentObj.hallTicket || studentObj.id}) — {studentObj.seat || 'Seat'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Audit Trail (if previously reviewed) */}
          {incident.reviewed_by && (
            <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>Reviewed By: <strong className="text-slate-200">{incident.reviewed_by}</strong></span>
              <span>Reviewed At: {formatKolkata(incident.reviewed_at, 'full')}</span>
              <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                incident.review_status === 'confirmed' ? 'text-rose-400 bg-rose-500/20' : 'text-slate-300 bg-slate-500/20'
              }`}>
                {incident.review_status}
              </span>
            </div>
          )}

        </div>

        {/* Actions Footer */}
        <div
          className={`px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#141a2c]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {!canReview ? (
              <span className="text-xs font-mono text-slate-500 p-2 bg-slate-900/50 rounded-xl border border-slate-800">
                Audit decisions restricted to Operator, Exam Controller, or Admin roles.
              </span>
            ) : (
              <>
                {/* Dismiss False Positive */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('dismissed')}
                  className="px-4 py-2 rounded-xl border border-slate-600 hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="h-4 w-4 text-slate-400" />
                  Dismiss False Positive
                </button>

                {/* Keep Pending */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('pending')}
                  className="px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Clock className="h-4 w-4" />
                  Keep Pending
                </button>

                {/* Confirm Violation */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('confirmed')}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirm Violation
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomImage(null)}
        >
          <img src={zoomImage} alt="Full view" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" />
          <button
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer"
            onClick={() => setZoomImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}
