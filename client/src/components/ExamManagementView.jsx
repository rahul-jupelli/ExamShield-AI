import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Ban,
  Building,
  Users,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Cpu,
  AlertTriangle
} from 'lucide-react';
import ExamStatusBadge from './ExamStatusBadge';
import ExamFormModal from './ExamFormModal';
import ExamDetailsView from './ExamDetailsView';
import { formatKolkata, getRelativeTime } from '../utils/timezone';
import {
  getExams,
  createExam,
  updateExam,
  cancelExam,
  getExamStudents,
  subscribeToExamUpdates
} from '../services/examService';

export default function ExamManagementView({
  allStudents = [],
  theme = 'dark',
  role = 'Admin',
  operatorName = 'Admin Officer',
  examHalls = ['LH-302', 'LH-304', 'Auditorium-1', 'Main Lab']
}) {
  const isLight = theme === 'light';
  const isAdminOrController = ['Admin', 'Exam Controller'].includes(role);

  const [exams, setExams] = useState([]);
  const [examStudentCounts, setExamStudentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Active view navigation: 'list' | 'details'
  const [selectedExamId, setSelectedExamId] = useState(null);

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [editingAssignedIds, setEditingAssignedIds] = useState([]);

  // Fetch all exams
  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExams();
      setExams(data || []);

      // Load student counts per exam
      if (Array.isArray(data)) {
        const counts = {};
        for (const e of data) {
          try {
            const assigned = await getExamStudents(e.id);
            counts[e.id] = assigned?.length || 0;
          } catch {
            counts[e.id] = 0;
          }
        }
        setExamStudentCounts(counts);
      }
    } catch (err) {
      console.warn('Error loading exams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToExamUpdates((payload) => {
      if (payload.table === 'exams' || payload.table === 'exam_students') {
        loadExams();
      }
    });
    return () => unsubscribe();
  }, [loadExams]);

  // Computed summary metrics
  const stats = useMemo(() => {
    const total = exams.length;
    const verification = exams.filter(e => e.status === 'verification').length;
    const active = exams.filter(e => e.status === 'device_detection').length;
    const scheduled = exams.filter(e => e.status === 'scheduled').length;
    const completed = exams.filter(e => e.status === 'completed').length;
    return { total, verification, active, scheduled, completed };
  }, [exams]);

  // Filtered exams
  const filteredExams = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return exams.filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (!q) return true;
      const name = (e.exam_name || '').toLowerCase();
      const room = (e.room || '').toLowerCase();
      const id = (e.id || '').toLowerCase();
      return name.includes(q) || room.includes(q) || id.includes(q);
    });
  }, [exams, searchQuery, statusFilter]);

  // Handle open create modal
  const handleOpenCreate = () => {
    setEditingExam(null);
    setEditingAssignedIds([]);
    setModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = async (examToEdit) => {
    setEditingExam(examToEdit);
    try {
      const assigned = await getExamStudents(examToEdit.id);
      setEditingAssignedIds(assigned.map(s => s.student_id));
    } catch {
      setEditingAssignedIds([]);
    }
    setModalOpen(true);
  };

  // Handle save from modal
  const handleSaveExam = async (examData, studentIds) => {
    if (editingExam) {
      await updateExam(editingExam.id, examData, studentIds);
    } else {
      await createExam(examData, studentIds);
    }
    await loadExams();
  };

  // Handle cancel exam
  const handleCancel = async (id, name) => {
    if (!window.confirm(`Are you sure you want to cancel "${name}"? Once cancelled, it will not automatically activate.`)) {
      return;
    }
    try {
      await cancelExam(id);
      await loadExams();
    } catch (err) {
      console.error('Cancel exam failure:', err);
    }
  };

  // If viewing details for an exam
  if (selectedExamId) {
    const selectedExam = exams.find(e => e.id === selectedExamId);
    if (!selectedExam) {
      setSelectedExamId(null);
    } else {
      return (
        <ExamDetailsView
          exam={selectedExam}
          onBack={() => setSelectedExamId(null)}
          onEditExam={handleOpenEdit}
          onRefresh={loadExams}
          theme={theme}
          role={role}
          operatorName={operatorName}
        />
      );
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Header Section */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 border-b ${
        isLight ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Exam Management & Surveillance
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400">
              Asia/Kolkata (IST)
            </span>
          </div>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Schedule examinations, oversee candidate face verification, and review rover AI device detection incidents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadExams}
            title="Refresh List"
            className={`p-2.5 rounded-2xl border text-slate-400 hover:text-white cursor-pointer transition-colors ${
              isLight ? 'bg-white border-slate-300' : 'bg-[#121626] border-slate-800'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdminOrController && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 cursor-pointer transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Schedule New Exam</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Scheduled</span>
            <span className="text-2xl font-bold font-mono mt-1 block">{stats.total}</span>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Verification Phase</span>
            <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">{stats.verification}</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active Device Detection</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">{stats.active}</span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu className="h-5 w-5" />
          </div>
        </div>

        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Completed Sessions</span>
            <span className="text-2xl font-bold font-mono text-slate-400 mt-1 block">{stats.completed}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Search and Status Filtering Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search examinations by title, room, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-3.5 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#101424] border-slate-800 text-white placeholder-slate-500'
            }`}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: 'All Exams' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'verification', label: 'Verification' },
            { id: 'device_detection', label: 'Active Detection' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border cursor-pointer transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                  : isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'bg-[#101424] border-slate-800 text-slate-400 hover:bg-[#181d33]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Exams List / Empty / Loading States */}
      {loading ? (
        <div className="py-24 text-center font-mono text-xs text-slate-400">
          <div className="h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Synchronizing examination schedules and room registries...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border border-dashed border-slate-800 p-8 space-y-3">
          <Calendar className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Examinations Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No exams match the current search or status filter. Try clearing the filters.'
              : 'No examinations have been scheduled yet. Create your first scheduled exam to begin AI rover surveillance.'}
          </p>
          {isAdminOrController && (
            <button
              onClick={handleOpenCreate}
              className="mt-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Schedule Exam
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const studentCount = examStudentCounts[exam.id] || 0;
            return (
              <div
                key={exam.id}
                className={`p-5 rounded-3xl border flex flex-col justify-between gap-4 transition-all duration-200 ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                    : 'bg-[#101424] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar with Badge & Room */}
                  <div className="flex items-center justify-between gap-2">
                    <ExamStatusBadge status={exam.status} theme={theme} size="sm" />
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {exam.room || 'LH-302'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold tracking-tight line-clamp-2">
                    {exam.exam_name}
                  </h3>

                  {/* Date & Time Schedule in Asia/Kolkata */}
                  <div className="space-y-1.5 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>{formatKolkata(exam.start_time, 'date')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>
                        {formatKolkata(exam.start_time, 'time')} — {formatKolkata(exam.end_time, 'time')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span>{studentCount} Candidates Enrolled</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className={`pt-3 border-t flex items-center justify-between gap-2 ${
                  isLight ? 'border-slate-200' : 'border-slate-800/80'
                }`}>
                  <button
                    onClick={() => setSelectedExamId(exam.id)}
                    className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View & Monitor</span>
                  </button>

                  {isAdminOrController && exam.status !== 'cancelled' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(exam)}
                        title="Edit Exam"
                        className={`p-2 rounded-xl border text-slate-400 hover:text-white cursor-pointer transition-colors ${
                          isLight ? 'hover:bg-slate-100 border-slate-300' : 'hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleCancel(exam.id, exam.exam_name)}
                        title="Cancel Exam"
                        className="p-2 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-colors"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Exam Modal */}
      {modalOpen && (
        <ExamFormModal
          exam={editingExam}
          allStudents={allStudents}
          assignedStudentIds={editingAssignedIds}
          onSave={handleSaveExam}
          onClose={() => setModalOpen(false)}
          theme={theme}
          examHalls={examHalls}
        />
      )}
    </div>
  );
}
