import { supabase } from '../lib/supabase.js';
import { apiFetch } from './apiClient.js';

export const EVIDENCE_BUCKET = 'incident-evidence';

// Valid status constraints according to specification
export const EXAM_STATUSES = ['scheduled', 'verification', 'device_detection', 'completed', 'cancelled'];
export const VERIFICATION_STATUSES = ['unverified', 'verified', 'failed', 'absent'];
export const REVIEW_STATUSES = ['pending', 'confirmed', 'dismissed', 'approved', 'rejected'];

/**
 * Normalizes review status aliases so both ('confirmed', 'dismissed') and ('approved', 'rejected') work seamlessly.
 */
export function normalizeReviewStatus(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'approved' || s === 'confirmed') return 'confirmed';
  if (s === 'rejected' || s === 'dismissed') return 'dismissed';
  if (s === 'pending') return 'pending';
  return status;
}

// Local storage cache keys for caching actual records (no fake seed data)
const CACHE_KEY_EXAMS = 'examshield_exams_cache_v1';
const CACHE_KEY_EXAM_STUDENTS = 'examshield_exam_students_cache_v1';
const CACHE_KEY_INCIDENTS = 'examshield_device_incidents_cache_v1';

function loadCache(key, fallback = []) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveCache(key, data) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('[ExamService] Cache save error:', e);
  }
}

/**
 * Calculates the authoritative lifecycle status for an exam
 * based strictly on official time windows:
 * - cancelled: always stays cancelled
 * - >= end_time: 'completed'
 * - >= start_time: 'device_detection'
 * - >= start_time - 60min: 'verification'
 * - < start_time - 60min: 'scheduled'
 */
export function calculateAuthoritativeStatus(exam) {
  if (!exam) return 'scheduled';
  if (exam.status === 'cancelled') return 'cancelled';

  const now = Date.now();
  const start = new Date(exam.start_time).getTime();
  const end = new Date(exam.end_time).getTime();

  if (isNaN(start) || isNaN(end)) return exam.status || 'scheduled';

  if (now >= end) {
    return 'completed';
  }
  if (now >= start) {
    return 'device_detection';
  }
  const verificationWindowStart = start - 60 * 60 * 1000; // 60 minutes prior
  if (now >= verificationWindowStart) {
    return 'verification';
  }
  return 'scheduled';
}

/**
 * Normalizes verification status across all Supabase schemas (exam_students and students table).
 * Returns: 'verified' | 'failed' | 'absent' | 'unverified'
 * Based strictly on the status / verification_status column in Supabase (not using entryDecision).
 */
export function getStudentVerificationStatus(record) {
  if (!record) return 'unverified';

  // Direct explicit verification_status (on assignedRecord or student)
  const direct = String(record.verification_status || record.student?.verification_status || '').toLowerCase().trim();
  if (['verified', 'failed', 'absent', 'unverified'].includes(direct)) {
    return direct;
  }

  const s = record.student || record;
  const status = String(s.status || '').toLowerCase().trim();

  // 1. Check for Verified based strictly on status column
  if (status === 'verified') {
    return 'verified';
  }

  // 2. Check for Failed / Flagged
  if (status === 'failed' || status === 'flagged') {
    return 'failed';
  }

  // 3. Check for Absent
  if (status === 'absent') {
    return 'absent';
  }

  // 4. Default: Verification pending / unverified
  return 'unverified';
}

const FV_WINDOW_MS = 60 * 60 * 1000;

/**
 * Face verification window boundaries: [start_time - 60min, start_time)
 */
export function getFVWindow(exam) {
  const start = new Date(exam.start_time).getTime();
  return { windowStart: start - FV_WINDOW_MS, windowEnd: start };
}

/** True while now is inside the face verification window. */
export function isInFVWindow(exam, now = Date.now()) {
  if (!exam) return false;
  const { windowStart, windowEnd } = getFVWindow(exam);
  return now >= windowStart && now < windowEnd;
}

/** True while now is inside the exam (device detection) window: [start_time, end_time) */
export function isInDDWindow(exam, now = Date.now()) {
  if (!exam) return false;
  const start = new Date(exam.start_time).getTime();
  const end = new Date(exam.end_time).getTime();
  return now >= start && now < end;
}

/**
 * Start/stop a model running on the Raspberry Pi 4.
 * model: 'face_verification' | 'device_detection'; action: 'start' | 'stop'
 * Throws with the server/Pi error message on failure.
 */
export async function sendModelControl(exam, model, action, options = {}) {
  const switchModel = Boolean(exam?.switchModel || options?.switchModel);
  const res = await apiFetch('/api/rover/model-control', {
    method: 'POST',
    body: JSON.stringify({
      examId: exam.id,
      model,
      action,
      switchModel,
      // fallback only; the server prefers the schedule stored in the database
      start_time: exam.start_time,
      end_time: exam.end_time
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Model control failed (${res.status})`);
  }
  return body;
}

/** Current model state reported by the Pi 4 (+ per-exam lifecycle flags). Never throws. */
export async function getModelStatus(examId) {
  try {
    const qs = examId ? `?examId=${encodeURIComponent(examId)}` : '';
    const res = await apiFetch(`/api/rover/model-status${qs}`);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return { piConnected: false, activeModel: 'none', examId: null, status: 'stopped' };
  }
}

/**
 * Fetches all exams from Express API (with Supabase fallback)
 */
export async function getExams() {
  let backendError = null;
  try {
    const res = await apiFetch('/api/exams');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveCache(CACHE_KEY_EXAMS, data);
        return data;
      }
    } else {
      const body = await res.json().catch(() => ({}));
      backendError = new Error(body.error || `Server responded with status ${res.status}`);
    }
  } catch (err) {
    backendError = err;
    if (err.status === 401 || err.status === 403) throw err;
  }

  // Supabase fallback query with active session credentials
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('start_time', { ascending: true });

    if (!error && Array.isArray(data)) {
      saveCache(CACHE_KEY_EXAMS, data);
      return data;
    }
    if (error) {
      throw new Error(error.message || backendError?.message || 'Failed to load exams.');
    }
  } catch (err) {
    console.error('[ExamService] Failed to load exams:', err);
    throw backendError || err;
  }

  return [];
}

/**
 * Fetches single exam by ID
 */
export async function getExamById(id) {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn('[ExamService] Supabase getExamById notice:', err.message);
  }

  const all = await getExams();
  return all.find(e => e.id === id) || null;
}

/**
 * Creates a new exam and assigns students via backend API (with Supabase fallback)
 */
export async function createExam(examData, studentIds = []) {
  if (!examData.exam_name?.trim()) {
    throw new Error('Exam name is required.');
  }
  if (!examData.start_time || !examData.end_time) {
    throw new Error('Exam start time and end time are required.');
  }
  const start = new Date(examData.start_time).getTime();
  const end = new Date(examData.end_time).getTime();
  if (end <= start) {
    throw new Error('Exam end time must follow the start time.');
  }

  // Conflict check for same room / rover
  try {
    const existingExams = await getExams();
    const hasConflict = existingExams.some(e => {
      if (e.status === 'cancelled') return false;
      if (e.room && examData.room && e.room !== examData.room) return false;
      const eStart = new Date(e.start_time).getTime();
      const eEnd = new Date(e.end_time).getTime();
      return start < eEnd && end > eStart;
    });

    if (hasConflict) {
      throw new Error(`Schedule conflict: Exam room (${examData.room || 'LH-302'}) is already scheduled for another active exam during this time slot.`);
    }
  } catch (err) {
    if (err.message.includes('Schedule conflict')) throw err;
    console.warn('[ExamService] Conflict check notice:', err.message);
  }

  const initialStatus = calculateAuthoritativeStatus(examData);
  const examPayload = {
    exam_name: examData.exam_name.trim(),
    start_time: examData.start_time,
    end_time: examData.end_time,
    status: initialStatus,
    room: examData.room || 'LH-302'
  };

  // 1. Prefer Express API endpoint
  let apiError = null;
  try {
    const res = await apiFetch('/api/exams', {
      method: 'POST',
      body: JSON.stringify({ exam: examPayload, student_ids: studentIds })
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.success && body.exam) {
      const cachedExams = loadCache(CACHE_KEY_EXAMS, []);
      saveCache(CACHE_KEY_EXAMS, [body.exam, ...cachedExams.filter(e => e.id !== body.exam.id)]);
      return body.exam;
    }
    apiError = new Error(body.error || `Server responded with ${res.status}`);
  } catch (err) {
    apiError = err;
    if (err.status === 401 || err.status === 403) throw err;
  }

  // 2. Direct Supabase fallback
  try {
    let insertRecord = { ...examPayload };
    let { data, error } = await supabase
      .from('exams')
      .insert([insertRecord])
      .select()
      .single();

    // If 'room' column doesn't exist in the database schema (PostgreSQL error 42703), retry without it
    if (error && (error.code === '42703' || String(error.message).includes('room'))) {
      const { room: _omittedRoom, ...withoutRoom } = insertRecord;
      const retry = await supabase
        .from('exams')
        .insert([withoutRoom])
        .select()
        .single();
      if (retry.error) throw new Error(retry.error.message);
      data = { ...retry.data, room: examPayload.room };
      error = null;
    }

    if (error) {
      throw new Error(error.message || apiError?.message || 'Failed to create exam in database.');
    }

    const createdExam = data;
    const cachedExams = loadCache(CACHE_KEY_EXAMS, []);
    saveCache(CACHE_KEY_EXAMS, [createdExam, ...cachedExams.filter(e => e.id !== createdExam.id)]);

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      await assignStudentsToExam(createdExam.id, studentIds, createdExam.status);
    }

    return createdExam;
  } catch (err) {
    console.error('[ExamService] Failed to create exam:', err);
    throw apiError || err;
  }
}

/**
 * Updates an existing exam via Express API (with Supabase fallback)
 */
export async function updateExam(id, examData, studentIds = null) {
  if (!examData.exam_name?.trim()) {
    throw new Error('Exam name is required.');
  }
  const start = new Date(examData.start_time).getTime();
  const end = new Date(examData.end_time).getTime();
  if (end <= start) {
    throw new Error('Exam end time must follow the start time.');
  }

  try {
    const existingExams = await getExams();
    const hasConflict = existingExams.some(e => {
      if (e.id === id || e.status === 'cancelled') return false;
      if (e.room && examData.room && e.room !== examData.room) return false;
      const eStart = new Date(e.start_time).getTime();
      const eEnd = new Date(e.end_time).getTime();
      return start < eEnd && end > eStart;
    });

    if (hasConflict) {
      throw new Error(`Schedule conflict: Exam room (${examData.room || 'LH-302'}) is already scheduled for another active exam during this time slot.`);
    }
  } catch (err) {
    if (err.message.includes('Schedule conflict')) throw err;
    console.warn('[ExamService] Conflict check notice:', err.message);
  }

  const nextStatus = examData.status || calculateAuthoritativeStatus(examData);

  const updatePayload = {
    exam_name: examData.exam_name.trim(),
    start_time: examData.start_time,
    end_time: examData.end_time,
    room: examData.room || 'LH-302',
    status: nextStatus,
  };

  // 1. Try Express API
  let apiError = null;
  try {
    const res = await apiFetch(`/api/exams/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ exam: updatePayload, student_ids: studentIds })
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.success && body.exam) {
      const cached = loadCache(CACHE_KEY_EXAMS, []);
      saveCache(CACHE_KEY_EXAMS, cached.map(e => e.id === id ? { ...e, ...body.exam } : e));
      return body.exam;
    }
    apiError = new Error(body.error || `Server responded with ${res.status}`);
  } catch (err) {
    apiError = err;
    if (err.status === 401 || err.status === 403) throw err;
  }

  // 2. Direct Supabase update fallback
  try {
    let { data, error } = await supabase
      .from('exams')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error && (error.code === '42703' || String(error.message).includes('room'))) {
      const { room: _omittedRoom, ...withoutRoom } = updatePayload;
      const retry = await supabase
        .from('exams')
        .update({ ...withoutRoom, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (retry.error) throw new Error(retry.error.message);
      data = { ...retry.data, room: updatePayload.room };
      error = null;
    }

    if (error) throw new Error(error.message || apiError?.message || 'Failed to update exam.');

    const updated = data || { id, ...updatePayload };
    const cached = loadCache(CACHE_KEY_EXAMS, []);
    saveCache(CACHE_KEY_EXAMS, cached.map(e => e.id === id ? { ...e, ...updated } : e));

    if (Array.isArray(studentIds)) {
      await assignStudentsToExam(id, studentIds, updated.status);
    }

    return updated;
  } catch (err) {
    console.error('[ExamService] Failed to update exam:', err);
    throw apiError || err;
  }
}

/**
 * Cancels an exam via Express API (with Supabase fallback)
 */
export async function cancelExam(id) {
  let apiError = null;
  try {
    const res = await apiFetch(`/api/exams/${id}/cancel`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.success) {
      const cached = loadCache(CACHE_KEY_EXAMS, []);
      saveCache(CACHE_KEY_EXAMS, cached.map(e => e.id === id ? { ...e, status: 'cancelled' } : e));
      return true;
    }
    apiError = new Error(body.error || `Server responded with ${res.status}`);
  } catch (err) {
    apiError = err;
    if (err.status === 401 || err.status === 403) throw err;
  }

  try {
    const { error } = await supabase
      .from('exams')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message || apiError?.message || 'Failed to cancel exam.');
    const cached = loadCache(CACHE_KEY_EXAMS, []);
    saveCache(CACHE_KEY_EXAMS, cached.map(e => e.id === id ? { ...e, status: 'cancelled' } : e));
    return true;
  } catch (err) {
    console.error('[ExamService] Failed to cancel exam:', err);
    throw apiError || err;
  }
}

/**
 * Assigns students to an exam without duplicating
 */
export async function assignStudentsToExam(examId, studentIds, examStatus = 'scheduled') {
  const uniqueIds = Array.from(new Set(studentIds));
  const currentAssigned = await getExamStudents(examId);
  const currentMap = new Map(currentAssigned.map(s => [s.student_id, s]));

  const recordsToInsert = [];
  const initialVerification = 'unverified';

  for (const sId of uniqueIds) {
    const existing = currentMap.get(sId);
    if (!existing) {
      recordsToInsert.push({
        exam_id: examId,
        student_id: sId,
        verification_status: initialVerification,
        verified_at: null
      });
    }
  }

  if (recordsToInsert.length > 0) {
    try {
      await supabase.from('exam_students').upsert(recordsToInsert);
    } catch (err) {
      console.warn('[ExamService] Supabase upsert exam_students notice:', err.message);
    }

    const cachedAll = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
    saveCache(CACHE_KEY_EXAM_STUDENTS, [...cachedAll, ...recordsToInsert]);
  }

  // Remove students that were deselected
  const toDelete = currentAssigned
    .filter(s => !uniqueIds.includes(s.student_id))
    .map(s => s.student_id);

  if (toDelete.length > 0) {
    try {
      await supabase
        .from('exam_students')
        .delete()
        .eq('exam_id', examId)
        .in('student_id', toDelete);
    } catch (err) {
      console.warn('[ExamService] Supabase delete deselected students notice:', err.message);
    }

    const cachedAll = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
    saveCache(CACHE_KEY_EXAM_STUDENTS, cachedAll.filter(s => !(s.exam_id === examId && toDelete.includes(s.student_id))));
  }

  return getExamStudents(examId);
}

export function sortStudentsDeterministically(records) {
  if (!Array.isArray(records)) return [];
  return [...records].sort((a, b) => {
    const nameA = String(a.student?.name || a.name || '').toLowerCase();
    const nameB = String(b.student?.name || b.name || '').toLowerCase();
    const cmp = nameA.localeCompare(nameB);
    if (cmp !== 0) return cmp;
    const idA = String(a.student_id || a.student?.id || a.id || '');
    const idB = String(b.student_id || b.student?.id || b.id || '');
    return idA.localeCompare(idB);
  });
}

/**
 * Fetches assigned students for an exam, joined with student profile details.
 * Dynamically resolves real candidate verification status from Supabase (both exam_students and students tables).
 * Guarantees deterministic ordering by student name, then student ID.
 */
export async function getExamStudents(examId) {
  let records = null;

  // 1. Try Express backend
  try {
    const res = await apiFetch(`/api/exams/${examId}/students`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        records = data;
      }
    }
  } catch (apiErr) {
    console.warn('[ExamService] Backend getExamStudents notice:', apiErr.message);
  }

  // 2. Direct Supabase query if backend did not respond
  if (records === null) {
    try {
      const { data, error } = await supabase
        .from('exam_students')
        .select('*, student:students(*)')
        .eq('exam_id', examId);

      if (!error && Array.isArray(data)) {
        records = data;
      }
    } catch (err) {
      console.warn('[ExamService] Supabase getExamStudents notice:', err.message);
    }
  }

  if (records === null) {
    const cached = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
    records = cached.filter(s => s.exam_id === examId);
  }

  const normalized = (records || []).map(record => ({
    ...record,
    verification_status: getStudentVerificationStatus(record)
  }));

  const sorted = sortStudentsDeterministically(normalized);

  // Sync cache with deterministic list
  const cached = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
  const otherCached = cached.filter(s => s.exam_id !== examId);
  saveCache(CACHE_KEY_EXAM_STUDENTS, [...otherCached, ...sorted]);

  return sorted;
}

/**
 * Fetches comprehensive exam details with student counts and verification status.
 */
export async function getExamDetails(examId) {
  try {
    const res = await apiFetch(`/api/exams/${examId}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) return data;
    }
  } catch (err) {
    console.warn('[ExamService] Backend getExamDetails notice:', err.message);
  }
  return getExamById(examId);
}

/**
 * Updates a student's verification status for a specific exam and syncs with Supabase students table.
 * Fully checks and propagates errors so the UI never displays false success.
 */
export async function updateExamStudentVerification(examId, studentId, verificationStatus) {
  if (!VERIFICATION_STATUSES.includes(verificationStatus)) {
    throw new Error(`Invalid verification status: ${verificationStatus}`);
  }

  const verifiedAt = verificationStatus === 'verified' ? new Date().toISOString() : null;
  let updateSuccess = false;
  let lastError = null;

  // 1. Prefer Express backend (authorized via schedulerDb, syncs both exam_students & students)
  try {
    const res = await apiFetch(`/api/exams/${examId}/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify({ verification_status: verificationStatus })
    });
    if (res.ok) {
      updateSuccess = true;
    } else {
      const body = await res.json().catch(() => ({}));
      lastError = new Error(body.error || `Server responded with ${res.status}`);
    }
  } catch (apiErr) {
    lastError = apiErr;
    console.warn('[ExamService] Backend update verification notice, trying Supabase fallback:', apiErr.message);
  }

  // 2. Direct Supabase fallback if backend call failed
  if (!updateSuccess) {
    try {
      const { error: examStudentErr } = await supabase
        .from('exam_students')
        .upsert({
          exam_id: examId,
          student_id: studentId,
          verification_status: verificationStatus,
          verified_at: verifiedAt
        });

      if (examStudentErr) {
        throw new Error(examStudentErr.message);
      }
      updateSuccess = true;

      // Best-effort sync to students table
      const isVerified = verificationStatus === 'verified';
      await supabase
        .from('students')
        .update({
          status: isVerified ? 'Verified' : 'Pending',
          entryDecision: isVerified ? 'Allowed' : verificationStatus === 'failed' ? 'Denied' : 'Pending',
          verificationCompleted: isVerified,
          entryAllowed: isVerified
        })
        .eq('id', studentId);
    } catch (err) {
      console.error('[ExamService] Failed to update verification status:', err);
      throw lastError || err;
    }
  }

  // Update local cache
  const cached = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
  saveCache(
    CACHE_KEY_EXAM_STUDENTS,
    cached.map(s => {
      if (s.exam_id === examId && s.student_id === studentId) {
        return {
          ...s,
          verification_status: verificationStatus,
          verified_at: verifiedAt,
          student: s.student ? {
            ...s.student,
            status: verificationStatus === 'verified' ? 'Verified' : 'Pending',
            entryDecision: verificationStatus === 'verified' ? 'Allowed' : verificationStatus === 'failed' ? 'Denied' : 'Pending',
            verificationCompleted: verificationStatus === 'verified',
            entryAllowed: verificationStatus === 'verified'
          } : undefined
        };
      }
      return s;
    })
  );

  return true;
}

// Canonical alias per spec
export const verifyStudent = updateExamStudentVerification;

// Explicit device control helpers
export async function toggleFaceVerification(exam, enabled) {
  return sendModelControl(exam, 'face_verification', enabled ? 'start' : 'stop');
}

export async function pauseDeviceDetection(exam) {
  return sendModelControl(exam, 'device_detection', 'pause');
}

export async function resumeDeviceDetection(exam) {
  return sendModelControl(exam, 'device_detection', 'resume');
}

/**
 * Fetches device incidents for an exam
 */
export async function getExamIncidents(examId) {
  try {
    const res = await apiFetch(`/api/exams/${examId}/incidents`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (apiErr) {
    if (apiErr.status === 401 || apiErr.status === 403) throw apiErr;
    console.warn('[ExamService] Backend getExamIncidents notice:', apiErr.message);
  }

  try {
    const { data, error } = await supabase
      .from('device_incidents')
      .select('*, student:students(*)')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[ExamService] Failed to load exam incidents:', err);
    throw err;
  }
}

/**
 * Fetches all device incidents across all exams
 */
export async function getAllIncidents() {
  let backendError = null;
  try {
    const res = await apiFetch('/api/incidents');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveCache(CACHE_KEY_INCIDENTS, data);
        return data;
      }
    } else {
      const body = await res.json().catch(() => ({}));
      backendError = new Error(body.error || `Server responded with ${res.status}`);
    }
  } catch (apiErr) {
    backendError = apiErr;
    if (apiErr.status === 401 || apiErr.status === 403) throw apiErr;
  }

  try {
    const { data, error } = await supabase
      .from('device_incidents')
      .select('*, exam:exams(*), student:students(*)')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      saveCache(CACHE_KEY_INCIDENTS, data);
      return data;
    }
    if (error) throw new Error(error.message || backendError?.message || 'Failed to load incidents.');
  } catch (err) {
    console.error('[ExamService] Failed to load all incidents:', err);
    throw backendError || err;
  }

  return [];
}

/**
 * Updates an incident review decision (Confirm, Dismiss, or Pending; supports approved/rejected aliases)
 */
export async function updateIncidentReview(incidentId, { review_status, student_id, reviewed_by }) {
  const normalized = normalizeReviewStatus(review_status);
  if (!['pending', 'confirmed', 'dismissed'].includes(normalized)) {
    throw new Error(`Invalid review status: ${review_status}. Expected confirmed, dismissed, or pending.`);
  }

  const payload = {
    review_status: normalized,
    student_id: student_id !== undefined ? student_id : null,
    reviewed_by: reviewed_by || 'Admin Officer',
    reviewed_at: new Date().toISOString()
  };

  let apiError = null;
  // 1. Try Express backend
  try {
    const res = await apiFetch(`/api/incidents/${incidentId}/review`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.success) {
      const updatedIncident = body.incident || body.data;
      const cached = loadCache(CACHE_KEY_INCIDENTS, []);
      saveCache(
        CACHE_KEY_INCIDENTS,
        cached.map(i => i.id === incidentId ? { ...i, ...payload } : i)
      );
      return updatedIncident || true;
    }
    apiError = new Error(body.error || `Server responded with ${res.status}`);
  } catch (err) {
    apiError = err;
    if (err.status === 401 || err.status === 403) throw err;
  }

  // 2. Direct Supabase update fallback
  try {
    const { data, error } = await supabase
      .from('device_incidents')
      .update(payload)
      .eq('id', incidentId)
      .select('*, exam:exams(*), student:students(*)');

    if (error) throw new Error(error.message || apiError?.message || 'Failed to update incident in database.');
    if (!data || data.length === 0) {
      throw new Error(`Incident with ID ${incidentId} not found in database.`);
    }

    const cached = loadCache(CACHE_KEY_INCIDENTS, []);
    saveCache(
      CACHE_KEY_INCIDENTS,
      cached.map(i => i.id === incidentId ? { ...i, ...payload } : i)
    );

    return data[0] || true;
  } catch (err) {
    console.error('[ExamService] Failed to update incident review:', err);
    throw apiError || err;
  }
}

/**
 * Resolves a signed URL for an evidence image path from the private 'incident-evidence' bucket
 */
export async function getEvidenceSignedUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (typeof pathOrUrl === 'string' && (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:'))) {
    return pathOrUrl;
  }

  try {
    const cleanPath = String(pathOrUrl).replace(/^incident-evidence\//, '').replace(/^\/+/, '');
    const { data, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(cleanPath, 3600);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn('[ExamService] Error generating signed URL:', err);
  }

  // Fallback direct URL or placeholder if signed URL generation unavailable
  return pathOrUrl;
}

/**
 * Subscribes to real-time changes for exams, student verification, and incidents
 */
export function subscribeToExamUpdates(callback) {
  try {
    // Unique name per subscriber: supabase.channel() with an existing name returns the already-subscribed
    // channel, and adding listeners to it throws, which silently disabled realtime for later screens.
    const channelName = `examshield_exam_changes_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exams' },
        (payload) => callback && callback({ table: 'exams', ...payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_students' },
        (payload) => callback && callback({ table: 'exam_students', ...payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_incidents' },
        (payload) => callback && callback({ table: 'device_incidents', ...payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => callback && callback({ table: 'students', ...payload })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[ExamService] Realtime channel notice:', err.message);
    return () => {};
  }
}
