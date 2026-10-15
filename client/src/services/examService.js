import { supabase } from '../lib/supabase.js';

export const EVIDENCE_BUCKET = 'incident-evidence';

// Valid status constraints according to specification
export const EXAM_STATUSES = ['scheduled', 'verification', 'device_detection', 'completed', 'cancelled'];
export const VERIFICATION_STATUSES = ['unverified', 'verified', 'failed', 'absent'];
export const REVIEW_STATUSES = ['pending', 'confirmed', 'dismissed'];

// Local storage cache keys for offline tolerance / before migration execution
const CACHE_KEY_EXAMS = 'examshield_exams_cache_v1';
const CACHE_KEY_EXAM_STUDENTS = 'examshield_exam_students_cache_v1';
const CACHE_KEY_INCIDENTS = 'examshield_device_incidents_cache_v1';

/**
 * Seed initial sample exam and incidents if storage is completely empty
 */
function getInitialSeedData() {
  const now = new Date();
  // Exam starting in 45 minutes (in verification phase)
  const startTime = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
  const endTime = new Date(now.getTime() + 165 * 60 * 1000).toISOString();

  const seedExam = {
    id: 'exam-seed-101',
    exam_name: 'Advanced Operating Systems Final Examination (CS-402)',
    start_time: startTime,
    end_time: endTime,
    status: 'verification',
    room: 'LH-302',
    created_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const seedExamStudents = [
    { exam_id: 'exam-seed-101', student_id: 's1', verification_status: 'unverified', verified_at: null },
    { exam_id: 'exam-seed-101', student_id: 's2', verification_status: 'verified', verified_at: new Date().toISOString() },
    { exam_id: 'exam-seed-101', student_id: 's3', verification_status: 'unverified', verified_at: null },
    { exam_id: 'exam-seed-101', student_id: 's5', verification_status: 'verified', verified_at: new Date().toISOString() },
    { exam_id: 'exam-seed-101', student_id: 's6', verification_status: 'unverified', verified_at: null },
  ];

  const seedIncidents = [
    {
      id: 'inc-seed-201',
      exam_id: 'exam-seed-101',
      detected_class: 'Smart Watch (v4.2 Active RF)',
      confidence: 0.945,
      qualifying_frames: 20,
      student_id: 's1',
      review_status: 'pending',
      evidence_paths: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80'
      ],
      evidence_complete: true,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString()
    },
    {
      id: 'inc-seed-202',
      exam_id: 'exam-seed-101',
      detected_class: 'Concealed Bluetooth Micro-Earbud',
      confidence: 0.887,
      qualifying_frames: 12,
      student_id: 's2',
      review_status: 'pending',
      evidence_paths: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
      ],
      evidence_complete: false, // Incomplete evidence (< 20 frames before timeout)
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date(now.getTime() - 8 * 60 * 1000).toISOString()
    }
  ];

  return { seedExam, seedExamStudents, seedIncidents };
}

function loadCache(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveCache(key, data) {
  try {
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
 * Fetches all exams from Supabase with fallback to local cache
 */
export async function getExams() {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('start_time', { ascending: true });

    if (!error && data) {
      saveCache(CACHE_KEY_EXAMS, data);
      return data;
    }
  } catch (err) {
    console.warn('[ExamService] Supabase fetch exams notice:', err.message);
  }

  // Fallback to cache or seed
  let cached = loadCache(CACHE_KEY_EXAMS, null);
  if (!cached || cached.length === 0) {
    const { seedExam, seedExamStudents, seedIncidents } = getInitialSeedData();
    cached = [seedExam];
    saveCache(CACHE_KEY_EXAMS, cached);
    saveCache(CACHE_KEY_EXAM_STUDENTS, seedExamStudents);
    saveCache(CACHE_KEY_INCIDENTS, seedIncidents);
  }
  return cached;
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

  const cached = loadCache(CACHE_KEY_EXAMS, []);
  return cached.find(e => e.id === id) || null;
}

/**
 * Creates a new exam and assigns students
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
  const existingExams = await getExams();
  const hasConflict = existingExams.some(e => {
    if (e.status === 'cancelled') return false;
    if (e.room !== (examData.room || 'LH-302')) return false;
    const eStart = new Date(e.start_time).getTime();
    const eEnd = new Date(e.end_time).getTime();
    // Overlapping condition: start < eEnd and end > eStart
    return start < eEnd && end > eStart;
  });

  if (hasConflict) {
    throw new Error(`Schedule conflict: Exam room/rover (${examData.room || 'LH-302'}) is already scheduled for another active exam during this time slot.`);
  }

  const initialStatus = calculateAuthoritativeStatus(examData);

  const newExamRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'exam-' + Date.now(),
    exam_name: examData.exam_name.trim(),
    start_time: examData.start_time,
    end_time: examData.end_time,
    status: initialStatus,
    room: examData.room || 'LH-302',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Try Supabase insert
  let createdExam = null;
  try {
    const { data, error } = await supabase
      .from('exams')
      .insert([newExamRecord])
      .select()
      .single();

    if (!error && data) {
      createdExam = data;
    }
  } catch (err) {
    console.warn('[ExamService] Supabase createExam insert notice:', err.message);
  }

  if (!createdExam) {
    createdExam = newExamRecord;
  }

  // Update cache
  const cachedExams = loadCache(CACHE_KEY_EXAMS, []);
  saveCache(CACHE_KEY_EXAMS, [createdExam, ...cachedExams.filter(e => e.id !== createdExam.id)]);

  // 2. Assign students
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    await assignStudentsToExam(createdExam.id, studentIds, createdExam.status);
  }

  return createdExam;
}

/**
 * Updates an existing exam
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

  // Conflict check excluding current exam
  const existingExams = await getExams();
  const hasConflict = existingExams.some(e => {
    if (e.id === id || e.status === 'cancelled') return false;
    if (e.room !== (examData.room || 'LH-302')) return false;
    const eStart = new Date(e.start_time).getTime();
    const eEnd = new Date(e.end_time).getTime();
    return start < eEnd && end > eStart;
  });

  const existingExam = existingExams.find(e => e.id === id);
  const isCurrentlyCancelled = existingExam?.status === 'cancelled';

  // If exam is currently cancelled and new status is not explicitly provided, it remains cancelled
  const nextStatus = isCurrentlyCancelled && examData.status !== 'scheduled'
    ? 'cancelled'
    : (examData.status || calculateAuthoritativeStatus(examData));

  const updatePayload = {
    exam_name: examData.exam_name.trim(),
    start_time: examData.start_time,
    end_time: examData.end_time,
    room: examData.room || 'LH-302',
    status: nextStatus,
    updated_at: new Date().toISOString()
  };

  let updated = null;
  try {
    const { data, error } = await supabase
      .from('exams')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) updated = data;
  } catch (err) {
    console.warn('[ExamService] Supabase updateExam notice:', err.message);
  }

  if (!updated) {
    updated = { id, ...updatePayload };
  }

  const cached = loadCache(CACHE_KEY_EXAMS, []);
  saveCache(CACHE_KEY_EXAMS, cached.map(e => e.id === id ? { ...e, ...updated } : e));

  if (Array.isArray(studentIds)) {
    await assignStudentsToExam(id, studentIds, updated.status);
  }

  return updated;
}

/**
 * Cancels an exam (authoritative: once cancelled, no subsequent automatic activation)
 */
export async function cancelExam(id) {
  try {
    await supabase
      .from('exams')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {
    console.warn('[ExamService] Supabase cancelExam notice:', err.message);
  }

  const cached = loadCache(CACHE_KEY_EXAMS, []);
  saveCache(CACHE_KEY_EXAMS, cached.map(e => e.id === id ? { ...e, status: 'cancelled' } : e));
  return true;
}

/**
 * Assigns students to an exam without duplicating
 */
export async function assignStudentsToExam(examId, studentIds, examStatus = 'scheduled') {
  const uniqueIds = Array.from(new Set(studentIds));
  const currentAssigned = await getExamStudents(examId);
  const currentMap = new Map(currentAssigned.map(s => [s.student_id, s]));

  const recordsToInsert = [];
  const initialVerification = examStatus === 'verification' || examStatus === 'device_detection' || examStatus === 'completed'
    ? 'unverified'
    : 'unverified';

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

/**
 * Fetches assigned students for an exam, joined with student profile details
 */
export async function getExamStudents(examId) {
  try {
    const { data, error } = await supabase
      .from('exam_students')
      .select('*, student:students(*)')
      .eq('exam_id', examId);

    if (!error && data) {
      // Sync cache
      const cached = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
      const otherCached = cached.filter(s => s.exam_id !== examId);
      saveCache(CACHE_KEY_EXAM_STUDENTS, [...otherCached, ...data]);
      return data;
    }
  } catch (err) {
    console.warn('[ExamService] Supabase getExamStudents notice:', err.message);
  }

  const cached = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
  return cached.filter(s => s.exam_id === examId);
}

/**
 * Updates a student's verification status for a specific exam
 */
export async function updateExamStudentVerification(examId, studentId, verificationStatus) {
  if (!VERIFICATION_STATUSES.includes(verificationStatus)) {
    throw new Error(`Invalid verification status: ${verificationStatus}`);
  }

  const verifiedAt = verificationStatus === 'verified' ? new Date().toISOString() : null;

  try {
    await supabase
      .from('exam_students')
      .update({
        verification_status: verificationStatus,
        verified_at: verifiedAt
      })
      .eq('exam_id', examId)
      .eq('student_id', studentId);
  } catch (err) {
    console.warn('[ExamService] Supabase update verification notice:', err.message);
  }

  // Update cache
  const cached = loadCache(CACHE_KEY_EXAM_STUDENTS, []);
  saveCache(
    CACHE_KEY_EXAM_STUDENTS,
    cached.map(s => {
      if (s.exam_id === examId && s.student_id === studentId) {
        return {
          ...s,
          verification_status: verificationStatus,
          verified_at: verifiedAt
        };
      }
      return s;
    })
  );

  return true;
}

/**
 * Fetches device incidents for an exam
 */
export async function getExamIncidents(examId) {
  try {
    const { data, error } = await supabase
      .from('device_incidents')
      .select('*, student:students(*)')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn('[ExamService] Supabase getExamIncidents notice:', err.message);
  }

  const cached = loadCache(CACHE_KEY_INCIDENTS, []);
  return cached.filter(i => i.exam_id === examId);
}

/**
 * Fetches all device incidents across all exams
 */
export async function getAllIncidents() {
  try {
    const { data, error } = await supabase
      .from('device_incidents')
      .select('*, exam:exams(*), student:students(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      saveCache(CACHE_KEY_INCIDENTS, data);
      return data;
    }
  } catch (err) {
    console.warn('[ExamService] Supabase getAllIncidents notice:', err.message);
  }

  return loadCache(CACHE_KEY_INCIDENTS, []);
}

/**
 * Updates an incident review decision (Confirm, Dismiss, or Pending)
 */
export async function updateIncidentReview(incidentId, { review_status, student_id, reviewed_by }) {
  if (!REVIEW_STATUSES.includes(review_status)) {
    throw new Error(`Invalid review status: ${review_status}`);
  }

  const payload = {
    review_status,
    student_id: student_id !== undefined ? student_id : null,
    reviewed_by: reviewed_by || 'Admin Officer',
    reviewed_at: new Date().toISOString()
  };

  try {
    await supabase
      .from('device_incidents')
      .update(payload)
      .eq('id', incidentId);
  } catch (err) {
    console.warn('[ExamService] Supabase updateIncidentReview notice:', err.message);
  }

  // Update cache
  const cached = loadCache(CACHE_KEY_INCIDENTS, []);
  saveCache(
    CACHE_KEY_INCIDENTS,
    cached.map(i => i.id === incidentId ? { ...i, ...payload } : i)
  );

  return true;
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
    const channel = supabase
      .channel('examshield_exam_changes')
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[ExamService] Realtime channel notice:', err.message);
    return () => {};
  }
}
