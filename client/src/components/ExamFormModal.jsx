import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Users, 
  Search, 
  CheckSquare, 
  Square, 
  AlertCircle, 
  Building,
  Check,
  UserCheck
} from 'lucide-react';
import { kolkataInputsToIso, isoToKolkataInputs } from '../utils/timezone';
import { getBucketPublicUrl } from '../services/storageService';

export default function ExamFormModal({
  exam = null, // null for create, object for edit
  allStudents = [],
  assignedStudentIds = [],
  onSave,
  onClose,
  theme = 'dark',
  examHalls = ['LH-302', 'LH-304', 'Auditorium-1', 'Main Lab']
}) {
  const isLight = theme === 'light';
  const isEdit = Boolean(exam && exam.id);

  // Form states
  const [examName, setExamName] = useState(exam?.exam_name || '');
  const [room, setRoom] = useState(exam?.room || examHalls[0] || 'LH-302');

  // Parse initial dates into Asia/Kolkata inputs
  const initialStartInputs = useMemo(() => {
    if (exam?.start_time) return isoToKolkataInputs(exam.start_time);
    // Default to tomorrow 09:00 AM IST
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { date } = isoToKolkataInputs(tomorrow.toISOString());
    return { date, time: '09:00' };
  }, [exam]);

  const initialEndInputs = useMemo(() => {
    if (exam?.end_time) return isoToKolkataInputs(exam.end_time);
    return { date: initialStartInputs.date, time: '12:00' };
  }, [exam, initialStartInputs]);

  const [examDate, setExamDate] = useState(initialStartInputs.date);
  const [startTime, setStartTime] = useState(initialStartInputs.time);
  const [endTime, setEndTime] = useState(initialEndInputs.time);

  // Selected student IDs (Set)
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set(assignedStudentIds));

  // Sync state if exam or assignedStudentIds prop changes
  useEffect(() => {
    if (exam) {
      setExamName(exam.exam_name || '');
      setRoom(exam.room || examHalls[0] || 'LH-302');
      if (exam.start_time) {
        const start = isoToKolkataInputs(exam.start_time);
        setExamDate(start.date);
        setStartTime(start.time);
      }
      if (exam.end_time) {
        const end = isoToKolkataInputs(exam.end_time);
        setEndTime(end.time);
      }
    }
  }, [exam, examHalls]);

  useEffect(() => {
    setSelectedStudentIds(new Set(assignedStudentIds || []));
  }, [assignedStudentIds]);

  // Student filter and search state
  const [studentSearch, setStudentSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');

  // Error and saving status
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available unique branches
  const branches = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => {
      if (s.branch) set.add(s.branch);
    });
    return Array.from(set);
  }, [allStudents]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    return allStudents.filter(s => {
      if (branchFilter !== 'ALL' && s.branch !== branchFilter) return false;
      if (!q) return true;
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const ticketMatch = (s.hallTicket || '').toLowerCase().includes(q);
      const roomMatch = (s.room || '').toLowerCase().includes(q);
      return nameMatch || ticketMatch || roomMatch;
    });
  }, [allStudents, studentSearch, branchFilter]);

  // Check if all filtered are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedStudentIds.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const toggleSelectAllFiltered = () => {
    const next = new Set(selectedStudentIds);
    if (allFilteredSelected) {
      filteredStudents.forEach(s => next.delete(s.id));
    } else {
      filteredStudents.forEach(s => next.add(s.id));
    }
    setSelectedStudentIds(next);
  };

  const toggleStudent = (id) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!examName.trim()) {
      setErrorMsg('Exam title is required.');
      return;
    }
    if (!examDate || !startTime || !endTime) {
      setErrorMsg('Please select a valid date, start time, and end time in Asia/Kolkata (IST).');
      return;
    }

    const startIso = kolkataInputsToIso(examDate, startTime);
    const endIso = kolkataInputsToIso(examDate, endTime);

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    if (isNaN(startMs) || isNaN(endMs)) {
      setErrorMsg('Invalid time input format.');
      return;
    }

    if (endMs <= startMs) {
      setErrorMsg('The scheduled end time must be after the start time.');
      return;
    }

    if (selectedStudentIds.size === 0) {
      setErrorMsg('Please select at least one student for this exam.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        exam_name: examName.trim(),
        start_time: startIso,
        end_time: endIso,
        room,
      }, Array.from(selectedStudentIds));
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save examination schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#0f1422] border-slate-800 text-slate-100'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-5 border-b ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#141a2c]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {isEdit ? 'Edit Examination Schedule' : 'Schedule New Examination'}
              </h2>
              <p className="text-xs text-slate-400">
                Operating in Asia/Kolkata (IST · UTC+05:30)
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

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Exam Name */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Examination Title *
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g., Computer Systems Architecture (CS-301) Midterm"
                className={`w-full px-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#161c2e] border-slate-700 text-white placeholder-slate-500'
                }`}
                required
              />
            </div>

            {/* Room / Hall Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" /> Examination Hall / Rover Zone *
              </label>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#161c2e] border-slate-700 text-white'
                }`}
              >
                {examHalls.map((hall) => (
                  <option key={hall} value={hall}>
                    {hall}
                  </option>
                ))}
              </select>
            </div>

            {/* Exam Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Exam Date (IST) *
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#161c2e] border-slate-700 text-white'
                }`}
                required
              />
            </div>

            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-400" /> Start Time (IST) *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#161c2e] border-slate-700 text-white'
                }`}
                required
              />
              <p className="text-[10px] text-slate-400 font-mono">
                Verification window opens 60 minutes before start time.
              </p>
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" /> End Time (IST) *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-[#161c2e] border-slate-700 text-white'
                }`}
                required
              />
              <p className="text-[10px] text-slate-400 font-mono">
                Device detection ends and status transitions to completed.
              </p>
            </div>
          </div>

          {/* Student Assignment Section */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Assigned Students ({selectedStudentIds.size} Selected)
                </h3>
              </div>
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer font-mono font-medium transition-colors ${
                  allFilteredSelected
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    : 'bg-[#1c2236] border-slate-700 text-slate-300 hover:bg-[#252c44]'
                }`}
              >
                {allFilteredSelected ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" /> Deselect All Filtered ({filteredStudents.length})
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" /> Select All Filtered ({filteredStudents.length})
                  </>
                )}
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filter students by name, hall ticket, or seat..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-[#161c2e] border-slate-700 text-white placeholder-slate-500'
                  }`}
                />
              </div>
              <div>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-[#161c2e] border-slate-700 text-white'
                  }`}
                >
                  <option value="ALL">All Branches</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student Picker Grid */}
            <div
              className={`max-h-64 overflow-y-auto rounded-2xl border p-2 space-y-1.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121624] border-slate-800'
              }`}
            >
              {filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-mono">
                  No registered students match the filter criteria.
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = selectedStudentIds.has(s.id);
                  const photoSrc = getBucketPublicUrl(s.photo) || s.photo;
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? isLight
                            ? 'bg-blue-50 border-blue-300 shadow-sm'
                            : 'bg-blue-600/15 border-blue-500/40 text-white'
                          : isLight
                          ? 'bg-white border-slate-200 hover:bg-slate-100'
                          : 'bg-[#161b2d] border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-4.5 w-4.5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : isLight
                              ? 'border-slate-300 bg-white'
                              : 'border-slate-600 bg-[#1e2438]'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>

                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-600/40"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-700/50 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-slate-400" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <span className="block text-xs font-bold truncate">
                            {s.name}
                          </span>
                          <span className="block text-[10px] font-mono text-slate-400 truncate">
                            {s.hallTicket || s.id} · {s.branch || 'Engineering'} · {s.room || 'Hall'} ({s.seat || 'Seat'})
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isSelected
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                            : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                        }`}>
                          {isSelected ? 'Assigned' : 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Form Actions Footer */}
          <div
            className={`pt-4 border-t flex items-center justify-between gap-3 ${
              isLight ? 'border-slate-200' : 'border-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-colors ${
                isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wide uppercase shadow-lg shadow-blue-600/25 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Exam...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  {isEdit ? 'Update Examination' : 'Confirm & Schedule Exam'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
