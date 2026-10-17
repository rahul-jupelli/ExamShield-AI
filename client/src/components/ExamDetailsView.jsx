import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Building,
  Users,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  UserX,
  Edit,
  Ban,
  RefreshCw,
  Eye,
  CameraOff,
  Radio,
  FileCheck2,
  AlertOctagon
} from 'lucide-react';
import ExamStatusBadge from './ExamStatusBadge';
import IncidentReviewModal from './IncidentReviewModal';
import ModelControlPanel from './ModelControlPanel';
import { formatKolkata, getRelativeTime } from '../utils/timezone';
import {
  getExamStudents,
  getExamIncidents,
  updateExamStudentVerification,
  updateIncidentReview,
  cancelExam,
  subscribeToExamUpdates,
  getStudentVerificationStatus
} from '../services/examService';
import { getBucketPublicUrl } from '../services/storageService';

export default function ExamDetailsView({
  exam,
  onBack,
  onEditExam,
  onRefresh,
  theme = 'dark',
  role = 'Admin',
  operatorName = 'Admin Officer'
}) {
  const isLight = theme === 'light';
  const isAdminOrController = ['Admin', 'Exam Controller'].includes(role);

  const [students, setStudents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Tab: 'verification' | 'incidents'
  const [activeTab, setActiveTab] = useState('verification');

  // Student search & verification status filter
  const [studentSearch, setStudentSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('ALL');

  // Incident status filter
  const [incidentFilter, setIncidentFilter] = useState('ALL');

  // Selected incident for review modal
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Load students and incidents
  const loadExamData = useCallback(async (silent = false) => {
    if (!exam?.id) return;
    if (!silent) setLoadingData(true);
    try {
      const [assigned, incs] = await Promise.all([
        getExamStudents(exam.id),
        getExamIncidents(exam.id)
      ]);
      setStudents(assigned || []);
      setIncidents(incs || []);
    } catch (err) {
      console.warn('Error loading exam details:', err);
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, [exam?.id]);

  useEffect(() => {
    loadExamData();
  }, [loadExamData]);

  // Polling fallback: keeps verification status fresh even when Supabase realtime
  // is not enabled for these tables (or the websocket drops).
  useEffect(() => {
    const t = setInterval(() => loadExamData(true), 5000);
    return () => clearInterval(t);
  }, [loadExamData]);

  // Subscribe to realtime updates for this exam
  useEffect(() => {
    const unsubscribe = subscribeToExamUpdates((payload) => {
      if (
        payload.table === 'exam_students' ||
        payload.table === 'device_incidents' ||
        payload.table === 'exams' ||
        payload.table === 'students'
      ) {
        loadExamData(true);
      }
    });
    return () => unsubscribe();
  }, [loadExamData]);

  // Calculate student verification statistics
  const verificationStats = useMemo(() => {
    const total = students.length;
    const verified = students.filter(s => getStudentVerificationStatus(s) === 'verified').length;
    const unverified = students.filter(s => getStudentVerificationStatus(s) === 'unverified').length;
    const failed = students.filter(s => getStudentVerificationStatus(s) === 'failed').length;
    const absent = students.filter(s => getStudentVerificationStatus(s) === 'absent').length;
    return { total, verified, unverified, failed, absent };
  }, [students]);

  // Incident statistics
  const incidentStats = useMemo(() => {
    const total = incidents.length;
    const pending = incidents.filter(i => i.review_status === 'pending').length;
    const confirmed = incidents.filter(i => i.review_status === 'confirmed').length;
    const dismissed = incidents.filter(i => i.review_status === 'dismissed').length;
    return { total, pending, confirmed, dismissed };
  }, [incidents]);

  // Map incidents count per student
  const studentIncidentCountMap = useMemo(() => {
    const map = new Map();
    incidents.forEach(inc => {
      if (inc.student_id) {
        map.set(inc.student_id, (map.get(inc.student_id) || 0) + 1);
      }
    });
    return map;
  }, [incidents]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    return students.filter(s => {
      const studentObj = s.student || s;
      const vStatus = getStudentVerificationStatus(s);
      if (verificationFilter !== 'ALL' && vStatus !== verificationFilter.toLowerCase()) return false;
      if (!q) return true;
      const name = (studentObj.name || '').toLowerCase();
      const ticket = (studentObj.hallTicket || studentObj.id || '').toLowerCase();
      const seat = (studentObj.seat || '').toLowerCase();
      return name.includes(q) || ticket.includes(q) || seat.includes(q);
    });
  }, [students, studentSearch, verificationFilter]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (incidentFilter !== 'ALL' && inc.review_status !== incidentFilter) return false;
      return true;
    });
  }, [incidents, incidentFilter]);

  // Handle student status change
  const handleUpdateStatus = async (studentId, nextStatus) => {
    try {
      await updateExamStudentVerification(exam.id, studentId, nextStatus);
      setStudents(prev =>
        prev.map(s => {
          if (s.student_id === studentId) {
            return {
              ...s,
              verification_status: nextStatus,
              verified_at: nextStatus === 'verified' ? new Date().toISOString() : null
            };
          }
          return s;
        })
      );
    } catch (err) {
      console.error('Failed to update student verification status:', err);
    }
  };

  // Handle Cancel Exam
  const handleCancelExam = async () => {
    if (!window.confirm(`Are you sure you want to cancel "${exam.exam_name}"? Once cancelled, it will not activate automatically.`)) {
      return;
    }
    try {
      await cancelExam(exam.id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to cancel exam:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold cursor-pointer transition-colors ${
            isLight
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              : 'bg-[#14192b] border-slate-800 text-slate-300 hover:bg-[#1a2037]'
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Examinations</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadExamData()}
            title="Refresh Data"
            className={`p-2 rounded-2xl border text-slate-400 hover:text-white cursor-pointer transition-colors ${
              isLight ? 'bg-white border-slate-300' : 'bg-[#14192b] border-slate-800'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
          </button>

          {isAdminOrController && exam.status !== 'cancelled' && (
            <>
              <button
                onClick={() => onEditExam(exam)}
                className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Edit Schedule</span>
              </button>

              <button
                onClick={handleCancelExam}
                className="px-4 py-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Cancel Exam</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Examination Banner */}
      <div
        className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0f1422] border-slate-800 text-white'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <ExamStatusBadge status={exam.status} theme={theme} size="lg" />
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-500/15 border border-slate-500/30 text-slate-400">
                Zone: {exam.room || 'LH-302'}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight">
              {exam.exam_name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-400" />
                {formatKolkata(exam.start_time, 'date')}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-400" />
                {formatKolkata(exam.start_time, 'time')} — {formatKolkata(exam.end_time, 'time')}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-400" />
                {students.length} Candidates Assigned
              </span>
            </div>
          </div>

          {/* Quick Metrics Pill Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-3 rounded-2xl border text-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Verified</span>
              <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
                {verificationStats.verified}/{verificationStats.total}
              </span>
            </div>

            <div className={`p-3 rounded-2xl border text-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Unverified</span>
              <span className="text-lg font-bold text-amber-400 font-mono mt-0.5 block">
                {verificationStats.unverified}
              </span>
            </div>

            <div className={`p-3 rounded-2xl border text-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Incidents</span>
              <span className="text-lg font-bold text-rose-400 font-mono mt-0.5 block">
                {incidentStats.total}
              </span>
            </div>

            <div className={`p-3 rounded-2xl border text-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151a2d] border-slate-800'
            }`}>
              <span className="block text-[10px] font-mono text-slate-400 uppercase">Pending Review</span>
              <span className="text-lg font-bold text-amber-400 font-mono mt-0.5 block">
                {incidentStats.pending}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Hardware Rover Integration Status (Real State) */}
      <div
        className={`p-5 rounded-3xl border transition-all ${
          isLight
            ? 'bg-slate-50 border-slate-200'
            : 'bg-[#0f1422] border-slate-800/80'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-slate-500/10 border border-slate-500/20 text-slate-400 shrink-0">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">
                  Raspberry Pi 4 Inference System
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-500/20 border border-slate-500/30 text-slate-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Standby / Disconnected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live edge rover inference pipeline is not yet connected. Ready to receive YOLOv8/RF detection telemetry and frames from the Raspberry Pi 4 inference worker.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] font-mono text-slate-400 block">
              Configured Room: <strong className="text-slate-200">{exam.room || 'LH-302'}</strong>
            </span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
              Protocol: REST + WebSocket /api/rover
            </span>
          </div>
        </div>
      </div>

      {/* AI Model Control: Face Verification -> Device Detection on the Pi 4 */}
      <ModelControlPanel
        exam={exam}
        students={students}
        theme={theme}
        canControl={role !== 'Viewer'}
      />

      {/* Navigation Sub-Tabs: Verification vs Incidents */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('verification')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer transition-all ${
            activeTab === 'verification'
              ? 'bg-blue-600 text-white shadow-sm'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-[#161c2e]'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Per-Exam Student Verification</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {students.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer transition-all ${
            activeTab === 'incidents'
              ? 'bg-rose-600 text-white shadow-sm'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-[#161c2e]'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Device Incidents & Evidence Review</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {incidents.length}
          </span>
          {incidentStats.pending > 0 && (
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>
      </div>

      {/* TAB 1: Student Verification View */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search candidates by name, hall ticket, or seat..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#151a2d] border-slate-800 text-white placeholder-slate-500'
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'ALL', label: 'All', count: verificationStats.total },
                { id: 'unverified', label: 'Unverified', count: verificationStats.unverified },
                { id: 'verified', label: 'Verified', count: verificationStats.verified },
                { id: 'failed', label: 'Failed', count: verificationStats.failed },
                { id: 'absent', label: 'Absent', count: verificationStats.absent },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setVerificationFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border cursor-pointer transition-all ${
                    verificationFilter === f.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : isLight
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-[#151a2d] border-slate-800 text-slate-400 hover:bg-[#1e2540]'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {/* Verification Status Notice */}
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2.5 font-mono">
            <Radio className="h-4 w-4 text-blue-400 shrink-0" />
            <span>
              Per-exam verification status is stored independently in Supabase. Verification outcomes remain locked across page refreshes and realtime sync cycles.
            </span>
          </div>

          {/* Students Grid */}
          {loadingData ? (
            <div className="py-16 text-center font-mono text-xs text-slate-400">
              <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading assigned candidate verification roster...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center font-mono text-xs text-slate-400 rounded-3xl border border-dashed border-slate-800">
              No assigned candidates found matching the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredStudents.map((assignedRecord) => {
                const s = assignedRecord.student || assignedRecord;
                const photoSrc = getBucketPublicUrl(s.photo) || s.photo;
                const vStatus = getStudentVerificationStatus(assignedRecord);
                const incCount = studentIncidentCountMap.get(assignedRecord.student_id) || 0;

                const statusStyles = {
                  unverified: {
                    badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                    label: 'Unverified',
                    icon: HelpCircle
                  },
                  verified: {
                    badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
                    label: 'Verified Entry',
                    icon: CheckCircle2
                  },
                  failed: {
                    badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
                    label: 'Verification Failed',
                    icon: XCircle
                  },
                  absent: {
                    badge: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
                    label: 'Absent',
                    icon: UserX
                  }
                }[vStatus] || {
                  badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                  label: 'Unverified',
                  icon: HelpCircle
                };

                const StatusIcon = statusStyles.icon;

                return (
                  <div
                    key={assignedRecord.student_id}
                    className={`p-4 rounded-3xl border flex flex-col justify-between gap-3 transition-all ${
                      isLight
                        ? 'bg-white border-slate-200 shadow-sm'
                        : 'bg-[#121626] border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Student Card Top */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {photoSrc ? (
                            <img
                              src={photoSrc}
                              alt=""
                              className="h-11 w-11 rounded-2xl object-cover shrink-0 border border-slate-600/40"
                            />
                          ) : (
                            <div className="h-11 w-11 rounded-2xl bg-slate-700/50 flex items-center justify-center shrink-0">
                              <Users className="h-5 w-5 text-slate-400" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <h4 className="text-sm font-bold truncate">
                              {s.name}
                            </h4>
                            <span className="text-[11px] font-mono text-slate-400 block truncate">
                              {s.hallTicket || assignedRecord.student_id}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${statusStyles.badge}`}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusStyles.label}</span>
                        </span>
                      </div>

                      {/* Location / Meta Strip */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-1">
                        <div>
                          Branch: <strong className="text-slate-300">{s.branch || 'CSE'}</strong>
                        </div>
                        <div>
                          Seat: <strong className="text-slate-300">{s.seat || 'Seat 01'}</strong>
                        </div>
                      </div>

                      {/* Associated Incidents Flag */}
                      {incCount > 0 && (
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-mono flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                            {incCount} Device Incident{incCount > 1 ? 's' : ''} Logged
                          </span>
                          <button
                            onClick={() => {
                              setActiveTab('incidents');
                              setIncidentFilter('ALL');
                            }}
                            className="underline text-rose-400 hover:text-white cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Admin Status Actions */}
                    {isAdminOrController && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                        <span className="text-[9px] font-mono text-slate-500 uppercase">Override:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateStatus(assignedRecord.student_id, 'verified')}
                            title="Mark Verified"
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                              vStatus === 'verified'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            Pass
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(assignedRecord.student_id, 'failed')}
                            title="Mark Failed"
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                              vStatus === 'failed'
                                ? 'bg-rose-600 text-white'
                                : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                            }`}
                          >
                            Fail
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(assignedRecord.student_id, 'absent')}
                            title="Mark Absent"
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                              vStatus === 'absent'
                                ? 'bg-slate-600 text-white'
                                : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(assignedRecord.student_id, 'unverified')}
                            title="Reset to Unverified"
                            className="px-2 py-1 rounded-lg text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Device Incidents View */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'ALL', label: 'All Incidents', count: incidentStats.total },
                { id: 'pending', label: 'Pending Review', count: incidentStats.pending },
                { id: 'confirmed', label: 'Confirmed Violations', count: incidentStats.confirmed },
                { id: 'dismissed', label: 'Dismissed', count: incidentStats.dismissed },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setIncidentFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border cursor-pointer transition-all ${
                    incidentFilter === f.id
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : isLight
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-[#151a2d] border-slate-800 text-slate-400 hover:bg-[#1e2540]'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {/* Incidents Table / List */}
          {loadingData ? (
            <div className="py-16 text-center font-mono text-xs text-slate-400">
              <div className="h-6 w-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Retrieving incident records and visual evidence...
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-16 text-center font-mono text-xs text-slate-400 rounded-3xl border border-dashed border-slate-800">
              No device incidents recorded for this examination under the active filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map((incident) => {
                const studentAssigned = incident.student || students.find(s => s.student_id === incident.student_id)?.student;
                const statusStyles = {
                  pending: {
                    badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                    label: 'Pending Review'
                  },
                  confirmed: {
                    badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
                    label: 'Confirmed Violation'
                  },
                  dismissed: {
                    badge: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
                    label: 'Dismissed'
                  }
                }[incident.review_status] || {
                  badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                  label: 'Pending'
                };

                return (
                  <div
                    key={incident.id}
                    className={`p-4 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      isLight
                        ? 'bg-white border-slate-200 shadow-sm'
                        : 'bg-[#121626] border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-bold ${statusStyles.badge}`}>
                          {statusStyles.label}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {incident.detected_class}
                        </span>
                        <span className="text-xs font-mono text-amber-400">
                          Confidence: {(incident.confidence * (incident.confidence > 1 ? 1 : 100)).toFixed(1)}%
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                        <span>Incident: {incident.id?.slice(0, 8)}</span>
                        <span>Captured: {formatKolkata(incident.created_at, 'short')}</span>
                        <span>Frames: {incident.qualifying_frames || (incident.evidence_paths?.length || 0)}</span>
                        {incident.evidence_complete ? (
                          <span className="text-emerald-400 font-bold">✓ 20 Frames Collected</span>
                        ) : (
                          <span className="text-amber-400 font-bold" title="Fewer than 20 frames before timeout">
                            ⚠ Incomplete Evidence
                          </span>
                        )}
                        {studentAssigned && (
                          <span className="text-blue-400 font-bold">
                            Candidate: {studentAssigned.name} ({studentAssigned.hallTicket || studentAssigned.id})
                          </span>
                        )}
                      </div>

                      {incident.reviewed_by && (
                        <p className="text-[11px] font-mono text-slate-500">
                          Reviewed by {incident.reviewed_by} at {formatKolkata(incident.reviewed_at, 'short')}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedIncident(incident)}
                        className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect & Review</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Incident Review Modal */}
      {selectedIncident && (
        <IncidentReviewModal
          incident={selectedIncident}
          exam={exam}
          assignedStudents={students}
          theme={theme}
          currentReviewer={operatorName}
          onClose={() => setSelectedIncident(null)}
          onUpdateReview={async (id, data) => {
            await updateIncidentReview(id, data);
            loadExamData();
          }}
        />
      )}
    </div>
  );
}
