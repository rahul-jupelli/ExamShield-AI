import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { Student, LiveAlert, RoverStatus, SystemMetrics, AIDetectionLog } from './src/types';

// Initialize Express App
const app = express();
app.use(express.json());

const PORT = 3000;

// ==========================================
// In-Memory Database (Realistic Initial Data)
// ==========================================

const INITIAL_STUDENTS: Student[] = [
  // Group 1: Device Detected (RED)
  {
    id: 's1',
    name: 'Aditya Vardhan',
    hallTicket: 'HT2026A405',
    branch: 'Computer Science & AI',
    room: 'LH-302',
    seat: 'Row C-4',
    photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    status: 'Device Detected',
    detectedDevice: 'Smart Watch (v4.2 Active)',
    detectionConfidence: 98.6,
    timestamp: '2026-07-21T10:05:12Z',
    faceConfidence: 99.1,
    entryDecision: 'Denied',
    verificationHistory: ['09:45 AM - RFID Verified', '09:46 AM - Face Match Passed (99.1%)', '10:05 AM - Smart Watch detected by Rover RF Scanner'],
    violationHistory: ['Active smart-device transmission intercepted near seat C-4. Spec-ID: SW-405.'],
    snapshot: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 's2',
    name: 'Meera Deshmukh',
    hallTicket: 'HT2026B112',
    branch: 'Electronics & Communication',
    room: 'LH-302',
    seat: 'Row F-12',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'Device Detected',
    detectedDevice: 'Micro Bluetooth Earbud (RF Beacon active)',
    detectionConfidence: 94.2,
    timestamp: '2026-07-21T10:08:44Z',
    faceConfidence: 98.4,
    entryDecision: 'Denied',
    verificationHistory: ['09:48 AM - RFID Verified', '09:49 AM - Face Match Passed (98.4%)', '10:08 AM - Thermal/RF spike detected around left ear'],
    violationHistory: ['Unsanctioned micro-receiver transmitting at 2.4GHz. Signal strength -45dBm.'],
    snapshot: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
  },
  // Group 2: Suspicious (ORANGE)
  {
    id: 's3',
    name: 'Rahul Khanna',
    hallTicket: 'HT2026A488',
    branch: 'Information Technology',
    room: 'LH-302',
    seat: 'Row A-7',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'Suspicious',
    suspicionScore: 82,
    suspicionReason: 'Frequent looking down & hands concealing lap area (AI Pose Estimation Flag)',
    timestamp: '2026-07-21T10:02:15Z',
    faceConfidence: 97.2,
    entryDecision: 'Pending',
    verificationHistory: ['09:42 AM - RFID Verified', '09:43 AM - Face Match Passed (97.2%)', '10:02 AM - Rover Camera flagged pose: Gaze-deviated (82% suspicion)'],
    violationHistory: ['No direct electronic signature, but active optical concealing detected.'],
    snapshot: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 's4',
    name: 'Sneha Reddy',
    hallTicket: 'HT2026C201',
    branch: 'AI & Data Science',
    room: 'LH-304',
    seat: 'Row E-3',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    status: 'Suspicious',
    suspicionScore: 68,
    suspicionReason: 'Repetitive backward glancing & erratic head posture',
    timestamp: '2026-07-21T10:11:30Z',
    faceConfidence: 96.5,
    entryDecision: 'Pending',
    verificationHistory: ['09:52 AM - RFID Verified', '09:53 AM - Face Match Passed (96.5%)', '10:11 AM - Object detection flagged: Head pitch deviation'],
    violationHistory: ['Excessive neck movement detected (exceeding room baselines). Monitor active.'],
    snapshot: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&auto=format&fit=crop&q=80'
  },
  // Group 3: Verified Safe Students (GREEN)
  {
    id: 's5',
    name: 'Ananya Iyer',
    hallTicket: 'HT2026A102',
    branch: 'Computer Science',
    room: 'LH-302',
    seat: 'Row B-1',
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    status: 'Verified Safe',
    verificationCompleted: true,
    entryAllowed: true,
    timestamp: '2026-07-21T09:35:00Z',
    faceConfidence: 99.8,
    entryDecision: 'Allowed',
    verificationHistory: ['09:34 AM - RFID Scanned', '09:35 AM - Facial Recognition Completed (99.8%)', '09:40 AM - Rover initial sweep: Cleared'],
    violationHistory: []
  },
  {
    id: 's6',
    name: 'Vikram Malhotra',
    hallTicket: 'HT2026A105',
    branch: 'Computer Science',
    room: 'LH-302',
    seat: 'Row B-2',
    photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    status: 'Verified Safe',
    verificationCompleted: true,
    entryAllowed: true,
    timestamp: '2026-07-21T09:36:10Z',
    faceConfidence: 99.4,
    entryDecision: 'Allowed',
    verificationHistory: ['09:35 AM - RFID Scanned', '09:36 AM - Facial Recognition Completed (99.4%)', '09:40 AM - Rover initial sweep: Cleared'],
    violationHistory: []
  },
  {
    id: 's7',
    name: 'Pooja Bhat',
    hallTicket: 'HT2026A302',
    branch: 'Information Technology',
    room: 'LH-302',
    seat: 'Row B-3',
    photo: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=150&auto=format&fit=crop&q=80',
    status: 'Verified Safe',
    verificationCompleted: true,
    entryAllowed: true,
    timestamp: '2026-07-21T09:38:22Z',
    faceConfidence: 98.9,
    entryDecision: 'Allowed',
    verificationHistory: ['09:37 AM - RFID Scanned', '09:38 AM - Facial Recognition Completed (98.9%)', '09:42 AM - Rover initial sweep: Cleared'],
    violationHistory: []
  },
  {
    id: 's8',
    name: 'Siddharth Rao',
    hallTicket: 'HT2026B101',
    branch: 'Electronics & Communication',
    room: 'LH-302',
    seat: 'Row C-1',
    photo: 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150&auto=format&fit=crop&q=80',
    status: 'Verified Safe',
    verificationCompleted: true,
    entryAllowed: true,
    timestamp: '2026-07-21T09:41:05Z',
    faceConfidence: 99.2,
    entryDecision: 'Allowed',
    verificationHistory: ['09:40 AM - RFID Scanned', '09:41 AM - Facial Recognition Completed (99.2%)', '09:45 AM - Rover initial sweep: Cleared'],
    violationHistory: []
  },
  {
    id: 's9',
    name: 'Kunal Sen',
    hallTicket: 'HT2026A204',
    branch: 'Electrical Engineering',
    room: 'LH-302',
    seat: 'Row C-2',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    status: 'Verified Safe',
    verificationCompleted: true,
    entryAllowed: true,
    timestamp: '2026-07-21T09:43:18Z',
    faceConfidence: 98.1,
    entryDecision: 'Allowed',
    verificationHistory: ['09:42 AM - RFID Scanned', '09:43 AM - Facial Recognition Completed (98.1%)', '09:48 AM - Rover initial sweep: Cleared'],
    violationHistory: []
  },
  {
    id: 's10',
    name: 'Riya Verma',
    hallTicket: 'HT2026C110',
    branch: 'AI & Data Science',
    room: 'LH-302',
    seat: 'Row C-3',
    photo: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80',
    status: 'Verified Safe',
    verificationCompleted: true,
    entryAllowed: true,
    timestamp: '2026-07-21T09:44:50Z',
    faceConfidence: 99.5,
    entryDecision: 'Allowed',
    verificationHistory: ['09:43 AM - RFID Scanned', '09:44 AM - Facial Recognition Completed (99.5%)', '09:50 AM - Rover initial sweep: Cleared'],
    violationHistory: []
  }
];

let liveAlerts: LiveAlert[] = [
  {
    id: 'a1',
    title: 'Smart Watch Emission Detected',
    priority: 'CRITICAL',
    timestamp: '2026-07-21T10:05:12Z',
    location: 'LH-302 (Seat C-4)',
    actionTaken: 'Rover locked camera focus. Highlighted student Aditya Vardhan.',
    status: 'Investigating',
    snapshot: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    details: 'Aditya Vardhan (HT2026A405) was scanned by the Rover. The embedded RF Analyzer picked up active smart-device transmissions synced with suspicious pulse frequency around the wrist area.'
  },
  {
    id: 'a2',
    title: 'Unsanctioned Bluetooth Beacon Intercepted',
    priority: 'HIGH',
    timestamp: '2026-07-21T10:08:44Z',
    location: 'LH-302 (Seat F-12)',
    actionTaken: 'Triggered thermal imaging scanner. Sent alert coordinates to controller console.',
    status: 'Active',
    snapshot: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    details: 'Meera Deshmukh (HT2026B112) ear thermal profiles exceed normal bounds. BLE probe detected a hidden active receiver.'
  },
  {
    id: 'a3',
    title: 'Camera Lens Blocked Warning',
    priority: 'MEDIUM',
    timestamp: '2026-07-21T09:58:10Z',
    location: 'Hallway B Entrance',
    actionTaken: 'Initiated lens cleaning mechanism cycle.',
    status: 'Resolved',
    details: 'Optical sensor dust threshold was exceeded. Self-cleaning wipers successfully cleared obstruction.'
  },
  {
    id: 'a4',
    title: 'Rover Obstacle Detected',
    priority: 'LOW',
    timestamp: '2026-07-21T09:45:30Z',
    location: 'LH-302 Aisle 2',
    actionTaken: 'Auto-recalculated routing trajectory.',
    status: 'Resolved',
    details: 'An exam desk chair was blocking the path. The rover recalculated around Row B without human operator override.'
  }
];

let roverStatus: RoverStatus = {
  battery: 88,
  speed: 0.4, // m/s
  location: 'LH-302, Aisle C',
  hall: 'Lecture Hall 302',
  floor: 3,
  wifiStatus: 'Excellent',
  cameraStatus: 'Online',
  temperature: 38.5, // Celsius
  cpuUsage: 45, // percent
  storageUsed: 142.4,
  storageTotal: 512,
  motorStatus: 'Operational',
  currentMission: 'Aisle Sweep LH-302',
  estimatedTimeRemaining: 24, // min
  posX: 42,
  posY: 68,
  manualMode: false
};

let systemMetrics: SystemMetrics = {
  backend: 'online',
  aiModel: 'online',
  camera: 'online',
  database: 'online',
  storage: 28, // 28%
  internet: 'connected',
  roverConnection: 'connected',
  modelFps: 29.8,
  inferenceTime: 32.4, // ms
  cpu: 44.5,
  memory: 58.2,
  gpu: 67.1
};

let aiDetectionLogs: AIDetectionLog[] = [
  {
    id: 'log_1',
    frameUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=80',
    detectedObjects: ['Smart Watch', 'Hand', 'Desk'],
    confidence: 98.6,
    decision: 'Device Flagged (Red)',
    operator: 'SysRover_Primary',
    timestamp: '2026-07-21T10:05:12Z',
    hall: 'LH-302'
  },
  {
    id: 'log_2',
    frameUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=500&auto=format&fit=crop&q=80',
    detectedObjects: ['Person', 'Concealed Hand Pose'],
    confidence: 82.0,
    decision: 'Suspicious Behavior (Orange)',
    operator: 'SysRover_Primary',
    timestamp: '2026-07-21T10:02:15Z',
    hall: 'LH-302'
  },
  {
    id: 'log_3',
    frameUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500&auto=format&fit=crop&q=80',
    detectedObjects: ['Person (RFID matched)', 'Face Match (99.8%)'],
    confidence: 99.8,
    decision: 'Verified Safe (Green)',
    operator: 'SysGate_Entry',
    timestamp: '2026-07-21T09:35:00Z',
    hall: 'LH-302'
  },
  {
    id: 'log_4',
    frameUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&auto=format&fit=crop&q=80',
    detectedObjects: ['Micro earbud thermal signature'],
    confidence: 94.2,
    decision: 'Device Flagged (Red)',
    operator: 'SysRover_Primary',
    timestamp: '2026-07-21T10:08:44Z',
    hall: 'LH-302'
  }
];

let systemSettings = {
  examHalls: ['LH-302', 'LH-304', 'Auditorium-1', 'Main Lab'],
  aiThreshold: 85, // %
  suspicionThreshold: 65, // %
  notificationChannels: {
    dashboard: true,
    audioAlerts: true,
    smsDispatch: false,
    deanEmail: true
  },
  roverConfig: {
    patrolSpeed: 0.4,
    thermalInterval: 2, // seconds
    opticalTracking: true,
    rfJammerBlock: false
  },
  operators: [
    { name: 'Prof. S. Rangan', role: 'Exam Controller', active: true },
    { name: 'Officer Kiran Kumar', role: 'Operator', active: true },
    { name: 'Dr. Helen Carter', role: 'Admin', active: true },
    { name: 'Viewer Account', role: 'Viewer', active: true }
  ]
};

// ==========================================
// API REST Routes
// ==========================================

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body;
  // Simple custom mock login allowing role-based access
  if (username && role) {
    const fullName = username.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    res.json({
      success: true,
      username: username,
      role: role,
      fullName: fullName || 'Authorized Officer',
      token: 'jwt-examshield-token-' + role.toLowerCase()
    });
  } else {
    res.status(400).json({ success: false, error: 'Username and Role are required' });
  }
});

// Students
app.get('/api/students', (req, res) => {
  res.json(INITIAL_STUDENTS);
});

app.post('/api/students/:id/decision', (req, res) => {
  const { id } = req.params;
  const { decision } = req.body; // 'Allowed' | 'Denied' | 'Pending'
  const student = INITIAL_STUDENTS.find(s => s.id === id);
  if (student) {
    student.entryDecision = decision;
    if (decision === 'Allowed') {
      student.status = 'Verified Safe';
      student.entryAllowed = true;
    } else if (decision === 'Denied') {
      student.entryAllowed = false;
    }
    res.json({ success: true, student });
  } else {
    res.status(404).json({ success: false, error: 'Student not found' });
  }
});

// Rover status
app.get('/api/rover', (req, res) => {
  res.json(roverStatus);
});

app.post('/api/rover/control', (req, res) => {
  const { command } = req.body; // 'fwd', 'bwd', 'left', 'right', 'stop', 'estop', 'home', 'manual'
  
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
        // Trigger Critical Alert
        const estopAlert: LiveAlert = {
          id: 'estop_' + Date.now(),
          title: 'ROVER EMERGENCY STOP TRIGGERED',
          priority: 'CRITICAL',
          timestamp: new Date().toISOString(),
          location: roverStatus.location,
          actionTaken: 'Operator initiated immediate E-STOP hardware lock.',
          status: 'Active',
          details: 'Physical or manual remote Emergency Stop was executed. Drive motors disengaged immediately.'
        };
        liveAlerts.unshift(estopAlert);
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

  broadcast({ type: 'ROVER_UPDATE', rover: roverStatus });
  res.json({ success: true, rover: roverStatus });
});

// Alerts
app.get('/api/alerts', (req, res) => {
  res.json(liveAlerts);
});

app.post('/api/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { status, action } = req.body;
  const alert = liveAlerts.find(a => a.id === id);
  if (alert) {
    alert.status = status;
    if (action) {
      alert.actionTaken = action;
    }
    broadcast({ type: 'ALERT_RESOLVED', alert });
    res.json({ success: true, alert });
  } else {
    res.status(404).json({ success: false, error: 'Alert not found' });
  }
});

app.post('/api/alerts/trigger', (req, res) => {
  const { title, priority, location, details } = req.body;
  const newAlert: LiveAlert = {
    id: 'custom_' + Date.now(),
    title,
    priority,
    location,
    details,
    actionTaken: 'Dispatched notification to standard terminals.',
    timestamp: new Date().toISOString(),
    status: 'Active'
  };
  liveAlerts.unshift(newAlert);
  broadcast({ type: 'NEW_ALERT', alert: newAlert });
  res.json({ success: true, alert: newAlert });
});

// System Metrics
app.get('/api/metrics', (req, res) => {
  res.json(systemMetrics);
});

// Logs
app.get('/api/logs', (req, res) => {
  res.json(aiDetectionLogs);
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(systemSettings);
});

app.post('/api/settings', (req, res) => {
  systemSettings = { ...systemSettings, ...req.body };
  res.json({ success: true, settings: systemSettings });
});


// ==========================================
// Real-time Event Simulation via WebSockets
// ==========================================

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  
  // Send initial states
  ws.send(JSON.stringify({ type: 'INITIAL_STATE', rover: roverStatus, metrics: systemMetrics, alerts: liveAlerts, students: INITIAL_STUDENTS }));

  ws.on('message', (message: string) => {
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

// Bind WebSocket upgrade to same port
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws' || request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

function broadcast(data: any) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// Simulated active updates (patrolling, battery drain, inference jitter)
setInterval(() => {
  // 1. Decay Battery slowly
  if (roverStatus.battery > 5) {
    roverStatus.battery = parseFloat((roverStatus.battery - 0.01).toFixed(2));
  } else {
    // low battery alert
    if (!liveAlerts.some(a => a.title === 'Critical Low Battery Alert')) {
      const lowBattAlert: LiveAlert = {
        id: 'lowbatt',
        title: 'Critical Low Battery Alert',
        priority: 'HIGH',
        timestamp: new Date().toISOString(),
        location: roverStatus.location,
        actionTaken: 'Rover requested returning to docking station.',
        status: 'Active',
        details: 'Battery levels fell below 5%. Security personnel must secure immediate manual charging.'
      };
      liveAlerts.unshift(lowBattAlert);
      broadcast({ type: 'NEW_ALERT', alert: lowBattAlert });
    }
  }

  // 2. Rover Patrol Simulation (if not in manual mode)
  if (!roverStatus.manualMode && roverStatus.motorStatus === 'Operational') {
    // Patrol pathing around a square inside LH-302 map
    let { posX, posY } = roverStatus;
    
    // Simulate movement: let's slide left/right/up/down slowly
    const time = Date.now() / 15000;
    posX = Math.round(50 + 35 * Math.sin(time));
    posY = Math.round(50 + 25 * Math.cos(time * 0.8));
    
    roverStatus.posX = posX;
    roverStatus.posY = posY;
    roverStatus.speed = 0.4;
    roverStatus.location = `LH-302, Aisle ${posX > 50 ? 'Right' : 'Left'} (Row ${String.fromCharCode(65 + Math.floor(posY / 15))})`;
    
    broadcast({ type: 'ROVER_UPDATE', rover: roverStatus });
  }

  // 3. System Metrics Jitter
  systemMetrics.cpu = Math.round(40 + Math.random() * 12);
  systemMetrics.memory = Math.round(55 + Math.random() * 5);
  systemMetrics.gpu = Math.round(60 + Math.random() * 15);
  systemMetrics.modelFps = parseFloat((28.5 + Math.random() * 2.5).toFixed(1));
  systemMetrics.inferenceTime = parseFloat((29 + Math.random() * 6).toFixed(1));

  broadcast({ type: 'METRICS_UPDATE', metrics: systemMetrics });
}, 4000);

// Occasional Mock Random Flagging Event (every 45 seconds, trigger a suspicious student or RFID scan)
let mockIndex = 0;
const MOCK_NAMES = ['Karan Singhania', 'Esha Dutta', 'Vivek Prasanna', 'Tina Kapur'];
const MOCK_BRANCHES = ['Information Tech', 'Cybersecurity', 'Electrical Eng', 'Mechanical Eng'];

setInterval(() => {
  if (clients.size === 0) return; // Only simulate if someone is watching
  
  // Decide whether to add a new Verified student, or flag a Suspicious student
  const rand = Math.random();
  const timeStr = new Date().toISOString();
  
  if (rand > 0.6) {
    // Verified Student scanned
    const name = MOCK_NAMES[mockIndex % MOCK_NAMES.length];
    const branch = MOCK_BRANCHES[mockIndex % MOCK_BRANCHES.length];
    const ticket = `HT2026S` + (700 + mockIndex);
    const seatRow = String.fromCharCode(65 + (mockIndex % 6)) + '-' + (mockIndex + 1);
    
    const newStudent: Student = {
      id: 'mock_v_' + mockIndex,
      name,
      hallTicket: ticket,
      branch,
      room: 'LH-302',
      seat: `Row ${seatRow}`,
      photo: `https://images.unsplash.com/photo-${1500000000000 + mockIndex * 100000}?w=150&auto=format&fit=crop&q=80`,
      status: 'Verified Safe',
      verificationCompleted: true,
      entryAllowed: true,
      timestamp: timeStr,
      faceConfidence: parseFloat((96.5 + Math.random() * 3).toFixed(1)),
      entryDecision: 'Allowed',
      verificationHistory: [`RFID Verification Completed`, `Facial Match Approved at Automated Entry Gate`],
      violationHistory: []
    };
    
    INITIAL_STUDENTS.push(newStudent);
    broadcast({ type: 'STUDENT_ADDED', student: newStudent });

    // Also push to AI detection history logs
    const newLog: AIDetectionLog = {
      id: 'log_' + Date.now(),
      frameUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=500&auto=format&fit=crop&q=80',
      detectedObjects: ['Person (Matched)', 'RFID Token Verified'],
      confidence: newStudent.faceConfidence || 98.0,
      decision: 'Verified Safe (Green)',
      operator: 'SysGate_Entry',
      timestamp: timeStr,
      hall: 'LH-302'
    };
    aiDetectionLogs.unshift(newLog);
    broadcast({ type: 'LOG_ADDED', log: newLog });
    
  } else if (rand > 0.3) {
    // Suspicious Student scan!
    const name = MOCK_NAMES[(mockIndex + 2) % MOCK_NAMES.length] + ' (Simulated)';
    const branch = MOCK_BRANCHES[(mockIndex + 2) % MOCK_BRANCHES.length];
    const ticket = `HT2026S` + (900 + mockIndex);
    const seatRow = 'Row ' + String.fromCharCode(68 + (mockIndex % 3)) + '-' + (3 + mockIndex);
    
    const score = Math.round(70 + Math.random() * 18);
    const newStudent: Student = {
      id: 'mock_s_' + mockIndex,
      name,
      hallTicket: ticket,
      branch,
      room: 'LH-302',
      seat: seatRow,
      photo: `https://images.unsplash.com/photo-${1530000000000 + mockIndex * 50000}?w=150&auto=format&fit=crop&q=80`,
      status: 'Suspicious',
      suspicionScore: score,
      suspicionReason: 'Frequent looking under desk and nervous wrist gestures.',
      timestamp: timeStr,
      faceConfidence: parseFloat((94.1 + Math.random() * 4).toFixed(1)),
      entryDecision: 'Pending',
      verificationHistory: [`Facial recognition verification successful`, `Rover AI flagged posture: Neck angle deviated (${score}%)`],
      violationHistory: ['Flagged via active camera Pose-Estimation algorithm.'],
      snapshot: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=80'
    };
    
    INITIAL_STUDENTS.push(newStudent);
    broadcast({ type: 'STUDENT_ADDED', student: newStudent });

    // Generate dynamic alert
    const newAlert: LiveAlert = {
      id: 'alert_' + Date.now(),
      title: 'Suspicious Pose Activity Flagged',
      priority: 'MEDIUM',
      timestamp: timeStr,
      location: `LH-302 (${seatRow})`,
      actionTaken: 'Rover camera queued focal review. Triggered manual verification ticket.',
      status: 'Active',
      snapshot: newStudent.snapshot,
      details: `${name} (${ticket}) exhibits posture pattern exceeding room baseline. High suspicion score of ${score}%.`
    };
    
    liveAlerts.unshift(newAlert);
    broadcast({ type: 'NEW_ALERT', alert: newAlert });

    // Also push to AI detection history logs
    const newLog: AIDetectionLog = {
      id: 'log_' + Date.now(),
      frameUrl: newStudent.snapshot || '',
      detectedObjects: ['Nervous Posture Model', 'Nystagmus Eye Deviance'],
      confidence: score,
      decision: 'Suspicious Pose Flagged (Orange)',
      operator: 'SysRover_Primary',
      timestamp: timeStr,
      hall: 'LH-302'
    };
    aiDetectionLogs.unshift(newLog);
    broadcast({ type: 'LOG_ADDED', log: newLog });
  }
  
  mockIndex++;
}, 45000);


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
  // Vite server integration
  startVite();
}

async function startVite() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

// Start HTTP listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`ExamShield Full-Stack Server listening on http://0.0.0.0:${PORT}`);
});
