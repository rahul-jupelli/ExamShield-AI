import 'dotenv/config';
import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

// Initialize Express App
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ylhryvakpswdgapooica.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_DxCOoa3jXlXkhflv_sStjw_dRNjSd7I";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// Database Deduplication Utility Function
// ==========================================
async function cleanDuplicateDatabaseRecords() {
  console.log('[DEDUPLICATION] Running database cleanup for public tables...');
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
        console.log(`[DEDUPLICATION] Found ${duplicateStudentIdsToDelete.length} duplicate student records in Supabase. Removing...`);
        const { error: delErr } = await supabase.from('students').delete().in('id', duplicateStudentIdsToDelete);
        if (delErr) {
          console.error('[DEDUPLICATION] Delete student duplicates error:', delErr.message);
        } else {
          console.log(`[DEDUPLICATION] Cleaned ${duplicateStudentIdsToDelete.length} duplicate student records.`);
        }
      } else {
        console.log('[DEDUPLICATION] Students table is clean. No duplicates found.');
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
        console.log(`[DEDUPLICATION] Found ${duplicateAlertIdsToDelete.length} duplicate alert records in Supabase. Removing...`);
        const { error: delErr } = await supabase.from('live_alerts').delete().in('id', duplicateAlertIdsToDelete);
        if (delErr) {
          console.error('[DEDUPLICATION] Delete alert duplicates error:', delErr.message);
        } else {
          console.log(`[DEDUPLICATION] Cleaned ${duplicateAlertIdsToDelete.length} duplicate alert records.`);
        }
      } else {
        console.log('[DEDUPLICATION] Live alerts table is clean. No duplicates found.');
      }
    }
  } catch (err) {
    console.error('[DEDUPLICATION] Error performing database cleanup:', err.message);
  }
}

// Run cleanup immediately on server startup
cleanDuplicateDatabaseRecords();

// ==========================================
// API REST Routes (Fetching & Persisting in Supabase)
// ==========================================

// Deduplication Endpoint
app.post('/api/cleanup-duplicates', async (req, res) => {
  await cleanDuplicateDatabaseRecords();
  res.json({ success: true, message: 'Database deduplication check completed.' });
});

// Health Check - Supabase connectivity
app.get('/api/health', async (req, res) => {
  try {
    const tables = ['students', 'live_alerts', 'rover_status', 'system_metrics', 'ai_detection_logs', 'system_settings'];
    const results = {};

    for (const table of tables) {
      try {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        results[table] = error ? { status: 'ERROR', message: error.message } : { status: 'OK', rows: count };
      } catch (tableErr) {
        results[table] = { status: 'ERROR', message: tableErr.message };
      }
    }

    const allOk = Object.values(results).every(r => r.status === 'OK');
    res.json({
      supabase: allOk ? 'connected' : 'partial',
      url: supabaseUrl,
      tables: results
    });
  } catch (err) {
    res.status(500).json({ supabase: 'error', message: err.message });
  }
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body;
  if (username && role) {
    const fullName = username.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    res.json({
      success: true,
      username,
      role,
      fullName: fullName || 'Authorized Officer',
      token: 'jwt-examshield-token-' + role.toLowerCase()
    });
  } else {
    res.status(400).json({ success: false, error: 'Username and Role are required' });
  }
});

// Students (Deduplicated response)
app.get('/api/students', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('*').order('id');
    if (error) throw error;
    
    // Deduplicate by hallTicket / name / id to keep original rows only
    const uniqueMap = new Map();
    (data || []).forEach(s => {
      const key = (s.hallTicket || s.name || s.id || '').trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    });

    res.json(Array.from(uniqueMap.values()));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/students/:id/decision', async (req, res) => {
  const { id } = req.params;
  const { decision } = req.body;

  const updateFields = { entryDecision: decision };
  if (decision === 'Allowed') {
    updateFields.status = 'Verified Safe';
    updateFields.entryAllowed = true;
  } else if (decision === 'Denied') {
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

// Rover status
app.get('/api/rover', async (req, res) => {
  try {
    const { data, error } = await supabase.from('rover_status').select('*').eq('id', 1).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/rover/control', async (req, res) => {
  const { command } = req.body;

  try {
    const { data: roverStatus, error: fetchErr } = await supabase.from('rover_status').select('*').eq('id', 1).single();
    if (fetchErr) throw fetchErr;

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
          await supabase.from('live_alerts').insert([estopAlert]);
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

    const { data: updatedRover, error: updateErr } = await supabase.from('rover_status').update({
      manualMode: roverStatus.manualMode,
      speed: roverStatus.speed,
      currentMission: roverStatus.currentMission,
      posX: roverStatus.posX,
      posY: roverStatus.posY,
      motorStatus: roverStatus.motorStatus
    }).eq('id', 1).select().single();

    if (updateErr) throw updateErr;

    broadcast({ type: 'ROVER_UPDATE', rover: updatedRover });
    res.json({ success: true, rover: updatedRover });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alerts (Deduplicated response)
app.get('/api/alerts', async (req, res) => {
  try {
    const { data, error } = await supabase.from('live_alerts').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    
    // Deduplicate by title & location or id
    const uniqueMap = new Map();
    (data || []).forEach(a => {
      const key = (a.id || (a.title + '_' + a.location)).trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, a);
      }
    });

    res.json(Array.from(uniqueMap.values()));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/alerts/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { status, action } = req.body;

  const updateFields = { status };
  if (action) updateFields.actionTaken = action;

  try {
    const { data, error } = await supabase.from('live_alerts').update(updateFields).eq('id', id).select().single();
    if (error) throw error;
    broadcast({ type: 'ALERT_RESOLVED', alert: data });
    res.json({ success: true, alert: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/alerts/trigger', async (req, res) => {
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
    const { data, error } = await supabase.from('live_alerts').insert([newAlert]).select().single();
    if (error) throw error;
    broadcast({ type: 'NEW_ALERT', alert: data });
    res.json({ success: true, alert: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// System Metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const { data, error } = await supabase.from('system_metrics').select('*').eq('id', 1).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Logs
app.get('/api/logs', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ai_detection_logs').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { data: currentSettings } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    const updated = { ...currentSettings, ...req.body };
    delete updated.id;
    delete updated.updated_at;

    const { data, error } = await supabase.from('system_settings').update(updated).eq('id', 1).select().single();
    if (error) throw error;
    res.json({ success: true, settings: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================
// Real-time Event Simulation via WebSockets
// ==========================================

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const clients = new Set();

wss.on('connection', async (ws) => {
  clients.add(ws);

  try {
    const [
      { data: rover },
      { data: metrics },
      { data: alerts },
      { data: students }
    ] = await Promise.all([
      supabase.from('rover_status').select('*').eq('id', 1).single(),
      supabase.from('system_metrics').select('*').eq('id', 1).single(),
      supabase.from('live_alerts').select('*').order('timestamp', { ascending: false }),
      supabase.from('students').select('*').order('id')
    ]);

    // Deduplicate students before broadcasting initial state over WebSocket
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
    console.error("Error fetching initial state from Supabase for WebSocket:", err);
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      // Ignore
    }
  });

  ws.on('close', () => {
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
    if (client.readyState === WebSocket.OPEN) {
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
