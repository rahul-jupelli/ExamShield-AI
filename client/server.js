import dotenv from 'dotenv';
import dns from 'dns';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
if (!process.env.VITE_SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
}
import fs from 'fs';
import { randomUUID, timingSafeEqual } from 'crypto';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

// Resilient DNS resolution patch: bypasses ISP DNS poisoning/censorship on *.supabase.co (e.g. ACT Fibernet/Airtel/Jio)
const origLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname && (hostname.endsWith('.supabase.co') || hostname === 'supabase.co')) {
    if (options && options.all) {
      return callback(null, [
        { address: '172.64.149.246', family: 4 },
        { address: '104.18.38.10', family: 4 }
      ]);
    }
    return callback(null, '172.64.149.246', 4);
  }
  return origLookup(hostname, options, callback);
};

// Initialize Express App
const app = express();
app.use(express.json());

// Enable CORS for cross-origin devices & hardware rovers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});


const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FATAL: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in the .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Optional service-role client used only by the server-side model scheduler (reads exams/exam_students
// without a user session). Falls back to the anon client if the key is not provided.
const schedulerDb = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : supabase;

// Helper to get an authorized Supabase client for a request.
// If a service role key is configured, uses schedulerDb (bypasses RLS).
// Otherwise, forwards the caller's Bearer token so Supabase evaluates RLS as 'authenticated'.
function getSupabaseClient(req) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return schedulerDb;
  }
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]?.trim();
    if (process.env.NODE_ENV !== 'production' && token === 'dev-test-admin-token') {
      return schedulerDb;
    }
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
  }
  return supabase;
}

// ==========================================
// Database Deduplication Utility Function
// ==========================================
async function cleanDuplicateDatabaseRecords() {
  console.log('Running database cleanup for public tables...');
  try {
    // 1. Clean Duplicate Students in Supabase
    const { data: allStudents, error: fetchStudentsErr } = await supabase.from('students').select('*').order('id');
    if (!fetchStudentsErr && allStudents && allStudents.length > 0) {
      const seenTicketMap = new Map();
      const duplicateStudentIdsToDelete = [];

      for (const student of allStudents) {
        const key = (student.hallTicket || student.name || '').trim().toLowerCase();
        if (!key) continue;

        if (seenTicketMap.has(key)) {
          duplicateStudentIdsToDelete.push(student.id);
        } else {
          seenTicketMap.set(key, student);
        }
      }

      if (duplicateStudentIdsToDelete.length > 0) {
        console.log(`Found ${duplicateStudentIdsToDelete.length} duplicate student records in Supabase. Removing...`);
        const { error: delErr } = await supabase.from('students').delete().in('id', duplicateStudentIdsToDelete);
        if (delErr) {
          console.error('Delete student duplicates error:', delErr.message);
        } else {
          console.log(`Cleaned ${duplicateStudentIdsToDelete.length} duplicate student records.`);
        }
      } else {
        console.log('Students table is clean. No duplicates found.');
      }
    }

    // 2. Clean Duplicate Live Alerts in Supabase
    const { data: allAlerts, error: fetchAlertsErr } = await supabase.from('live_alerts').select('*').order('timestamp', { ascending: false });
    if (!fetchAlertsErr && allAlerts && allAlerts.length > 0) {
      const seenAlertMap = new Map();
      const duplicateAlertIdsToDelete = [];

      for (const alert of allAlerts) {
        const key = (alert.title + '_' + (alert.location || '')).trim().toLowerCase();
        if (!key) continue;

        if (seenAlertMap.has(key)) {
          duplicateAlertIdsToDelete.push(alert.id);
        } else {
          seenAlertMap.set(key, alert);
        }
      }

      if (duplicateAlertIdsToDelete.length > 0) {
        console.log(`Found ${duplicateAlertIdsToDelete.length} duplicate alert records in Supabase. Removing...`);
        const { error: delErr } = await supabase.from('live_alerts').delete().in('id', duplicateAlertIdsToDelete);
        if (delErr) {
          console.error('Delete alert duplicates error:', delErr.message);
        } else {
          console.log(`Cleaned ${duplicateAlertIdsToDelete.length} duplicate alert records.`);
        }
      } else {
        console.log('Live alerts table is clean. No duplicates found.');
      }
    }
  } catch (err) {
    console.error('Error performing database cleanup:', err.message);
  }
}

// Database cleanup is available on-demand via authenticated endpoint only.
// Automatic destructive deletion on server startup is disabled to protect existing records.

// ==========================================
// Authentication & Role Authorization Middleware
// ==========================================

// Helper to get authenticated user from Bearer token
async function authenticateUser(req, res, next) {
  // Check for Pi Bridge shared secret key authentication
  const bridgeKeyHeader = req.headers['x-pi-bridge-key'];
  if (bridgeKeyHeader && isValidPiKey(bridgeKeyHeader)) {
    req.user = { id: 'pi-bridge', email: 'pi-bridge@examshield.internal', app_metadata: { role: 'Operator' } };
    req.userRole = 'Operator';
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Missing or malformed Bearer authorization token.'
    });
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Empty Bearer token.'
    });
  }

  if (process.env.NODE_ENV !== 'production' && token === 'dev-test-admin-token') {
    req.user = { id: 'dev-admin-id', email: 'dev-admin@examshield.edu', app_metadata: { role: 'Admin' } };
    req.userRole = 'Admin';
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session token.'
      });
    }

    req.user = user;
    // CRITICAL: Trusted staff roles MUST come strictly from app_metadata.role.
    // NEVER fall back to user_metadata, request body, query params, or default to Admin!
    const trustedRole = user.app_metadata?.role;
    req.userRole = typeof trustedRole === 'string' ? trustedRole.trim() : null;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Auth token validation failure: ' + err.message
    });
  }
}

// Role authorization middleware
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!req.userRole) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Account has no authorized staff role provisioned in app_metadata.'
      });
    }

    const userRoleLower = req.userRole.toLowerCase();
    const isAllowed = allowedRoles.some(r => r.toLowerCase() === userRoleLower);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of: [${allowedRoles.join(', ')}]. Current role: ${req.userRole}`
      });
    }

    next();
  };
}

// ==========================================
// API REST Routes (Fetching & Persisting in Supabase)
// ==========================================

// Deduplication Endpoint (Admin, Exam Controller only)
app.post('/api/cleanup-duplicates', authenticateUser, authorizeRoles('Admin', 'Exam Controller'), async (req, res) => {
  await cleanDuplicateDatabaseRecords();
  res.json({ success: true, message: 'Database deduplication check completed.' });
});

// Safe Health Check - Basic service indicator (No sensitive row counts leaked to public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ExamShield Full-Stack Server',
    timestamp: new Date().toISOString()
  });
});

// Legacy Mock Login endpoint disabled (All authentication must occur via Supabase Auth)
app.post('/api/auth/login', (req, res) => {
  res.status(400).json({
    success: false,
    error: 'Direct mock login is disabled. All authentication must occur via Supabase Auth.'
  });
});

// Students (Deduplicated response - Staff view only, deterministically sorted)
app.get('/api/students', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('*').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase fetch notice for /api/students:', error.message);
      return res.json([]);
    }

    // Deduplicate strictly by unique ID or unique Hall Ticket
    const uniqueMap = new Map();
    (data || []).forEach(s => {
      const key = String(s.id || s.hallTicket || '').trim().toLowerCase();
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      } else if (!key) {
        uniqueMap.set(Math.random().toString(), s);
      }
    });

    const studentList = Array.from(uniqueMap.values());
    // Deterministic sort: case-insensitive name, then student ID
    studentList.sort((a, b) => {
      const nameCompare = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return (a.id || '').localeCompare(b.id || '');
    });

    res.json(studentList);
  } catch (err) {
    console.warn('Error fetching /api/students:', err.message);
    res.json([]);
  }
});

// Add New Student(s) to Supabase (Authorized staff only: Admin, Exam Controller, Operator)
app.post('/api/students', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  try {
    const studentData = req.body;
    const studentsToInsert = Array.isArray(studentData)
      ? studentData
      : [studentData];

    if (studentsToInsert.length === 0) {
      throw new Error('No student data supplied.');
    }

    const records = studentsToInsert.map((s) => {
      const rawEmbedding = s.faceEmbedding || s.face_embedding;

      if (!rawEmbedding) {
        throw new Error(
          `No face embedding supplied for ${s.name || s.id || 'student'}.`
        );
      }

      let embedding;
      try {
        embedding =
          typeof rawEmbedding === 'string'
            ? JSON.parse(rawEmbedding)
            : rawEmbedding;
      } catch {
        throw new Error(
          `Invalid face embedding JSON for ${s.name || s.id || 'student'}.`
        );
      }

      if (
        !Array.isArray(embedding) ||
        embedding.length !== 512
      ) {
        throw new Error(
          `Face embedding for ${s.name || s.id || 'student'} must contain exactly 512 values.`
        );
      }

      embedding = embedding.map(Number);

      if (embedding.some(value => !Number.isFinite(value))) {
        throw new Error(
          `Face embedding for ${s.name || s.id || 'student'} contains invalid numeric values.`
        );
      }

      const norm = Math.sqrt(
        embedding.reduce((sum, value) => sum + value * value, 0)
      );

      if (!Number.isFinite(norm) || norm === 0) {
        throw new Error(
          `Invalid zero-length face embedding for ${s.name || s.id || 'student'}.`
        );
      }

      // Normalize again immediately before database storage.
      const normalizedEmbedding = embedding.map(
        value => value / norm
      );

      if (!s.photo || !String(s.photo).includes('/storage/v1/object/public/student-photos/')) {
        throw new Error(
          `A valid Supabase Storage photo URL is required for ${s.name || s.id || 'student'}.`
        );
      }

      return {
        id: s.id || ('STU-' + Math.floor(1000 + Math.random() * 9000)),
        name: s.name || 'Unknown Cadet',
        hallTicket: s.hallTicket || ('HT-' + Math.floor(10000 + Math.random() * 90000)),
        branch: s.branch || 'Computer Science & AI',
        room: s.room || 'LH-302',
        seat: s.seat || 'Seat 01',
        photo: s.photo,
        // Supabase/PostgREST accepts a numeric array for a pgvector column.
        faceEmbedding: normalizedEmbedding,
        status: s.status || 'Pending',
        detectedDevice: s.detectedDevice || null,
        detectionConfidence: s.detectionConfidence || null,
        suspicionScore: s.suspicionScore !== undefined ? s.suspicionScore : 0,
        suspicionReason: s.suspicionReason || null,
        timestamp: s.timestamp || new Date().toISOString(),
        faceConfidence: s.faceConfidence || 0,
        entryDecision: s.entryDecision || 'Pending',
        verificationCompleted: s.verificationCompleted !== undefined ? s.verificationCompleted : false,
        entryAllowed: s.entryAllowed !== undefined ? s.entryAllowed : false,
        verificationHistory: s.verificationHistory || [
          {
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
            status: 'Biometric Security Enrolled'
          }
        ],
        violationHistory: s.violationHistory || [],
        snapshot: s.snapshot || s.photo
      };
    });

    const { data, error } = await supabase
      .from('students')
      .insert(records)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      count: data?.length || records.length,
      students: data || records
    });
  } catch (err) {
    console.error('Error adding student(s):', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Student Decision (Allowed/Denied) - Admin, Exam Controller, Operator only
// Authoritatively synchronizes both the students table and active/scheduled exam_students records
app.post('/api/students/:id/decision', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  const { id } = req.params;
  const { decision } = req.body;

  const isAllowed = decision === 'Allowed';
  const vStatus = isAllowed ? 'verified' : (decision === 'Denied' ? 'failed' : 'unverified');
  const verified_at = isAllowed ? new Date().toISOString() : null;

  const updateFields = { 
    entryDecision: decision,
    entryAllowed: isAllowed,
    status: isAllowed ? 'Verified' : (decision === 'Denied' ? 'Failed' : 'Pending'),
    verificationCompleted: isAllowed
  };

  try {
    // 1. Update students table using schedulerDb (privileged server client)
    const { data: updatedStudent, error: stuError } = await schedulerDb
      .from('students')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (stuError) throw stuError;

    // 2. Synchronize active/scheduled exam assignments in exam_students
    try {
      const { data: activeExams } = await schedulerDb
        .from('exams')
        .select('id')
        .neq('status', 'completed')
        .neq('status', 'cancelled');

      if (Array.isArray(activeExams) && activeExams.length > 0) {
        for (const ex of activeExams) {
          await schedulerDb.from('exam_students').upsert({
            exam_id: ex.id,
            student_id: id,
            verification_status: vStatus,
            verified_at
          }, { onConflict: 'exam_id,student_id' });
        }
      }
    } catch (syncErr) {
      console.warn('[server.js] exam_students sync notice on decision update:', syncErr.message);
    }

    // 3. Broadcast Realtime WebSocket event to all dashboard screens
    broadcast({
      type: 'STUDENT_VERIFICATION_UPDATED',
      studentId: id,
      decision,
      status: updateFields.status,
      verification_status: vStatus,
      verified_at
    });

    res.json({ success: true, student: updatedStudent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Exam Management & Surveillance Endpoints
// ==========================================

// Helper: attach aggregated student counts & lifecycle fields to exam objects
async function attachExamMetadata(exams, db) {
  if (!Array.isArray(exams) || exams.length === 0) return [];
  const countsMap = new Map();
  try {
    const { data: assignments } = await db
      .from('exam_students')
      .select('exam_id, verification_status');

    if (Array.isArray(assignments)) {
      assignments.forEach(a => {
        if (!countsMap.has(a.exam_id)) {
          countsMap.set(a.exam_id, { total: 0, verified: 0, unverified: 0, failed: 0, absent: 0 });
        }
        const c = countsMap.get(a.exam_id);
        c.total += 1;
        const st = a.verification_status || 'unverified';
        if (c[st] !== undefined) c[st] += 1;
      });
    }
  } catch (countErr) {
    console.warn('[server.js] Notice aggregating exam student counts:', countErr.message);
  }

  return exams.map(e => {
    const counts = countsMap.get(e.id) || { total: 0, verified: 0, unverified: 0, failed: 0, absent: 0 };
    const lc = lifecycle.get(e.id);
    return {
      ...e,
      student_count: counts.total,
      verified_count: counts.verified,
      unverified_count: counts.unverified,
      failed_count: counts.failed,
      absent_count: counts.absent,
      face_verification_enabled: e.face_verification_enabled ?? (lc ? lc.fvEnabled : false),
      device_detection_paused: e.device_detection_paused ?? (lc ? lc.ddManuallyStopped : false),
      device_detection_state: e.device_detection_state ?? (lc && lc.ddManuallyStopped ? 'paused' : (e.status === 'device_detection' ? 'running' : 'idle'))
    };
  });
}

// Get all exams (Available to Admin, Exam Controller, Operator, Viewer)
app.get('/api/exams', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const db = getSupabaseClient(req);
    const { data, error } = await db.from('exams').select('*').order('start_time', { ascending: true });
    if (error) throw error;
    const enhanced = await attachExamMetadata(data || [], db);
    res.json(enhanced);
  } catch (err) {
    console.error('Error fetching exams:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single exam by ID
app.get('/api/exams/:id', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getSupabaseClient(req);
    const { data, error } = await db.from('exams').select('*').eq('id', id).single();
    if (error) throw error;
    const enhanced = await attachExamMetadata([data], db);
    res.json(enhanced[0] || data);
  } catch (err) {
    console.error('Error fetching exam by ID:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-memory fallback registry for exams during offline or local test runs
const memoryExams = new Map();

// Create exam with student assignments (Admin, Exam Controller only)
app.post('/api/exams', authenticateUser, authorizeRoles('Admin', 'Exam Controller'), async (req, res) => {
  try {
    const { exam, student_ids } = req.body;
    if (!exam || !exam.exam_name || !exam.start_time || !exam.end_time) {
      return res.status(400).json({ success: false, error: 'Missing required exam fields.' });
    }

    const db = getSupabaseClient(req);
    const now = Date.now();
    const startMs = Date.parse(exam.start_time);
    const endMs = Date.parse(exam.end_time);

    // Initial status: scheduled if before start, completed if past end
    let initialStatus = 'scheduled';
    if (!isNaN(endMs) && now >= endMs) {
      initialStatus = 'completed';
    } else if (!isNaN(startMs) && now >= startMs) {
      initialStatus = 'device_detection';
    }

    let insertPayload = {
      exam_name: exam.exam_name.trim(),
      start_time: exam.start_time,
      end_time: exam.end_time,
      status: exam.status || initialStatus,
      room: exam.room || 'LH-302',
      face_verification_enabled: false,
      device_detection_paused: false,
      device_detection_state: 'idle'
    };

    let createdExam = null;
    let createdInMemoryOnly = false;
    let { data, error: examErr } = await db
      .from('exams')
      .insert([insertPayload])
      .select()
      .single();

    // If schema lacks newer columns (PostgreSQL error 42703), safely fallback to base columns
    if (examErr && (examErr.code === '42703' || String(examErr.message).includes('column'))) {
      console.warn('[server.js] Database schema missing new control columns. Retrying with basic columns.');
      const safePayload = {
        exam_name: insertPayload.exam_name,
        start_time: insertPayload.start_time,
        end_time: insertPayload.end_time,
        status: insertPayload.status,
        room: insertPayload.room
      };
      let retryResult = await db.from('exams').insert([safePayload]).select().single();
      if (retryResult.error && (retryResult.error.code === '42703' || String(retryResult.error.message).includes('room'))) {
        delete safePayload.room;
        retryResult = await db.from('exams').insert([safePayload]).select().single();
      }
      if (retryResult.error) throw retryResult.error;
      createdExam = { ...retryResult.data, room: exam.room || 'LH-302' };
    } else if (examErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[server.js] Database insert notice (RLS/offline), using memory store for test/dev:', examErr.message);
        createdExam = {
          id: insertPayload.id || randomUUID(),
          ...insertPayload,
          created_at: new Date().toISOString(),
          __memoryOnly: true
        };
        createdInMemoryOnly = true;
      } else {
        throw examErr;
      }
    } else {
      createdExam = data;
    }

    if (createdExam?.id && createdInMemoryOnly) {
      memoryExams.set(createdExam.id, createdExam);
    }

    // Initialize lifecycle cache entry
    const lc = getLifecycle(createdExam.id);
    lc.fvEnabled = false;
    lc.fvRunning = false;
    lc.ddManuallyStopped = false;
    lc.sched = { startMs, endMs, cancelled: createdExam.status === 'cancelled' };
    persistLifecycle();

    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const records = student_ids.map(sId => ({
        exam_id: createdExam.id,
        student_id: sId,
        verification_status: 'unverified'
      }));
      const { error: assignErr } = await db.from('exam_students').upsert(records, { onConflict: 'exam_id,student_id' });
      if (assignErr) {
        console.warn('[server.js] Notice assigning students:', assignErr.message);
      }
    }

    const enhanced = await attachExamMetadata([createdExam], db);
    res.json({ success: true, exam: enhanced[0] || createdExam });
  } catch (err) {
    console.error('Error creating exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update exam with student assignments (Admin, Exam Controller only)
app.put('/api/exams/:id', authenticateUser, authorizeRoles('Admin', 'Exam Controller'), async (req, res) => {
  try {
    const { id } = req.params;
    const { exam, student_ids } = req.body;
    const updateData = exam || req.body;
    const db = getSupabaseClient(req);
    
    const payload = {};
    if (updateData.exam_name) payload.exam_name = updateData.exam_name.trim();
    if (updateData.start_time) payload.start_time = updateData.start_time;
    if (updateData.end_time) payload.end_time = updateData.end_time;
    if (updateData.room) payload.room = updateData.room;
    if (updateData.status) payload.status = updateData.status;
    if (updateData.face_verification_enabled !== undefined) payload.face_verification_enabled = updateData.face_verification_enabled;
    if (updateData.device_detection_paused !== undefined) payload.device_detection_paused = updateData.device_detection_paused;
    if (updateData.device_detection_state) payload.device_detection_state = updateData.device_detection_state;
    payload.updated_at = new Date().toISOString();

    let updatedExam = null;
    let { data, error: examErr } = await db
      .from('exams')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (examErr && (examErr.code === '42703' || String(examErr.message).includes('column'))) {
      console.warn('[server.js] Schema missing columns. Stripping extended columns and retrying.');
      const basePayload = {
        updated_at: payload.updated_at
      };
      if (payload.exam_name) basePayload.exam_name = payload.exam_name;
      if (payload.start_time) basePayload.start_time = payload.start_time;
      if (payload.end_time) basePayload.end_time = payload.end_time;
      if (payload.status) basePayload.status = payload.status;
      if (payload.room) basePayload.room = payload.room;

      let retryResult = await db.from('exams').update(basePayload).eq('id', id).select().single();
      if (retryResult.error && (retryResult.error.code === '42703' || String(retryResult.error.message).includes('room'))) {
        delete basePayload.room;
        retryResult = await db.from('exams').update(basePayload).eq('id', id).select().single();
      }
      if (retryResult.error) throw retryResult.error;
      updatedExam = { ...retryResult.data, room: updateData.room || 'LH-302' };
    } else if (examErr) {
      throw examErr;
    } else {
      updatedExam = data;
    }

    // Sync in-memory lifecycle
    if (payload.start_time || payload.end_time) {
      const lc = getLifecycle(id);
      lc.sched = {
        startMs: Date.parse(updatedExam.start_time),
        endMs: Date.parse(updatedExam.end_time),
        cancelled: updatedExam.status === 'cancelled'
      };
      if (payload.face_verification_enabled !== undefined) lc.fvEnabled = payload.face_verification_enabled;
      if (payload.device_detection_paused !== undefined) lc.ddManuallyStopped = payload.device_detection_paused;
      persistLifecycle();
    }

    if (Array.isArray(student_ids)) {
      // Synchronize assigned students
      const { data: currentAssigned } = await db
        .from('exam_students')
        .select('student_id')
        .eq('exam_id', id);

      const currentIds = (currentAssigned || []).map(r => r.student_id);
      const toAdd = student_ids.filter(sId => !currentIds.includes(sId));
      const toRemove = currentIds.filter(sId => !student_ids.includes(sId));

      if (toRemove.length > 0) {
        await db
          .from('exam_students')
          .delete()
          .eq('exam_id', id)
          .in('student_id', toRemove);
      }

      if (toAdd.length > 0) {
        const records = toAdd.map(sId => ({
          exam_id: id,
          student_id: sId,
          verification_status: 'unverified'
        }));
        await db.from('exam_students').upsert(records, { onConflict: 'exam_id,student_id' });
      }
    }

    const enhanced = await attachExamMetadata([updatedExam], db);
    res.json({ success: true, exam: enhanced[0] || updatedExam });
  } catch (err) {
    console.error('Error updating exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel exam endpoint (Admin, Exam Controller only)
app.post('/api/exams/:id/cancel', authenticateUser, authorizeRoles('Admin', 'Exam Controller'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getSupabaseClient(req);
    let data = null;
    try {
      const res = await db
        .from('exams')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      data = res.data;
    } catch (dbErr) {
      if (process.env.NODE_ENV !== 'production' && memoryExams.has(id)) {
        memoryExams.get(id).status = 'cancelled';
        data = memoryExams.get(id);
      } else {
        throw dbErr;
      }
    }

    if (memoryExams.has(id)) {
      memoryExams.get(id).status = 'cancelled';
      if (!data) data = memoryExams.get(id);
    }

    // Stop any model currently running for this exam and release Pi ownership
    const lc = getLifecycle(id);
    if (lc) {
      lc.sched = { ...lc.sched, cancelled: true };
      if (modelState.examId === id && modelState.activeModel !== 'none') {
        await executeModelCommand(id, modelState.activeModel, 'stop', lc.sched, { source: 'auto' });
      }
      lifecycle.delete(id);
      persistLifecycle();
    }
    if (modelState.examId === id) {
      applyModelState({ activeModel: 'none', examId: null, status: 'stopped', fps: null, error: null });
      persistLifecycle();
      broadcast({ type: 'MODEL_STATUS', model: getModelStatusPayload() });
    }

    broadcast({ type: 'EXAM_STATUS_UPDATED', examId: id, status: 'cancelled' });
    res.json({ success: true, exam: data });
  } catch (err) {
    console.error('Error cancelling exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get assigned students for exam with deterministic sorting (Admin, Exam Controller, Operator, Viewer)
app.get('/api/exams/:id/students', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { id } = req.params;

    // The trusted Pi bridge has no end-user Bearer token. Require the server-side
    // service-role client for its candidate lookup rather than silently querying
    // through the anonymous client and misreporting an empty candidate list.
    if (req.user?.id === 'pi-bridge' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[server.js] Pi bridge candidate lookup unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return res.status(503).json({
        success: false,
        error: 'Candidate lookup is not configured for the Pi bridge. Set SUPABASE_SERVICE_ROLE_KEY in the server environment.'
      });
    }

    const db = getSupabaseClient(req);
    const { data, error } = await db
      .from('exam_students')
      .select('*, student:students(*)')
      .eq('exam_id', id);

    if (error) throw error;

    const list = data || [];
    // Deterministic sort: candidate name (case-insensitive) then student_id as stable tie-breaker
    list.sort((a, b) => {
      const nameA = (a.student?.name || a.name || '').trim();
      const nameB = (b.student?.name || b.name || '').trim();
      const nameCmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      if (nameCmp !== 0) return nameCmp;
      return (a.student_id || a.id || '').localeCompare(b.student_id || b.id || '');
    });

    res.json(list);
  } catch (err) {
    console.error('Error getting exam students:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update per-exam student verification status (Admin, Exam Controller, Operator)
// Idempotently upserts exam_students and synchronizes the students table
app.put('/api/exams/:id/students/:studentId', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { verification_status } = req.body;
    if (!['unverified', 'verified', 'failed', 'absent'].includes(verification_status)) {
      return res.status(400).json({ success: false, error: `Invalid verification status: ${verification_status}` });
    }
    const db = getSupabaseClient(req);

    const verified_at = verification_status === 'verified' ? new Date().toISOString() : null;

    // Idempotent upsert in exam_students (creates assignment if not yet present)
    const { data, error } = await db
      .from('exam_students')
      .upsert({
        exam_id: id,
        student_id: studentId,
        verification_status,
        verified_at
      }, { onConflict: 'exam_id,student_id' })
      .select('*, student:students(*)');

    if (error) throw error;

    // Synchronize students table safely via schedulerDb (server-side privileged client)
    const isVerified = verification_status === 'verified';
    try {
      await schedulerDb
        .from('students')
        .update({
          status: isVerified ? 'Verified' : (verification_status === 'failed' ? 'Failed' : 'Pending'),
          entryDecision: isVerified ? 'Allowed' : (verification_status === 'failed' ? 'Denied' : 'Pending'),
          verificationCompleted: isVerified,
          entryAllowed: isVerified
        })
        .eq('id', studentId);
    } catch (syncErr) {
      console.warn('[server.js] students table sync notice:', syncErr.message);
    }

    // Broadcast Realtime WebSocket event to all dashboard clients
    broadcast({
      type: 'STUDENT_VERIFICATION_UPDATED',
      examId: id,
      studentId,
      verification_status,
      verified_at
    });

    res.json({ success: true, data: data?.[0] || { exam_id: id, student_id: studentId, verification_status, verified_at } });
  } catch (err) {
    console.error('Error updating exam student verification:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get incidents for an exam (Admin, Exam Controller, Operator, Viewer)
app.get('/api/exams/:id/incidents', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getSupabaseClient(req);
    const { data, error } = await db
      .from('device_incidents')
      .select('*, student:students(*)')
      .eq('exam_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching exam incidents:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all incidents across exams (Admin, Exam Controller, Operator)
app.get('/api/incidents', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  try {
    const db = getSupabaseClient(req);
    const { data, error } = await db
      .from('device_incidents')
      .select('*, exam:exams(*), student:students(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching all incidents:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update incident review status (Admin, Exam Controller, Operator)
app.put('/api/incidents/:id/review', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { review_status, student_id, reviewed_by } = req.body;
    const db = getSupabaseClient(req);

    // Normalize review status (supports 'confirmed'/'dismissed' and 'approved'/'rejected')
    let normalizedStatus = review_status;
    if (review_status === 'approved') normalizedStatus = 'confirmed';
    if (review_status === 'rejected') normalizedStatus = 'dismissed';

    const updateFields = {
      review_status: normalizedStatus,
      student_id: student_id || null,
      reviewed_by: reviewed_by || (req.user?.user_metadata?.full_name || req.userRole || 'Admin Officer'),
      reviewed_at: new Date().toISOString()
    };

    const { data, error } = await db
      .from('device_incidents')
      .update(updateFields)
      .eq('id', id)
      .select('*, exam:exams(*), student:students(*)');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: `Incident not found with ID ${id}` });
    }

    res.json({ success: true, incident: data[0], data: data[0] });
  } catch (err) {
    console.error('Error updating incident review:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Raspberry Pi 4 model control (Face Verification / Device Detection)
// Both .pt models live on the Pi; the dashboard only sends start/stop/pause/resume commands.
// ==========================================
const PI_BRIDGE_KEY = process.env.PI_BRIDGE_KEY || '';
const MODEL_NAMES = ['face_verification', 'device_detection'];
const MODEL_ACTIONS = ['start', 'stop', 'pause', 'resume', 'prepare'];
const FV_WINDOW_MS = 60 * 60 * 1000;
const MODEL_ACK_TIMEOUT_MS = 8000;

const piClients = new Set();
const pendingModelAcks = new Map();
let modelState = {
  activeModel: 'none',
  examId: null,
  status: 'stopped', // 'stopped' | 'running' | 'paused'
  fps: null,
  error: null,
  updatedAt: null
};

function getModelStatusPayload() {
  const hasSimulator = Array.from(piClients).some(c => c.isSimulator);
  return {
    piConnected: piClients.size > 0,
    isSimulated: hasSimulator,
    ...modelState
  };
}

function applyModelState(patch) {
  modelState = { ...modelState, ...patch, updatedAt: new Date().toISOString() };
  broadcast({ type: 'MODEL_STATUS', model: getModelStatusPayload() });
}

function isValidPiKey(candidate, isSimulator = false) {
  if (typeof candidate !== 'string' || !candidate) return false;
  // Disallow simulated hardware in production environment
  if (isSimulator && process.env.NODE_ENV === 'production') return false;

  const serverKey = process.env.PI_BRIDGE_KEY;
  if (serverKey) {
    const a = Buffer.from(candidate);
    const b = Buffer.from(serverKey);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Development-only fallback if PI_BRIDGE_KEY is unset in .env
  if (process.env.NODE_ENV !== 'production') {
    const devAccepted = ['change-me', 'dev-pi-simulator-key', 'examshield-dev-key'];
    for (const valid of devAccepted) {
      const a = Buffer.from(candidate);
      const b = Buffer.from(valid);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}

// Rover inference node health check
app.get('/api/rover/inference-node', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), (req, res) => {
  const connected = piClients.size > 0;
  res.json({
    connected,
    hardware: 'Raspberry Pi 4 Model B (Inference System)',
    endpoint: '/api/rover/inference-stream',
    status: connected
      ? (modelState.activeModel === 'none' 
          ? (modelState.status === 'paused' ? 'Connected / Paused' : 'Connected / Standby') 
          : `Connected / ${modelState.activeModel} running`)
      : 'Standby / Waiting for hardware socket connection',
    activeModel: modelState.activeModel,
    modelLifecycleState: modelState.status,
    timestamp: new Date().toISOString()
  });
});

// ---- Canonical Timestamp Normalization ----
function parseCanonicalInstant(raw) {
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (typeof raw === 'number') {
    return raw < 1e11 ? raw * 1000 : raw;
  }
  const str = String(raw).trim();
  const num = Number(str);
  if (!isNaN(num) && str.length >= 10 && !str.includes('-') && !str.includes(':')) {
    return num < 1e11 ? num * 1000 : num;
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? NaN : parsed;
}

// ---- Per-exam lifecycle state (persisted so a server restart does not lose manual choices) ----
const LIFECYCLE_FILE = path.join(process.cwd(), '.model-lifecycle.json');
const SCHEDULER_INTERVAL_MS = 5000;
const AUTO_RETRY_MS = 10000;
const lifecycle = new Map();   // examId -> { fvRunning, fvEverStarted, fvEnabled, ddManuallyStopped, sched, preparedModels, runtimeReady, readyAt }
const lastAutoAttempt = new Map(); // `${examId}:${model}:${action}` -> timestamp

try {
  if (fs.existsSync(LIFECYCLE_FILE)) {
    const saved = JSON.parse(fs.readFileSync(LIFECYCLE_FILE, 'utf8'));
    const now = Date.now();
    Object.entries(saved).forEach(([id, lc]) => {
      // Discard expired or cancelled exams from disk cache
      const endMs = lc.sched?.endMs ? Number(lc.sched.endMs) : 0;
      if (endMs && now >= endMs) return;
      if (lc.sched?.cancelled) return;

      lifecycle.set(id, {
        ...lc,
        fvRunning: false, // Worker processes are stopped on server restart
        preparedModels: lc.preparedModels || { face_verification: false, device_detection: false },
        runtimeReady: Boolean(lc.runtimeReady),
        readyAt: lc.readyAt || null
      });
    });
  }
} catch (e) {
  console.warn('[MODEL LIFECYCLE] Could not load saved state:', e.message);
}

function persistLifecycle() {
  try {
    fs.writeFileSync(LIFECYCLE_FILE, JSON.stringify(Object.fromEntries(lifecycle)));
  } catch (e) {
    console.warn('[MODEL LIFECYCLE] Could not save state:', e.message);
  }
}

function getLifecycle(examId) {
  const defaults = {
    fvRunning: false,
    fvEverStarted: false,
    fvEnabled: false,
    ddManuallyStopped: false,
    preparedModels: { face_verification: false, device_detection: false },
    runtimeReady: false,
    readyAt: null,
    sched: null
  };
  if (!lifecycle.has(examId)) lifecycle.set(examId, { ...defaults });
  const current = lifecycle.get(examId);
  current.preparedModels = { ...defaults.preparedModels, ...(current.preparedModels || {}) };
  for (const [key, value] of Object.entries(defaults)) {
    if (current[key] === undefined) current[key] = value;
  }
  return current;
}

// Helper: Safely update exam control fields in Supabase database
async function updateExamControlInDb(examId, fields) {
  try {
    const { error } = await schedulerDb.from('exams').update({
      ...fields,
      updated_at: new Date().toISOString()
    }).eq('id', examId);
    if (error && error.code !== '42703') {
      console.warn(`[server.js] Notice updating exam ${examId} control fields:`, error.message);
    }
  } catch (err) {
    console.warn(`[server.js] Notice updating exam control:`, err.message);
  }
}

// Serializes every Pi command (manual and automatic) so models can never race each other
let modelLockChain = Promise.resolve();
function withModelLock(fn) {
  const run = modelLockChain.then(fn, fn);
  modelLockChain = run.catch(() => {});
  return run;
}

/**
 * Single authoritative place that validates and executes a model command on the Pi.
 * action in ('start', 'stop', 'pause', 'resume')
 */
function executeModelCommand(examId, model, action, sched, opts = {}) {
  const manual = opts.source !== 'auto';
  return withModelLock(async () => {
    const lc = getLifecycle(examId);
    lc.sched = sched;
    const { startMs, endMs, cancelled } = sched;
    const now = Date.now();

    // 1. Validation & Pre-conditions
    if (cancelled) {
      return { code: 409, body: { success: false, error: 'Exam is cancelled.' } };
    }

    if (now >= endMs) {
      return { code: 403, body: { success: false, error: 'Scheduled exam window has already completed.' } };
    }

    // PREPARE: scheduled preflight of the real model + camera. This does not
    // leave a worker running and does not begin student verification.
    if (action === 'prepare') {
      if (now < startMs - FV_WINDOW_MS || now >= startMs) {
        return { code: 403, body: { success: false, error: 'Runtime preflight is only allowed during the hour before the exam.' } };
      }
      if (piClients.size === 0) {
        return { code: 503, body: { success: false, acknowledged: false, piConnected: false, error: 'Python Pi runtime is offline; preflight will retry when it reconnects.' } };
      }
      if (modelState.activeModel !== 'none' || modelState.status === 'running' || modelState.status === 'paused') {
        return { code: 409, body: { success: false, acknowledged: false, error: 'Cannot preflight while the Pi camera is allocated to an active or paused model.', state: getModelStatusPayload() } };
      }
      const prepareRequestId = randomUUID();
      const prepareAckPromise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingModelAcks.delete(prepareRequestId);
          resolve({ ok: false, error: 'Timed out waiting for Pi model/camera preflight.' });
        }, 65000);
        pendingModelAcks.set(prepareRequestId, (ack) => {
          clearTimeout(timer);
          pendingModelAcks.delete(prepareRequestId);
          resolve(ack);
        });
      });
      const packet = JSON.stringify({
        type: 'MODEL_COMMAND',
        requestId: prepareRequestId,
        model,
        action: 'prepare',
        examId,
        startTime: startMs,
        endTime: endMs,
        startTimeSec: Math.floor(startMs / 1000),
        endTimeSec: Math.floor(endMs / 1000)
      });
      for (const pi of piClients) { if (pi.readyState === WebSocket.OPEN) pi.send(packet); }
      const prepareAck = await prepareAckPromise;
      if (!prepareAck.ok) {
        lc.preparedModels = { ...(lc.preparedModels || {}), [model]: false };
        lc.runtimeReady = false;
        persistLifecycle();
        return { code: 502, body: { success: false, acknowledged: false, error: prepareAck.error || `Preflight failed for ${model}.`, state: getModelStatusPayload() } };
      }
      lc.preparedModels = { ...(lc.preparedModels || { face_verification: false, device_detection: false }), [model]: true };
      lc.runtimeReady = !!lc.preparedModels.face_verification && !!lc.preparedModels.device_detection;
      lc.readyAt = lc.runtimeReady ? new Date().toISOString() : (lc.readyAt || null);
      persistLifecycle();
      broadcast({ type: 'MODEL_STATUS', model: getModelStatusPayload() });
      return { code: 200, body: { success: true, acknowledged: true, prepared: true, runtimeReady: lc.runtimeReady, preparedModels: lc.preparedModels, message: `${model} preflight passed; camera released and waiting for administrator.` } };
    }

    // FACE VERIFICATION: Independent admin ON/OFF control
    if (model === 'face_verification') {
      if (action === 'start') {
        const isSwitchOrAdminOverride = Boolean(opts.switchModel || opts.forceTransition) && now < endMs;
        const isPreExamWindow = now >= startMs - FV_WINDOW_MS && now < startMs;
        if (!isSwitchOrAdminOverride && !isPreExamWindow) {
          return { code: 403, body: { success: false, error: 'Face verification can only be started during the hour before the scheduled exam or via administrator model switch.' } };
        }
        lc.fvEnabled = true;
        await updateExamControlInDb(examId, { face_verification_enabled: true });

        // If Pi is offline: distinguish between saving setting and running on Pi
        if (piClients.size === 0) {
          lc.fvRunning = false;
          persistLifecycle();
          return {
            code: 200,
            body: {
              success: true,
              acknowledged: false,
              piConnected: false,
              state: getModelStatusPayload(),
              message: 'Face verification setting enabled. Raspberry Pi is offline; worker will start upon connection.'
            }
          };
        }
      } else if (action === 'stop') {
        lc.fvEnabled = false;
        lc.fvRunning = false;
        await updateExamControlInDb(examId, { face_verification_enabled: false });

        if (piClients.size === 0 || modelState.activeModel !== 'face_verification') {
          persistLifecycle();
          return {
            code: 200,
            body: {
              success: true,
              acknowledged: true,
              piConnected: piClients.size > 0,
              state: getModelStatusPayload(),
              message: 'Face verification disabled.'
            }
          };
        }
      }
    }

    // DEVICE DETECTION: Start, Stop (Pause), Resume
    if (model === 'device_detection') {
      if (action === 'start' || action === 'resume') {
        if (!(now >= startMs && now < endMs)) {
          return { code: 403, body: { success: false, error: 'Device detection can only run during the scheduled exam time.' } };
        }
        lc.ddManuallyStopped = false;
        // Do not mark 'running' yet; wait for physical Pi ACK.
        await updateExamControlInDb(examId, {
          status: 'device_detection',
          device_detection_paused: false,
          device_detection_state: piClients.size > 0 ? 'starting' : 'idle'
        });

        if (piClients.size === 0) {
          persistLifecycle();
          return {
            code: 200,
            body: {
              success: true,
              acknowledged: false,
              piConnected: false,
              state: getModelStatusPayload(),
              message: 'Detection resumed on server. Raspberry Pi is offline; worker will start upon connection.'
            }
          };
        }
      } else if (action === 'stop' || action === 'pause') {
        lc.ddManuallyStopped = true;
        await updateExamControlInDb(examId, {
          device_detection_paused: true,
          device_detection_state: 'paused',
          device_detection_stopped_at: new Date().toISOString()
        });

        if (piClients.size === 0 || (modelState.activeModel !== 'device_detection' && modelState.status !== 'running')) {
          applyModelState({ activeModel: 'none', examId, status: 'paused', error: null });
          persistLifecycle();
          return {
            code: 200,
            body: {
              success: true,
              acknowledged: true,
              piConnected: piClients.size > 0,
              state: getModelStatusPayload(),
              message: 'Device detection paused.'
            }
          };
        }
      }
    }

    // Single-Pi allocation check:
    // Only one exam session can actively own the single Pi at a time.
    const isStarting = action === 'start' || action === 'resume';
    if (isStarting && modelState.examId && String(modelState.examId) !== String(examId)) {
      // Validate ownership against the database first. The old implementation checked
      // memoryExams first, but that cache can retain an exam deleted directly in Supabase.
      let allocatedActive = false;
      let allocatedTitle = `Exam ${modelState.examId}`;
      try {
        const { data: dbExam, error: dbLookupError } = await schedulerDb
          .from('exams')
          .select('id, exam_name, status, end_time')
          .eq('id', modelState.examId)
          .maybeSingle();
        if (dbLookupError) throw dbLookupError;

        let curExam = dbExam || null;
        // Development fallback exams are valid only when explicitly marked memory-only.
        if (!curExam) {
          const cachedExam = memoryExams.get(modelState.examId);
          if (cachedExam?.__memoryOnly === true) {
            curExam = cachedExam;
          } else {
            // The old owner was deleted from the database; discard its stale cache entry.
            memoryExams.delete(modelState.examId);
          }
        }

        if (curExam) {
          allocatedTitle = `\"${curExam.exam_name || curExam.id}\"`;
          const curEnd = new Date(curExam.end_time).getTime();
          const notEnded = isNaN(curEnd) || Date.now() < curEnd;
          if (curExam.status !== 'completed' && curExam.status !== 'cancelled' && notEnded) {
            allocatedActive = true;
          }
        }
      } catch (err) {
        console.warn('[MODEL LIFECYCLE] Could not validate current Pi owner against the database:', err.message);
        const cachedExam = memoryExams.get(modelState.examId);
        if (cachedExam?.__memoryOnly === true &&
            (modelState.activeModel !== 'none' || modelState.status === 'running' || modelState.status === 'paused')) {
          allocatedActive = true;
          allocatedTitle = `\"${cachedExam.exam_name || cachedExam.id}\"`;
        } else if (modelState.activeModel !== 'none' || modelState.status === 'running' || modelState.status === 'paused') {
          return {
            code: 503,
            body: {
              success: false,
              error: 'Cannot verify the current Raspberry Pi owner because the exam database lookup failed. Check the backend database connection and retry.',
              state: getModelStatusPayload()
            }
          };
        }
      }

      if (allocatedActive) {
        return {
          code: 409,
          body: {
            success: false,
            error: `The Raspberry Pi is currently allocated to active session ${allocatedTitle}. Only one exam session can own the Pi at a time. Conclude, complete, or cancel the active session before allocating the Pi to this exam.`,
            state: getModelStatusPayload()
          }
        };
      } else {
        // Stale allocation from completed/cancelled/expired exam; release Pi ownership safely
        console.log(`[MODEL LIFECYCLE] Auto-releasing stale allocation from exam ${modelState.examId}`);
        applyModelState({ activeModel: 'none', examId: null, status: 'stopped', fps: null });
        persistLifecycle();
      }
    }

    // Mutual exclusivity check on device:
    // Physical Raspberry Pi can only run one model at a time (face_verification OR device_detection).
    if (isStarting && modelState.activeModel !== 'none' && modelState.activeModel !== model) {
      if (opts.switchModel || opts.forceTransition) {
        // Coordinated acknowledged transition: stop running model before starting requested model
        const prevModel = modelState.activeModel;
        console.log(`[MODEL LIFECYCLE] Coordinated transition on Pi: stopping ${prevModel} before starting ${model}...`);
        const stopReqId = randomUUID();
        const stopAckPromise = new Promise((resolve) => {
          const timer = setTimeout(() => {
            pendingModelAcks.delete(stopReqId);
            resolve({ ok: false, error: `Timed out waiting for Pi to release ${prevModel}.`, timeout: true });
          }, MODEL_ACK_TIMEOUT_MS);
          pendingModelAcks.set(stopReqId, (ack) => {
            clearTimeout(timer);
            pendingModelAcks.delete(stopReqId);
            resolve(ack);
          });
        });

        const stopPacket = JSON.stringify({
          type: 'MODEL_COMMAND',
          requestId: stopReqId,
          model: prevModel,
          action: 'stop',
          examId,
          startTime: startMs,
          endTime: endMs,
          startTimeSec: Math.floor(startMs / 1000),
          endTimeSec: Math.floor(endMs / 1000)
        });
        for (const pi of piClients) {
          if (pi.readyState === WebSocket.OPEN) pi.send(stopPacket);
        }

        const stopAck = await stopAckPromise;
        if (!stopAck.ok) {
          return {
            code: 502,
            body: {
              success: false,
              acknowledged: false,
              error: `Failed to safely release ${prevModel} on the Pi: ${stopAck.error || 'Pi rejected stop.'}`,
              state: getModelStatusPayload()
            }
          };
        }
        applyModelState({ activeModel: 'none', examId, status: 'stopped', error: null });
      } else {
        return {
          code: 409,
          body: {
            success: false,
            error: `Cannot start ${model}: ${modelState.activeModel} is currently running on the Pi. Stop or pause ${modelState.activeModel} first to release the camera, or request a coordinated model switch.`,
            state: getModelStatusPayload()
          }
        };
      }
    }

    // Transmit command to Raspberry Pi
    const requestId = randomUUID();
    const ackPromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingModelAcks.delete(requestId);
        resolve({ ok: false, error: 'Timed out waiting for Raspberry Pi acknowledgement.', timeout: true });
      }, MODEL_ACK_TIMEOUT_MS);
      pendingModelAcks.set(requestId, (ack) => {
        clearTimeout(timer);
        pendingModelAcks.delete(requestId);
        resolve(ack);
      });
    });

    const packet = JSON.stringify({
      type: 'MODEL_COMMAND',
      requestId,
      model,
      action,
      examId,
      startTime: startMs,
      endTime: endMs,
      startTimeSec: Math.floor(startMs / 1000),
      endTimeSec: Math.floor(endMs / 1000)
    });

    for (const pi of piClients) {
      if (pi.readyState === WebSocket.OPEN) pi.send(packet);
    }

    const ack = await ackPromise;
    if (!ack.ok) {
      return {
        code: ack.timeout ? 504 : 502,
        body: {
          success: false,
          acknowledged: false,
          error: ack.error || 'Raspberry Pi rejected command.',
          state: getModelStatusPayload()
        }
      };
    }

    // Update state on successful ACK from physical Raspberry Pi
    if (action === 'start' || action === 'resume') {
      applyModelState({ activeModel: model, examId, status: 'running', error: null });
      if (model === 'face_verification') {
        lc.fvRunning = true;
        lc.fvEverStarted = true;
      }
      if (model === 'device_detection') {
        await updateExamControlInDb(examId, {
          device_detection_state: 'running',
          device_detection_started_at: new Date().toISOString()
        });
      }
    } else if (action === 'pause' || (model === 'device_detection' && action === 'stop')) {
      applyModelState({ activeModel: 'none', examId, status: 'paused', error: null });
      if (model === 'device_detection') {
        await updateExamControlInDb(examId, {
          device_detection_state: 'paused',
          device_detection_stopped_at: new Date().toISOString()
        });
      }
    } else {
      applyModelState({ activeModel: 'none', examId: null, status: 'stopped', error: null });
      if (model === 'face_verification') lc.fvRunning = false;
      if (model === 'device_detection') {
        await updateExamControlInDb(examId, {
          device_detection_state: 'stopped',
          device_detection_stopped_at: new Date().toISOString()
        });
      }
    }

    persistLifecycle();
    return {
      code: 200,
      body: {
        success: true,
        acknowledged: true,
        piConnected: true,
        state: getModelStatusPayload()
      }
    };
  });
}

// Current model state reported by the Pi 4 (+ per-exam lifecycle flags)
app.get('/api/rover/model-status', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), (req, res) => {
  const payload = getModelStatusPayload();
  const { examId } = req.query;
  if (examId && lifecycle.has(String(examId))) {
    const { fvRunning, fvEverStarted, fvEnabled, ddManuallyStopped, preparedModels, runtimeReady, readyAt } = getLifecycle(String(examId));
    payload.lifecycle = {
      fvRunning,
      fvEverStarted,
      fvEnabled: !!fvEnabled,
      ddManuallyStopped,
      isPaused: ddManuallyStopped,
      preparedModels: preparedModels || { face_verification: false, device_detection: false },
      runtimeReady: !!runtimeReady,
      readyAt: readyAt || null
    };
  } else {
    payload.lifecycle = {
      fvRunning: false,
      fvEverStarted: false,
      fvEnabled: false,
      ddManuallyStopped: false,
      isPaused: false,
      preparedModels: { face_verification: false, device_detection: false },
      runtimeReady: false,
      readyAt: null
    };
  }
  res.json(payload);
});

// Manual start / stop / pause / resume of a model on the Pi 4 (Admin, Exam Controller, Operator only)
app.post('/api/rover/model-control', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  const { examId, model, action } = req.body || {};

  if (!examId || !MODEL_NAMES.includes(model) || !MODEL_ACTIONS.includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'examId, model (face_verification|device_detection) and action (start|stop|pause|resume) are required.'
    });
  }

  // Authoritative exam schedule from memory store, lifecycle cache, DB, or request body fallback
  let sched = null;
  if (memoryExams.has(examId)) {
    const mem = memoryExams.get(examId);
    const startMs = parseCanonicalInstant(mem.start_time || mem.startTime);
    const endMs = parseCanonicalInstant(mem.end_time || mem.endTime);
    if (startMs !== null && endMs !== null) {
      sched = {
        startMs,
        endMs,
        startTimeSec: Math.floor(startMs / 1000),
        endTimeSec: Math.floor(endMs / 1000),
        cancelled: mem.status === 'cancelled'
      };
    }
  }

  if ((!sched || isNaN(sched.startMs) || isNaN(sched.endMs)) && lifecycle.has(examId) && lifecycle.get(examId).sched) {
    const s = lifecycle.get(examId).sched;
    if (s.startMs && s.endMs) {
      sched = {
        startMs: s.startMs,
        endMs: s.endMs,
        startTimeSec: s.startTimeSec || Math.floor(s.startMs / 1000),
        endTimeSec: s.endTimeSec || Math.floor(s.endMs / 1000),
        cancelled: Boolean(s.cancelled)
      };
    }
  }

  if (!sched || isNaN(sched.startMs) || isNaN(sched.endMs)) {
    try {
      const { data } = await schedulerDb.from('exams').select('start_time, end_time, status').eq('id', examId).single();
      if (data) {
        const startMs = parseCanonicalInstant(data.start_time);
        const endMs = parseCanonicalInstant(data.end_time);
        if (startMs !== null && endMs !== null) {
          sched = {
            startMs,
            endMs,
            startTimeSec: Math.floor(startMs / 1000),
            endTimeSec: Math.floor(endMs / 1000),
            cancelled: data.status === 'cancelled'
          };
        }
      }
    } catch (e) { }
  }

  if (!sched || isNaN(sched.startMs) || isNaN(sched.endMs)) {
    const startMs = parseCanonicalInstant(req.body?.start_time || req.body?.startTime);
    const endMs = parseCanonicalInstant(req.body?.end_time || req.body?.endTime);
    if (startMs !== null && endMs !== null) {
      sched = {
        startMs,
        endMs,
        startTimeSec: Math.floor(startMs / 1000),
        endTimeSec: Math.floor(endMs / 1000),
        cancelled: false
      };
    }
  }

  if (!sched || isNaN(sched.startMs) || isNaN(sched.endMs)) {
    return res.status(400).json({ success: false, error: 'Could not determine exam schedule.' });
  }

  const { switchModel, forceTransition } = req.body || {};
  const { code, body } = await executeModelCommand(examId, model, action, sched, {
    source: 'manual',
    switchModel: Boolean(switchModel || forceTransition)
  });
  res.status(code).json(body);
});

// ---- Authoritative Server-Side Exam Lifecycle Scheduler ----
//  - Evaluates every 5 seconds regardless of active browser sessions.
//  - One hour before exam: preflight both real models and the camera; leave workers stopped.
//  - Pre-exam: face verification runs only when explicitly started by an admin.
//  - Exam start: FV is automatically stopped; Device Detection automatically starts.
//  - Stop Detection = Pause (worker stopped, camera released, pause state persisted).
//  - Resume Detection = Restarts worker if within exam window and not completed.
//  - Exam end: Automatically marked 'completed', all detection stopped, retries cancelled.
let schedulerBusy = false;
let schedulerWarned = false;

function throttled(key) {
  const last = lastAutoAttempt.get(key) || 0;
  if (Date.now() - last < AUTO_RETRY_MS) return true;
  lastAutoAttempt.set(key, Date.now());
  return false;
}

async function allStudentsVerified(examId) {
  try {
    const { data, error } = await schedulerDb.from('exam_students').select('verification_status').eq('exam_id', examId);
    if (error || !data) return false;
    return data.length > 0 && data.every((r) => r.verification_status === 'verified');
  } catch {
    return false;
  }
}

async function modelSchedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const now = Date.now();
    const candidates = new Map(); // examId -> sched
    const dbExamIds = new Set();

    const { data: exams, error } = await schedulerDb
      .from('exams')
      .select('id, start_time, end_time, status, face_verification_enabled, device_detection_paused');

    if (error) {
      if (!schedulerWarned) {
        console.warn('[MODEL SCHEDULER] Notice reading exams:', error.message);
        schedulerWarned = true;
      }
    } else {
      (exams || []).forEach((e) => {
        dbExamIds.add(String(e.id));
        const startMs = parseCanonicalInstant(e.start_time);
        const endMs = parseCanonicalInstant(e.end_time);
        candidates.set(String(e.id), {
          startMs,
          endMs,
          cancelled: e.status === 'cancelled',
          completed: e.status === 'completed',
          fvEnabled: !!e.face_verification_enabled,
          ddPaused: !!e.device_detection_paused
        });
      });

      // Synchronize in-memory lifecycle: purge any exams deleted from Supabase (unless in dev memory store)
      let purgedAny = false;
      for (const id of Array.from(lifecycle.keys())) {
        if (!dbExamIds.has(String(id)) && !memoryExams.has(String(id))) {
          console.log(`[MODEL SCHEDULER] Purging non-existent/deleted exam from lifecycle: ${id}`);
          lifecycle.delete(id);
          purgedAny = true;
        }
      }
      if (purgedAny) persistLifecycle();
    }

    // Keep cached/offline exams ONLY when database query failed
    if (error) {
      lifecycle.forEach((lc, id) => {
        if (!candidates.has(id) && lc.sched) {
          candidates.set(id, { ...lc.sched, fvEnabled: !!lc.fvEnabled, ddPaused: !!lc.ddManuallyStopped });
        }
      });
    }

    const ordered = [...candidates.entries()]
      .filter(([, s]) => !isNaN(s.startMs) && !isNaN(s.endMs))
      .sort((a, b) => a[1].startMs - b[1].startMs);

    for (const [id, s] of ordered) {
      const lc = getLifecycle(id);
      if (s.fvEnabled !== undefined) lc.fvEnabled = s.fvEnabled;
      if (s.ddPaused !== undefined) lc.ddManuallyStopped = s.ddPaused;

      const ownsPi = modelState.examId === id && modelState.activeModel !== 'none';

      // 1. Exam over or cancelled -> Automatic completion & safe worker termination
      if (s.cancelled || s.completed || now >= s.endMs) {
        if (!s.completed && !s.cancelled && now >= s.endMs) {
          // Automatic exam completion transition
          console.log(`[MODEL SCHEDULER] Exam ${id} reached scheduled end time. Marking completed.`);
          await updateExamControlInDb(id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            device_detection_state: 'stopped',
            face_verification_enabled: false
          });
          broadcast({ type: 'EXAM_STATUS_UPDATED', examId: id, status: 'completed' });
        }

        if (ownsPi && piClients.size > 0 && !throttled(`${id}:${modelState.activeModel}:stop-end`)) {
          await executeModelCommand(id, modelState.activeModel, 'stop', s, { source: 'auto' });
        }
        if (modelState.examId === id) {
          applyModelState({ activeModel: 'none', examId: null, status: 'stopped', fps: null });
        }
        if (lifecycle.has(id)) {
          lifecycle.delete(id);
          persistLifecycle();
        }
        continue;
      }

      // 2. One-hour preparation window: validate both model weights and camera
      // through the Python bridge. Preflight performs one real inference frame,
      // releases the camera, and waits for the admin; it does NOT start FV.
      if (now >= s.startMs - FV_WINDOW_MS && now < s.startMs) {
        if (!lc.preparedModels) {
          lc.preparedModels = { face_verification: false, device_detection: false };
        }
        if (piClients.size > 0 && modelState.activeModel === 'none' && modelState.status !== 'paused') {
          for (const model of MODEL_NAMES) {
            if (!lc.preparedModels[model] && !throttled(`${id}:${model}:prepare`)) {
              const prepared = await executeModelCommand(id, model, 'prepare', s, { source: 'auto' });
              if (prepared.code !== 200) {
                console.warn(`[MODEL SCHEDULER] Preflight pending for exam ${id}, model ${model}: ${prepared.body?.error || prepared.code}`);
              }
            }
          }
        }
      }

      // 3. Scheduled Exam Window [startMs, endMs) -> Device detection active
      if (now >= s.startMs && now < s.endMs) {
        // Force-stop face verification if it was running
        const fvStillOn = lc.fvRunning || (ownsPi && modelState.activeModel === 'face_verification');
        if (fvStillOn) {
          const r = await executeModelCommand(id, 'face_verification', 'stop', s, { source: 'auto' });
          if (r.code !== 200) continue; // Pi must confirm FV is stopped before DD starts
        }

        // Automatic device detection startup (unless manually paused)
        if (modelState.activeModel === 'none' && !lc.ddManuallyStopped) {
          if (piClients.size > 0 && !throttled(`${id}:device_detection:start`)) {
            await executeModelCommand(id, 'device_detection', 'start', s, { source: 'auto' });
          } else if (piClients.size === 0) {
            // Pi is offline at start: advance lifecycle status, but keep device_detection_state 'idle' until Pi connects
            await updateExamControlInDb(id, {
              status: 'device_detection',
              device_detection_state: 'idle'
            });
          }
        }
        continue;
      }

      // 4. Pre-Exam Window (< startMs):
      // - Device detection remains OFF
      // - Face verification is OFF by default; runs ONLY if explicitly enabled by administrator
      if (lc.fvEnabled) {
        // Auto-stop if all assigned candidates are already verified
        if (await allStudentsVerified(id)) {
          console.log(`[MODEL SCHEDULER] All students verified for exam ${id}. Auto-stopping face verification.`);
          await executeModelCommand(id, 'face_verification', 'stop', s, { source: 'auto' });
        } else if (modelState.activeModel === 'none' && piClients.size > 0 && !throttled(`${id}:face_verification:recover`)) {
          // Restart/recover face verification worker if it stopped or Pi reconnected
          await executeModelCommand(id, 'face_verification', 'start', s, { source: 'auto' });
        }
      }
    }
  } catch (err) {
    console.warn('[MODEL SCHEDULER] Tick notice:', err.message);
  } finally {
    schedulerBusy = false;
  }
}

// Run once immediately on server startup, then keep the five-second recovery loop.
 // This prevents automatic exam/device startup from waiting for the first interval tick.
modelSchedulerTick().catch((err) => {
  console.warn('[MODEL SCHEDULER] Initial startup tick failed:', err.message);
});
setInterval(modelSchedulerTick, SCHEDULER_INTERVAL_MS);


// Default Fallback Data Structure for Resilient Offline / Failed DB Operations
const DEFAULT_ROVER_STATUS = {
  id: 1,
  battery: 88.0,
  speed: 0.4,
  location: 'LH-302, Aisle C',
  hall: 'Lecture Hall 302',
  floor: 3,
  wifiStatus: 'Connected',
  cameraStatus: 'Online',
  temperature: 38.5,
  cpuUsage: 45,
  storageUsed: 142.4,
  storageTotal: 512,
  motorStatus: 'Operational',
  currentMission: 'Aisle Sweep LH-302',
  estimatedTimeRemaining: 24,
  posX: 42,
  posY: 68,
  manualMode: false
};

const DEFAULT_SYSTEM_METRICS = {
  id: 1,
  backend: 'online',
  aiModel: 'online',
  camera: 'online',
  database: 'online',
  storage: 28,
  internet: 'connected',
  roverConnection: 'connected',
  modelFps: 29.8,
  inferenceTime: 32.4,
  cpu: 44.5,
  memory: 58.2,
  gpu: 67.1
};

const DEFAULT_SYSTEM_SETTINGS = {
  id: 1,
  examHalls: ['LH-302', 'LH-304', 'Auditorium-1', 'Main Lab'],
  aiThreshold: 85,
  suspicionThreshold: 65,
  notificationChannels: { dashboard: true, audioAlerts: true, smsDispatch: false, deanEmail: true },
  roverConfig: { patrolSpeed: 0.4, thermalInterval: 2, opticalTracking: true, rfJammerBlock: false },
  operators: [
    { name: 'Prof. S. Rangan', role: 'Exam Controller', active: true },
    { name: 'Officer Kiran Kumar', role: 'Operator', active: true },
    { name: 'Dr. Helen Carter', role: 'Admin', active: true },
    { name: 'Viewer Account', role: 'Viewer', active: true }
  ]
};

// Rover status (Admin, Exam Controller, Operator, Viewer)
app.get('/api/rover', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('rover_status').select('*').eq('id', 1).single();
    if (error || !data) {
      console.warn("Supabase fetch notice for /api/rover, returning fallback state.");
      return res.json(DEFAULT_ROVER_STATUS);
    }
    res.json(data);
  } catch (err) {
    res.json(DEFAULT_ROVER_STATUS);
  }
});

// Rover Control (Admin, Exam Controller, Operator only)
app.post('/api/rover/control', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  const { command } = req.body;

  try {
    let roverStatus;
    const { data, error: fetchErr } = await supabase.from('rover_status').select('*').eq('id', 1).single();
    if (fetchErr || !data) {
      roverStatus = { ...DEFAULT_ROVER_STATUS };
    } else {
      roverStatus = data;
    }

    // Universal Emergency Stop: always executes regardless of current mode
    if (command === 'estop') {
      roverStatus.speed = 0;
      roverStatus.motorStatus = 'Stopped';
      roverStatus.manualMode = false;
      const estopAlert = {
        id: 'estop_' + Date.now(),
        title: 'ROVER EMERGENCY STOP TRIGGERED',
        priority: 'CRITICAL',
        timestamp: new Date().toISOString(),
        location: roverStatus.location,
        actionTaken: 'Operator initiated immediate E-STOP hardware lock.',
        status: 'Active',
        details: 'Physical or manual remote Emergency Stop was executed. Drive motors disengaged immediately.'
      };
      try { await supabase.from('live_alerts').insert([estopAlert]); } catch (e) { }
      broadcast({ type: 'NEW_ALERT', alert: estopAlert });
    } else if (command === 'manual_toggle_on') {
      roverStatus.manualMode = true;
      roverStatus.speed = 0.0;
      roverStatus.currentMission = 'Manual Control Active';
    } else if (command === 'manual_toggle_off') {
      roverStatus.manualMode = false;
      roverStatus.speed = 0.4;
      roverStatus.currentMission = 'Aisle Sweep LH-302';
    } else if (command === 'stop') {
      roverStatus.speed = 0;
    } else if (command === 'home') {
      roverStatus.posX = 10;
      roverStatus.posY = 90;
      roverStatus.speed = 0.5;
      roverStatus.currentMission = 'Returning to Charging Dock';
    } else {
      // Directional commands (fwd, bwd, left, right) auto-engage manual pilot if not active
      roverStatus.manualMode = true;
      roverStatus.currentMission = 'Manual Control Active';
      switch (command) {
        case 'fwd':
          roverStatus.posY = Math.max(0, roverStatus.posY - 4);
          roverStatus.speed = 0.8;
          break;
        case 'bwd':
          roverStatus.posY = Math.min(100, roverStatus.posY + 4);
          roverStatus.speed = 0.8;
          break;
        case 'left':
          roverStatus.posX = Math.max(0, roverStatus.posX - 4);
          roverStatus.speed = 0.6;
          break;
        case 'right':
          roverStatus.posX = Math.min(100, roverStatus.posX + 4);
          roverStatus.speed = 0.6;
          break;
      }
    }

    try {
      await supabase.from('rover_status').update({
        manualMode: roverStatus.manualMode,
        speed: roverStatus.speed,
        currentMission: roverStatus.currentMission,
        posX: roverStatus.posX,
        posY: roverStatus.posY,
        motorStatus: roverStatus.motorStatus
      }).eq('id', 1);
    } catch (e) { }

    broadcast({ type: 'ROVER_UPDATE', rover: roverStatus });
    res.json({ success: true, rover: roverStatus });
  } catch (err) {
    res.json({ success: true, rover: DEFAULT_ROVER_STATUS });
  }
});

// Alerts (Admin, Exam Controller, Operator, Viewer)
app.get('/api/alerts', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('live_alerts').select('*').order('timestamp', { ascending: false });
    if (error || !data) throw new Error("Fallback alert list");

    const uniqueMap = new Map();
    (data || []).forEach(a => {
      const key = (a.id || (a.title + '_' + a.location)).trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, a);
      }
    });

    res.json(Array.from(uniqueMap.values()));
  } catch (err) {
    res.json([]);
  }
});

// Resolve Alert (Admin, Exam Controller, Operator only)
app.post('/api/alerts/:id/resolve', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  const { id } = req.params;
  const { status, action } = req.body;

  const updateFields = { id, status, actionTaken: action || 'Resolved by operator.' };

  try {
    const { data, error } = await supabase.from('live_alerts').update({ status, actionTaken: action }).eq('id', id).select().single();
    if (!error && data) {
      broadcast({ type: 'ALERT_RESOLVED', alert: data });
      return res.json({ success: true, alert: data });
    }
  } catch (err) { }

  broadcast({ type: 'ALERT_RESOLVED', alert: updateFields });
  res.json({ success: true, alert: updateFields });
});

// Trigger Alert (Admin, Exam Controller, Operator only)
app.post('/api/alerts/trigger', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  const { title, priority, location, details } = req.body;
  const newAlert = {
    id: 'custom_' + Date.now(),
    title,
    priority,
    location,
    details,
    actionTaken: 'Dispatched notification to standard terminals.',
    timestamp: new Date().toISOString(),
    status: 'Active'
  };

  try {
    await supabase.from('live_alerts').insert([newAlert]);
  } catch (err) { }

  broadcast({ type: 'NEW_ALERT', alert: newAlert });
  res.json({ success: true, alert: newAlert });
});

// System Metrics (Admin, Exam Controller, Operator, Viewer)
app.get('/api/metrics', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('system_metrics').select('*').eq('id', 1).single();
    if (error || !data) return res.json(DEFAULT_SYSTEM_METRICS);
    res.json(data);
  } catch (err) {
    res.json(DEFAULT_SYSTEM_METRICS);
  }
});

// Logs (Admin, Exam Controller, Operator, Viewer)
app.get('/api/logs', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('ai_detection_logs').select('*').order('timestamp', { ascending: false });
    if (error || !data) return res.json([]);
    res.json(data);
  } catch (err) {
    res.json([]);
  }
});

// Settings (GET - Admin, Exam Controller, Operator, Viewer)
app.get('/api/settings', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (error || !data) return res.json(DEFAULT_SYSTEM_SETTINGS);
    res.json(data);
  } catch (err) {
    res.json(DEFAULT_SYSTEM_SETTINGS);
  }
});

// Settings (POST - Admin, Exam Controller only)
app.post('/api/settings', authenticateUser, authorizeRoles('Admin', 'Exam Controller'), async (req, res) => {
  try {
    const updated = { ...DEFAULT_SYSTEM_SETTINGS, ...req.body };
    try {
      await supabase.from('system_settings').update(req.body).eq('id', 1);
    } catch (e) { }
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.json({ success: true, settings: DEFAULT_SYSTEM_SETTINGS });
  }
});



// ==========================================
// Real-time Event Simulation via WebSockets (Authenticated Staff Only)
// ==========================================

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const clients = new Set();

wss.on('connection', async (ws) => {
  ws.authenticated = false;
  ws.user = null;
  ws.userRole = null;

  // Enforce staff authentication timeout (7 seconds)
  const authTimeout = setTimeout(() => {
    if (!ws.authenticated) {
      try {
        ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Authentication timeout. Authorized staff credentials required.' }));
        ws.close(4401, 'Authentication timeout');
      } catch (e) {}
    }
  }, 7000);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'AUTH') {
        const token = data.token?.trim();
        if (!token) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Missing access token in AUTH packet.' }));
          ws.close(4401, 'Unauthorized');
          return;
        }

        if (process.env.NODE_ENV !== 'production' && token === 'dev-test-admin-token') {
          clearTimeout(authTimeout);
          ws.authenticated = true;
          ws.user = { id: 'dev-admin-id', email: 'dev-admin@examshield.edu' };
          ws.userRole = 'Admin';
          clients.add(ws);
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', role: 'Admin' }));
          return;
        }

        try {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (error || !user) {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Invalid or expired session token.' }));
            ws.close(4401, 'Unauthorized');
            return;
          }

          const trustedRole = user.app_metadata?.role;
          const ALLOWED_STAFF_ROLES = ['Admin', 'Exam Controller', 'Operator', 'Viewer'];
          if (!trustedRole || !ALLOWED_STAFF_ROLES.includes(trustedRole)) {
            ws.send(JSON.stringify({
              type: 'AUTH_ERROR',
              error: 'Access denied: account lacks an authorized staff role.'
            }));
            ws.close(4403, 'Forbidden');
            return;
          }

          clearTimeout(authTimeout);
          ws.authenticated = true;
          ws.user = user;
          ws.userRole = trustedRole;
          clients.add(ws);

          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', role: trustedRole }));

          // Deliver initial telemetry snapshot to authorized staff client
          const [roverRes, metricsRes, alertsRes, studentsRes] = await Promise.allSettled([
            supabase.from('rover_status').select('*').eq('id', 1).single(),
            supabase.from('system_metrics').select('*').eq('id', 1).single(),
            supabase.from('live_alerts').select('*').order('timestamp', { ascending: false }),
            supabase.from('students').select('*').order('id')
          ]);

          const rover = (roverRes.status === 'fulfilled' && !roverRes.value.error && roverRes.value.data) || DEFAULT_ROVER_STATUS;
          const metrics = (metricsRes.status === 'fulfilled' && !metricsRes.value.error && metricsRes.value.data) || DEFAULT_SYSTEM_METRICS;
          const alerts = (alertsRes.status === 'fulfilled' && !alertsRes.value.error && alertsRes.value.data) || [];
          const students = (studentsRes.status === 'fulfilled' && !studentsRes.value.error && studentsRes.value.data) || [];

          // Deduplicate students
          const uniqueStudentMap = new Map();
          (students || []).forEach(s => {
            const key = (s.hallTicket || s.name || s.id || '').trim().toLowerCase();
            if (!uniqueStudentMap.has(key)) {
              uniqueStudentMap.set(key, s);
            }
          });

          const uniqueAlertMap = new Map();
          (alerts || []).forEach(a => {
            const key = (a.id || (a.title + '_' + a.location)).trim().toLowerCase();
            if (!uniqueAlertMap.has(key)) {
              uniqueAlertMap.set(key, a);
            }
          });

          ws.send(JSON.stringify({
            type: 'INITIAL_STATE',
            rover,
            metrics,
            alerts: Array.from(uniqueAlertMap.values()),
            students: Array.from(uniqueStudentMap.values())
          }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Auth error: ' + err.message }));
          ws.close(4401, 'Unauthorized');
        }
        return;
      }

      // Raspberry Pi 4 bridge authentication (shared secret, separate from staff auth)
      if (data.type === 'PI_AUTH') {
        const isSim = Boolean(data.isSimulator);
        if (isSim && process.env.NODE_ENV === 'production') {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Hardware simulator is forbidden in production environment.' }));
          ws.close(4403, 'Forbidden in production');
          return;
        }

        if (!isValidPiKey(data.key, isSim)) {
          ws.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Invalid or missing Pi bridge key (set PI_BRIDGE_KEY on server and Pi).' }));
          ws.close(4401, 'Unauthorized');
          return;
        }
        clearTimeout(authTimeout);
        ws.authenticated = true;
        ws.isPi = true;
        ws.isSimulator = isSim;
        piClients.add(ws);
        if (isSim) {
          console.log('[PI BRIDGE] Development Simulator Pi connected.');
        } else {
          console.log('[PI BRIDGE] Physical Raspberry Pi bridge connected.');
        }
        ws.send(JSON.stringify({ type: 'PI_AUTH_SUCCESS', isSimulator: isSim }));
        broadcast({ type: 'MODEL_STATUS', model: getModelStatusPayload() });

        // Reconcile Pi state with authoritative active exam
        (async () => {
          try {
            let activeExam = null;
            const nowMs = Date.now();
            const isUsableExam = (exam) => {
              if (!exam || exam.status === 'completed' || exam.status === 'cancelled') return false;
              const startMs = Date.parse(exam.start_time);
              const endMs = Date.parse(exam.end_time);
              if (Number.isNaN(startMs) || Number.isNaN(endMs) || nowMs >= endMs) return false;

              // Reconciliation may restore a previously running model only.
              // A future scheduled exam must NEVER start device detection just
              // because the Python bridge reconnects.
              if (modelState.activeModel === 'face_verification' && String(modelState.examId) === String(exam.id)) {
                return nowMs >= startMs - FV_WINDOW_MS && nowMs < startMs;
              }
              if (modelState.activeModel === 'device_detection' && String(modelState.examId) === String(exam.id)) {
                return nowMs >= startMs && nowMs < endMs;
              }
              if (modelState.status === 'paused' && String(modelState.examId) === String(exam.id)) {
                return nowMs >= startMs && nowMs < endMs;
              }
              return false;
            };

            // 1. Restore only a genuinely allocated worker for a valid exam window.
            // Never infer a running device model merely because an exam is scheduled.
            if (modelState.examId) {
              let currentExam = memoryExams.get(modelState.examId);
              if (!currentExam) {
                const { data } = await schedulerDb.from('exams').select('*').eq('id', modelState.examId).single();
                currentExam = data;
              }
              if (isUsableExam(currentExam)) activeExam = currentExam;
            }

            // 2. Do not select an arbitrary future exam from memory. The scheduler
            // will prepare it one hour before start; only an exam currently in its
            // scheduled window can be reconciled into device detection.
            if (!activeExam) {
              const now = new Date();
              const { data: activeExams } = await schedulerDb
                .from('exams')
                .select('*')
                .lte('start_time', now.toISOString())
                .gte('end_time', now.toISOString())
                .order('start_time', { ascending: false });

              activeExam = (activeExams || []).find(e =>
                e.status !== 'completed' && e.status !== 'cancelled' &&
                (e.status === 'device_detection' || e.status === 'in_progress' || e.status === 'active')
              ) || null;
            }

            if (activeExam) {
              const isPaused = activeExam.device_detection_paused === true || (activeExam.id === modelState.examId && modelState.status === 'paused');
              const desiredModel = isPaused ? 'none' : 'device_detection';
              const startSec = Math.floor(parseCanonicalInstant(activeExam.start_time) / 1000);
              const endSec = Math.floor(parseCanonicalInstant(activeExam.end_time) / 1000);
              ws.send(JSON.stringify({
                type: 'RECONCILE_STATE',
                desiredModel,
                activeModel: isPaused ? 'none' : 'device_detection',
                examId: activeExam.id,
                startTime: activeExam.start_time,
                endTime: activeExam.end_time,
                startTimeSec: isNaN(startSec) ? null : startSec,
                endTimeSec: isNaN(endSec) ? null : endSec,
                isPaused
              }));
            } else {
              // No active ongoing exam; ensure Pi is stopped/idle and release allocation
              applyModelState({ activeModel: 'none', examId: null, status: 'stopped', fps: null });
              ws.send(JSON.stringify({
                type: 'RECONCILE_STATE',
                desiredModel: 'none',
                examId: null,
                startTime: null,
                endTime: null,
                startTimeSec: null,
                endTimeSec: null,
                isPaused: false
              }));
            }
          } catch (e) {
            console.warn('[Pi Bridge] State reconciliation check failed on connect:', e.message);
          }
        })();
        return;
      }

      if (ws.isPi && data.type === 'MODEL_ACK') {
        const resolver = pendingModelAcks.get(data.requestId);
        if (resolver) resolver({ ok: !!data.ok, error: data.error });
        return;
      }

      if (ws.isPi && data.type === 'MODEL_STATUS') {
        const nextActiveModel = MODEL_NAMES.includes(data.activeModel) ? data.activeModel : 'none';
        const nextStatus = data.status || 'stopped';

        // Preserve ownership if model is paused or actively running for this exam
        let nextExamId = null;
        if (nextActiveModel !== 'none') {
          nextExamId = data.examId || modelState.examId;
        } else if (nextStatus === 'paused' || modelState.status === 'paused') {
          nextExamId = data.examId || modelState.examId;
        } else if (nextStatus === 'running' && data.examId) {
          nextExamId = data.examId;
        }

        const next = {
          activeModel: nextActiveModel,
          examId: nextExamId,
          status: nextStatus,
          fps: typeof data.fps === 'number' ? data.fps : null,
          error: data.error || null
        };

        // Synchronize per-exam lifecycle tracking with physical worker state
        const targetEid = nextExamId || modelState.examId;
        if (targetEid && lifecycle.has(String(targetEid))) {
          const lc = getLifecycle(String(targetEid));
          lc.fvRunning = (nextActiveModel === 'face_verification' && nextStatus === 'running');
        }

        // Only broadcast when the meaningful state changed (Pi reports every few seconds)
        if (next.activeModel !== modelState.activeModel || next.status !== modelState.status || next.examId !== modelState.examId || next.error !== modelState.error) {
          applyModelState(next);
        } else {
          modelState = { ...modelState, fps: next.fps };
        }
        return;
      }

      if (ws.isPi && data.type === 'CANDIDATE_VERIFIED') {
        broadcast({
          type: 'STUDENT_VERIFICATION_UPDATED',
          examId: data.examId,
          studentId: data.studentId,
          studentName: data.studentName,
          verification_status: data.status,
          verified_at: data.status === 'verified' ? new Date().toISOString() : null,
          similarity: data.similarity
        });
        return;
      }

      if (ws.isPi && data.type === 'ALL_STUDENTS_VERIFIED') {
        console.log(`[PI BRIDGE] All candidates verified for exam ${data.examId}. Stopping face verification.`);
        const lc = getLifecycle(String(data.examId));
        lc.fvEnabled = false;
        lc.fvRunning = false;
        persistLifecycle();
        await updateExamControlInDb(String(data.examId), { face_verification_enabled: false }).catch(() => {});
        broadcast({ type: 'ALL_STUDENTS_VERIFIED', examId: data.examId });
        broadcast({ type: 'MODEL_STATUS', model: getModelStatusPayload() });
        return;
      }

      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }
    } catch (e) {
      // Ignore malformed packets
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimeout);
    clients.delete(ws);
    if (ws.isPi) {
      const wasSim = ws.isSimulator;
      piClients.delete(ws);
      if (wasSim) {
        console.log('[PI BRIDGE] Development Simulator Pi disconnected.');
      } else {
        console.log('[PI BRIDGE] Physical Raspberry Pi bridge disconnected.');
      }
      if (piClients.size === 0) {
        pendingModelAcks.forEach((resolve) => resolve({ ok: false, error: 'Raspberry Pi disconnected.' }));
        // Safe recovery policy: preserve allocated examId if exam is active, but mark activeModel 'none' and status 'paused'
        applyModelState({
          activeModel: 'none',
          examId: modelState.examId,
          status: modelState.status === 'running' ? 'paused' : modelState.status,
          fps: null
        });
      } else {
        broadcast({ type: 'MODEL_STATUS', model: getModelStatusPayload() });
      }
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws' || request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.authenticated && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// Simulated active telemetry updates (patrolling, battery drain, inference jitter)
setInterval(async () => {
  try {
    const { data: roverStatus } = await supabase.from('rover_status').select('*').eq('id', 1).single();
    const { data: systemMetrics } = await supabase.from('system_metrics').select('*').eq('id', 1).single();
    if (!roverStatus || !systemMetrics) return;

    // 1. Decay Battery slowly
    if (roverStatus.battery > 5) {
      roverStatus.battery = parseFloat((roverStatus.battery - 0.01).toFixed(2));
    }

    // 2. Rover Patrol Simulation
    if (!roverStatus.manualMode && roverStatus.motorStatus === 'Operational') {
      const time = Date.now() / 15000;
      const posX = Math.round(50 + 35 * Math.sin(time));
      const posY = Math.round(50 + 25 * Math.cos(time * 0.8));

      roverStatus.posX = posX;
      roverStatus.posY = posY;
      roverStatus.speed = 0.4;
      roverStatus.location = `LH-302, Aisle ${posX > 50 ? 'Right' : 'Left'} (Row ${String.fromCharCode(65 + Math.floor(posY / 15))})`;

      await supabase.from('rover_status').update({
        battery: roverStatus.battery,
        posX: roverStatus.posX,
        posY: roverStatus.posY,
        speed: roverStatus.speed,
        location: roverStatus.location
      }).eq('id', 1);

      broadcast({ type: 'ROVER_UPDATE', rover: roverStatus });
    }

    // 3. System Metrics Jitter
    systemMetrics.cpu = Math.round(40 + Math.random() * 12);
    systemMetrics.memory = Math.round(55 + Math.random() * 5);
    systemMetrics.gpu = Math.round(60 + Math.random() * 15);
    systemMetrics.modelFps = parseFloat((28.5 + Math.random() * 2.5).toFixed(1));
    systemMetrics.inferenceTime = parseFloat((29 + Math.random() * 6).toFixed(1));

    await supabase.from('system_metrics').update({
      cpu: systemMetrics.cpu,
      memory: systemMetrics.memory,
      gpu: systemMetrics.gpu,
      modelFps: systemMetrics.modelFps,
      inferenceTime: systemMetrics.inferenceTime
    }).eq('id', 1);

    broadcast({ type: 'METRICS_UPDATE', metrics: systemMetrics });
  } catch (err) {
    // Background simulation error handler
  }
}, 4000);

// ==========================================
// Serve production build files
// ==========================================
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  startVite();
}

async function startVite() {
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      proxy: {} 
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ExamShield Full-Stack Server listening on http://localhost:${PORT}`);
});
