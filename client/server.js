import 'dotenv/config';
import dns from 'dns';
import express from 'express';
import path from 'path';
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

// Run cleanup immediately on server startup
cleanDuplicateDatabaseRecords();

// ==========================================
// Authentication & Role Authorization Middleware
// ==========================================

// Helper to get authenticated user from Bearer token
async function authenticateUser(req, res, next) {
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

// Students (Deduplicated response - Staff view only)
app.get('/api/students', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('*').order('timestamp', { ascending: false });
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

    res.json(Array.from(uniqueMap.values()));
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
app.post('/api/students/:id/decision', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  const { id } = req.params;
  const { decision } = req.body;

  const updateFields = { entryDecision: decision };
  if (decision === 'Allowed') {
    updateFields.status = 'Verified';
    updateFields.entryAllowed = true;
  } else if (decision === 'Denied') {
    updateFields.status = 'Pending';
    updateFields.entryAllowed = false;
  }

  try {
    const { data, error } = await supabase.from('students').update(updateFields).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, student: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Exam Management & Surveillance Endpoints
// ==========================================

// Get all exams (Available to Admin, Exam Controller, Operator, Viewer)
app.get('/api/exams', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('exams').select('*').order('start_time', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create exam with student assignments (Admin, Exam Controller only)
app.post('/api/exams', authenticateUser, authorizeRoles('Admin', 'Exam Controller'), async (req, res) => {
  try {
    const { exam, student_ids } = req.body;
    if (!exam || !exam.exam_name || !exam.start_time || !exam.end_time) {
      return res.status(400).json({ success: false, error: 'Missing required exam fields.' });
    }

    const { data: createdExam, error: examErr } = await supabase
      .from('exams')
      .insert([exam])
      .select()
      .single();

    if (examErr) throw examErr;

    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const records = student_ids.map(sId => ({
        exam_id: createdExam.id,
        student_id: sId,
        verification_status: 'unverified'
      }));
      await supabase.from('exam_students').insert(records);
    }

    res.json({ success: true, exam: createdExam });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get assigned students for exam (Admin, Exam Controller, Operator, Viewer)
app.get('/api/exams/:id/students', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('exam_students')
      .select('*, student:students(*)')
      .eq('exam_id', id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update per-exam student verification status (Admin, Exam Controller, Operator)
app.put('/api/exams/:id/students/:studentId', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { verification_status } = req.body;

    const verified_at = verification_status === 'verified' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('exam_students')
      .update({ verification_status, verified_at })
      .eq('exam_id', id)
      .eq('student_id', studentId)
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get incidents for an exam (Admin, Exam Controller, Operator, Viewer)
app.get('/api/exams/:id/incidents', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('device_incidents')
      .select('*, student:students(*)')
      .eq('exam_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all incidents across exams (Admin, Exam Controller, Operator)
app.get('/api/incidents', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('device_incidents')
      .select('*, exam:exams(*), student:students(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update incident review status (Admin, Exam Controller, Operator)
app.put('/api/incidents/:id/review', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { review_status, student_id, reviewed_by } = req.body;

    const { data, error } = await supabase
      .from('device_incidents')
      .update({
        review_status,
        student_id: student_id || null,
        reviewed_by: reviewed_by || 'Admin Officer',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rover inference node health check
app.get('/api/rover/inference-node', authenticateUser, authorizeRoles('Admin', 'Exam Controller', 'Operator', 'Viewer'), (req, res) => {
  // Clear indicator for future Raspberry Pi 4 integration
  res.json({
    connected: false,
    hardware: 'Raspberry Pi 4 Model B (Inference System)',
    endpoint: '/api/rover/inference-stream',
    status: 'Standby / Waiting for hardware socket connection',
    timestamp: new Date().toISOString()
  });
});


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

    if (command === 'manual_toggle_on') {
      roverStatus.manualMode = true;
      roverStatus.speed = 0.0;
      roverStatus.currentMission = 'Manual Control Active';
    } else if (command === 'manual_toggle_off') {
      roverStatus.manualMode = false;
      roverStatus.speed = 0.4;
      roverStatus.currentMission = 'Aisle Sweep LH-302';
    } else if (roverStatus.manualMode) {
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
        case 'stop':
          roverStatus.speed = 0;
          break;
        case 'estop':
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
          break;
        case 'home':
          roverStatus.posX = 10;
          roverStatus.posY = 90;
          roverStatus.speed = 0.5;
          roverStatus.currentMission = 'Returning to Charging Dock';
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
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ExamShield Full-Stack Server listening on http://localhost:${PORT}`);
});
