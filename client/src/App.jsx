import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  X,
  WifiOff,
  ShieldAlert,
  Volume2,
  Shield,
  Lock,
  LogOut,
  Home,
  UserPlus
} from 'lucide-react';
import { supabase, clearCorruptedSupabaseStorage } from "./lib/supabase";
import { useAuth } from './context/AuthContext';

// Central Tab-Level Staff Access Policy Whitelist
const TAB_PERMISSIONS = {
  'dashboard': ['Admin', 'Exam Controller', 'Operator', 'Viewer'],
  'exam-management': ['Admin', 'Exam Controller', 'Operator', 'Viewer'],
  'rover': ['Admin', 'Exam Controller', 'Operator', 'Viewer'],
  'alerts': ['Admin', 'Exam Controller', 'Operator', 'Viewer'],
  'analytics': ['Admin', 'Exam Controller', 'Operator', 'Viewer'],
  'health': ['Admin', 'Exam Controller', 'Operator', 'Viewer'],
  'history': ['Admin', 'Exam Controller', 'Operator', 'Viewer'],
  'incident-review': ['Admin', 'Exam Controller', 'Operator'],
  'add-student': ['Admin', 'Exam Controller', 'Operator'],
  'reports': ['Admin', 'Exam Controller', 'Operator'],
  'settings': ['Admin', 'Exam Controller'],
};


// Importing Custom Subviews
import LandingView from './components/LandingView';
import LoginView from './components/LoginView';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import RoverView from './components/RoverView';
import StudentProfileModal from './components/StudentProfileModal';
import AlertsView from './components/AlertsView';
import ReportsView from './components/ReportsView';
import AnalyticsView from './components/AnalyticsView';
import HealthView from './components/HealthView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import AddStudentView from './components/AddStudentView';
import ExamManagementView from './components/ExamManagementView';
import IncidentReviewView from './components/IncidentReviewView';
import { fetchStudentPhotoFromSupabase } from './services/storageService';
import { apiFetch } from './services/apiClient';
import { subscribeToExamUpdates } from './services/examService';

export default function App() {
  // 1. Authoritative Auth Session via AuthContext
  const { user: session, loading: authLoading, signOut } = useAuth();

  // View Mode state: 'landing' | 'dashboard' | 'registration'
  const [viewMode, setViewMode] = useState('landing');

  // Theme State: 'dark' | 'light'
  const [theme, setTheme] = useState(() => localStorage.getItem('examshield_theme') || 'dark');

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('examshield_theme', next);
      return next;
    });
  };

  useEffect(() => {
    localStorage.setItem('examshield_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Sync viewMode with session transitions: unauthenticated and non-staff users never stay on staff dashboard
  useEffect(() => {
    if (session?.isStaff) {
      const canRegister = ['Admin', 'Exam Controller', 'Operator'].includes(session.role);
      setViewMode(prev => (prev === 'registration' && canRegister) ? 'registration' : 'dashboard');
    } else if (session) {
      // Authenticated but no authorized staff role assigned in app_metadata
      setViewMode('unauthorized');
    } else {
      // Unauthenticated visitor
      setViewMode('landing');
    }
  }, [session]);

  // 2. Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Keep activeTab within permitted tabs if user role changes
  useEffect(() => {
    if (session?.role && TAB_PERMISSIONS[activeTab] && !TAB_PERMISSIONS[activeTab].includes(session.role)) {
      setActiveTab('dashboard');
    }
  }, [session?.role, activeTab]);

  // 3. Core Live Telemetry variables
  const [students, setStudents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [rover, setRover] = useState({
    battery: 88,
    speed: 0.4,
    location: 'LH-302, Aisle C',
    hall: 'Lecture Hall 302',
    floor: 3,
    wifiStatus: 'Excellent',
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
  });
  const [metrics, setMetrics] = useState({
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
  });
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
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
  });

  // --- Resolve student photos from private Supabase bucket ---
  const resolveStudentBucketPhotos = useCallback(async (studentList) => {
    try {
      const resolved = await Promise.all(
        studentList.map(async (s) => {
          try {
            const bucketUrl = await fetchStudentPhotoFromSupabase(s);
            if (bucketUrl && bucketUrl !== s.photo) {
              return { ...s, photo: bucketUrl };
            }
            return s;
          } catch {
            return s;
          }
        })
      );
      setStudents(resolved);
    } catch (err) {
      console.warn('[App] Bucket photo resolution failed:', err);
    }
  }, []);

  // 4. Detailed focus modal target
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 5. Connection State
  const [wsConnected, setWsConnected] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

  const socketRef = useRef(null);
  const wsConnectedRef = useRef(false);
  useEffect(() => {
    wsConnectedRef.current = wsConnected;
  }, [wsConnected]);

  // Grace period before showing offline banner
  useEffect(() => {
    let timer;
    if (!wsConnected) {
      timer = setTimeout(() => setShowOfflineBanner(true), 3000);
    } else {
      setShowOfflineBanner(false);
    }
    return () => clearTimeout(timer);
  }, [wsConnected]);

  // 6. Audio Beep feedback
  const playBeep = useCallback((priority) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (priority === 'CRITICAL') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (err) {
      // Audio context block ignore
    }
  }, []);

  // 7. Initial Hydration API Fetches
  const hydrateAllStates = useCallback(async () => {
    try {
      const [studentsRes, alertsRes, roverRes, metricsRes, logsRes, settingsRes] = await Promise.all([
        apiFetch('/api/students').then(r => r.ok ? r.json() : []).catch(err => {
          console.warn('[App] Students fetch notice:', err.message);
          return [];
        }),
        apiFetch('/api/alerts').then(r => r.ok ? r.json() : []).catch(err => {
          console.warn('[App] Alerts fetch notice:', err.message);
          return [];
        }),
        apiFetch('/api/rover').then(r => r.ok ? r.json() : null).catch(err => {
          console.warn('[App] Rover fetch notice:', err.message);
          return null;
        }),
        apiFetch('/api/metrics').then(r => r.ok ? r.json() : null).catch(err => {
          console.warn('[App] Metrics fetch notice:', err.message);
          return null;
        }),
        apiFetch('/api/logs').then(r => r.ok ? r.json() : []).catch(err => {
          console.warn('[App] Logs fetch notice:', err.message);
          return [];
        }),
        apiFetch('/api/settings').then(r => r.ok ? r.json() : null).catch(err => {
          console.warn('[App] Settings fetch notice:', err.message);
          return null;
        }),
      ]);

      let resolvedStudents = Array.isArray(studentsRes) && studentsRes.length > 0 ? studentsRes : [];
      if (resolvedStudents.length === 0) {
        try {
          const { data: dbStudents } = await supabase.from('students').select('*').order('timestamp', { ascending: false });
          if (Array.isArray(dbStudents) && dbStudents.length > 0) {
            resolvedStudents = dbStudents;
          }
        } catch (dbErr) {
          console.warn('[App] Direct Supabase students fallback fetch notice:', dbErr);
        }
      }

      if (resolvedStudents.length > 0) {
        const uniqueStudentsMap = new Map();
        resolvedStudents.forEach(s => {
          const key = String(s.id || s.hallTicket || '').trim().toLowerCase();
          if (key && !uniqueStudentsMap.has(key)) {
            uniqueStudentsMap.set(key, s);
          } else if (!key) {
            uniqueStudentsMap.set(Math.random().toString(), s);
          }
        });
        const uniqueStudents = Array.from(uniqueStudentsMap.values());
        setStudents(uniqueStudents);
        resolveStudentBucketPhotos(uniqueStudents);
      }

      if (Array.isArray(alertsRes) && alertsRes.length > 0) {
        const uniqueAlertsMap = new Map();
        alertsRes.forEach(a => {
          const key = (a.id || (a.title + '_' + a.location)).trim().toLowerCase();
          if (key && !uniqueAlertsMap.has(key)) {
            uniqueAlertsMap.set(key, a);
          }
        });
        setAlerts(Array.from(uniqueAlertsMap.values()));
      }

      if (roverRes && !roverRes.error && roverRes.battery !== undefined) {
        setRover(roverRes);
      }
      if (metricsRes && !metricsRes.error && metricsRes.cpu !== undefined) {
        setMetrics(metricsRes);
      }
      if (Array.isArray(logsRes) && logsRes.length > 0) {
        setLogs(logsRes);
      }
      if (settingsRes && !settingsRes.error && settingsRes.examHalls) {
        setSettings(settingsRes);
      }
    } catch (e) {
      console.warn('REST hydration notice:', e);
    }
  }, [resolveStudentBucketPhotos]);


  // Hydrate once logged in as authorized staff or viewing dashboard
  useEffect(() => {
    if (session?.isStaff || viewMode === 'dashboard') {
      hydrateAllStates();
    }
  }, [session, viewMode, hydrateAllStates]);

  // Real-time synchronization for direct Supabase mutations (e.g. students or exam_students changes)
  useEffect(() => {
    if (!session?.isStaff && viewMode !== 'dashboard') return;

    const unsubscribe = subscribeToExamUpdates((payload) => {
      if (payload.table === 'students' || payload.table === 'exam_students') {
        if (payload.new && payload.table === 'students') {
          setStudents(prev => prev.map(s => {
            const keyNew = String(payload.new.id || payload.new.hallTicket || '').trim().toLowerCase();
            const keyCur = String(s.id || s.hallTicket || '').trim().toLowerCase();
            if (keyNew && keyCur && keyNew === keyCur) {
              return { ...s, ...payload.new };
            }
            return s;
          }));
        }
        hydrateAllStates();
      }
    });

    return () => unsubscribe();
  }, [session, viewMode, hydrateAllStates]);

  // 8. WebSocket Telemetry Client (Authenticated Staff Only)
  useEffect(() => {
    if (!session?.isStaff) return;

    let isMounted = true;
    let reconnectTimeout = null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connectWS = () => {
      if (!isMounted) return;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = async () => {
        if (!isMounted) return;
        try {
          const { data } = await supabase.auth.getSession();
          const token = data?.session?.access_token;
          if (token && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'AUTH', token }));
          }
        } catch (e) {
          console.warn('[WS] Token transmit error:', e);
        }
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'AUTH_SUCCESS') {
            setWsConnected(true);
            console.log('ExamShield Telemetry Link established & authenticated.');
            return;
          }

          if (data.type === 'AUTH_ERROR') {
            console.warn('[WS] Telemetry Link Auth Denied:', data.error);
            setWsConnected(false);
            return;
          }

          switch (data.type) {
            case 'INITIAL_STATE':
              setRover(data.rover);
              setMetrics(data.metrics);
              setAlerts(data.alerts);
              setStudents(data.students);
              break;
            case 'ROVER_UPDATE':
              setRover(data.rover);
              break;
            case 'METRICS_UPDATE':
              setMetrics(data.metrics);
              break;
            case 'STUDENT_VERIFICATION_UPDATED':
              if (data.studentId) {
                setStudents(prev => prev.map(s => {
                  if (s.id === data.studentId) {
                    const isVerified = data.verification_status === 'verified';
                    return {
                      ...s,
                      status: isVerified ? 'Verified' : data.verification_status === 'failed' ? 'Flagged' : s.status,
                      entryDecision: isVerified ? 'Allowed' : data.verification_status === 'failed' ? 'Denied' : s.entryDecision,
                      verificationCompleted: isVerified,
                      entryAllowed: isVerified
                    };
                  }
                  return s;
                }));
              }
              break;
            case 'STUDENT_ADDED':
              setStudents(prev => {
                const key = (data.student.hallTicket || data.student.name || data.student.id || '').trim().toLowerCase();
                if (prev.some(s => (s.hallTicket || s.name || s.id || '').trim().toLowerCase() === key)) return prev;
                return [...prev, data.student];
              });
              break;
            case 'NEW_ALERT':
              setAlerts(prev => {
                const key = (data.alert.id || (data.alert.title + '_' + data.alert.location)).trim().toLowerCase();
                if (prev.some(a => (a.id || (a.title + '_' + a.location)).trim().toLowerCase() === key)) return prev;
                return [data.alert, ...prev];
              });
              setToastNotification(data.alert);
              playBeep(data.alert.priority);
              break;
            case 'ALERT_RESOLVED':
              setAlerts(prev => prev.map(a => a.id === data.alert.id ? data.alert : a));
              break;
            case 'LOG_ADDED':
              setLogs(prev => [data.log, ...prev]);
              break;
          }
        } catch (e) {
          console.error('Failed parse ws payload:', e);
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        console.warn('ExamShield Telemetry Link lost. Scheduling reconnect...');
        reconnectTimeout = setTimeout(() => {
          if (isMounted) connectWS();
        }, 5000);
      };

      socket.onerror = () => {
        if (!isMounted) return;
        try {
          socket.close();
        } catch (e) {}
      };
    };

    connectWS();

    // Resilient periodic sync to ensure live monitoring is always up to date
    const pollingInterval = setInterval(() => {
      if (isMounted) hydrateAllStates();
    }, 8000);

    return () => {
      isMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      clearInterval(pollingInterval);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, [session, playBeep, hydrateAllStates]);

  // 9. Interactive Post Command Handlers
  const handleSendCommand = async (command) => {
    if (!['Admin', 'Exam Controller', 'Operator'].includes(session?.role)) {
      console.warn('Rover control blocked: operator or admin authorization required.');
      return;
    }
    try {
      const res = await apiFetch('/api/rover/control', {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      if (data.success) {
        setRover(data.rover);
      }
    } catch (e) {
      console.error('Failed to transmit control vector.', e);
    }
  };

  const handleResolveAlert = async (alertId, status, action) => {
    if (!['Admin', 'Exam Controller', 'Operator'].includes(session?.role)) {
      console.warn('Alert resolution blocked: operator or admin authorization required.');
      return;
    }
    try {
      const res = await apiFetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status, action }),
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => prev.map(a => a.id === alertId ? data.alert : a));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerMockAlert = async (alertPayload) => {
    if (!['Admin', 'Exam Controller', 'Operator'].includes(session?.role)) {
      console.warn('Alert trigger blocked: operator or admin authorization required.');
      return;
    }
    try {
      const res = await apiFetch('/api/alerts/trigger', {
        method: 'POST',
        body: JSON.stringify(alertPayload),
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => [data.alert, ...prev]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (updatedSettings) => {
    if (!['Admin', 'Exam Controller'].includes(session?.role)) {
      console.warn('Settings save blocked: exam controller or admin authorization required.');
      return;
    }
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(updatedSettings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStudent = async (studentOrStudents) => {
    const inputItems = Array.isArray(studentOrStudents)
      ? studentOrStudents
      : [studentOrStudents];

    try {
      // AddStudentView must provide the real FaceNet embedding.
      for (const student of inputItems) {
        const rawEmbedding = student.faceEmbedding || student.face_embedding;

        if (!rawEmbedding) {
          throw new Error(
            `No face embedding was generated for ${student.name || student.id || 'student'}.`
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
            `Invalid face embedding for ${student.name || student.id || 'student'}.`
          );
        }

        if (
          !Array.isArray(embedding) ||
          embedding.length !== 512 ||
          embedding.some(value => !Number.isFinite(Number(value)))
        ) {
          throw new Error(
            `Face embedding for ${student.name || student.id || 'student'} must contain exactly 512 valid numbers.`
          );
        }

        if (!student.photo || !String(student.photo).includes('student-photos')) {
          throw new Error(
            `No valid Supabase Storage photo URL was supplied for ${student.name || student.id || 'student'}.`
          );
        }
      }

      const res = await apiFetch('/api/students', {
        method: 'POST',
        body: JSON.stringify(inputItems),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save student to database.');
      }

      const newItems = data.students || inputItems;

      setStudents(prev => {
        const uniqueMap = new Map();
        [...newItems, ...prev].forEach(student => {
          const key = String(student.id || student.hallTicket || '')
            .trim()
            .toLowerCase();
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, student);
          }
        });
        return Array.from(uniqueMap.values());
      });

      return data;
    } catch (err) {
      console.error('Failed to add student via API:', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Logout notice:', err);
    } finally {
      setViewMode("landing");
      setActiveTab("dashboard");
    }
  };

  // 10. Session Restoration Loading Gate
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070a16] flex flex-col items-center justify-center text-slate-300 font-mono p-4">
        <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-bold tracking-wider text-blue-400">VERIFYING ENCRYPTED SESSION GATEWAY...</span>
        <span className="text-xs text-slate-500 mt-2">ExamShield AI Autonomous Surveillance Suite</span>
      </div>
    );
  }

  // Staff Cadet Registration View (accessible only to authorized staff)
  if (viewMode === 'registration') {
    const canRegister = session?.isStaff && ['Admin', 'Exam Controller', 'Operator'].includes(session?.role);
    if (!canRegister) {
      if (!session) {
        return (
          <LandingView
            session={session}
            onEnterDashboard={() => {
              if (session?.isStaff) setViewMode('dashboard');
              else if (session) setViewMode('unauthorized');
            }}
            onLoginSuccess={() => {}}
            onLogout={handleLogout}
          />
        );
      }
      return (
        <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#070a16] text-slate-100'} p-4 flex items-center justify-center font-sans`}>
          <div className={`max-w-md w-full rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl text-center ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0e1424] border-slate-800'
          }`}>
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-rose-500 uppercase px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
                REGISTRATION RESTRICTED
              </span>
              <h2 className="text-xl font-bold tracking-tight">Staff Authorization Required</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Official student registration is restricted to authorized staff accounts (<code className="font-mono text-blue-400">Admin</code>, <code className="font-mono text-blue-400">Exam Controller</code>, or <code className="font-mono text-blue-400">Operator</code>). Your current account role does not have registration permissions.
              </p>
            </div>
            <button
              onClick={() => setViewMode(session?.isStaff ? 'dashboard' : 'landing')}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Return to {session?.isStaff ? 'Dashboard' : 'Home'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#070a13] text-slate-100'} p-4 sm:p-8 font-sans`}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className={`flex items-center justify-between pb-4 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight">ExamShield AI</span>
                <span className="block text-[10px] font-mono text-slate-400 uppercase">Staff Cadet Enrollment</span>
              </div>
            </div>
            <button
              onClick={() => {
                setViewMode('dashboard');
                setActiveTab('dashboard');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                theme === 'light'
                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <span>← Return to Command Terminal</span>
            </button>
          </div>
          <AddStudentView
            onAddStudent={handleAddStudent}
            onNavigateToDashboard={() => {
              setViewMode('dashboard');
              setActiveTab('dashboard');
            }}
            theme={theme}
          />
        </div>
      </div>
    );
  }

  // Public Landing Page (Unauthenticated or explicit Landing view)
  if (!session || viewMode === 'landing') {
    return (
      <LandingView
        session={session}
        onEnterDashboard={() => {
          if (session?.isStaff) {
            setViewMode('dashboard');
          } else if (session) {
            setViewMode('unauthorized');
          }
        }}
        onLoginSuccess={() => {
          // Sync effect will evaluate isStaff and route appropriately
        }}
        onLogout={handleLogout}
      />
    );
  }

  // Authenticated User Without an Authorized Staff Role Gate (Fail-Closed)
  if (session && !session.isStaff) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#070a16] text-slate-100'} p-4 flex items-center justify-center font-sans`}>
        <div className={`max-w-md w-full rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl text-center ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0e1424] border-slate-800'
        }`}>
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-amber-500 uppercase px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              STAFF AUTHORIZATION REQUIRED
            </span>
            <h2 className="text-xl font-bold tracking-tight">Access Restricted</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are authenticated as <strong className="text-white font-mono">{session.email}</strong>, but no authorized staff role has been assigned to your account in <code className="font-mono text-blue-400">app_metadata.role</code>.
            </p>
          </div>

          <div className={`p-3.5 rounded-2xl border text-left text-xs font-mono space-y-1.5 ${
            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#070b14] border-slate-800 text-slate-400'
          }`}>
            <div className="flex justify-between">
              <span>Account Status:</span>
              <span className="text-emerald-400 font-bold">Authenticated</span>
            </div>
            <div className="flex justify-between">
              <span>Staff Authorization:</span>
              <span className="text-rose-400 font-bold">Denied (Fail-Closed)</span>
            </div>
            {session.claimedRole && (
              <div className="flex justify-between text-[11px] text-amber-400">
                <span>Self-Claimed Role:</span>
                <span>{session.claimedRole} (Untrusted)</span>
              </div>
            )}
            <div className="pt-1 text-[10px] text-slate-500">
              Permitted staff roles: Admin, Exam Controller, Operator, Viewer
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('landing')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                <Home className="h-3.5 w-3.5" />
                <span>Return Home</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 px-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // Render subviews dynamically with direct tab selection guard
  const renderTabContent = () => {
    // Check permission for active tab against trusted session role
    const permittedRoles = TAB_PERMISSIONS[activeTab];
    const userRole = session?.role;

    if (!userRole || !permittedRoles || !permittedRoles.includes(userRole)) {
      return (
        <div className={`p-8 rounded-3xl border text-center space-y-4 max-w-lg mx-auto my-12 ${
          theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0f1422] border-slate-800 text-slate-200'
        }`}>
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold">Access Denied: Restricted View</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Your active role <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{userRole || 'Unassigned'}</span> is not authorized to access the <strong>{activeTab}</strong> tab.
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-1">
              Permitted roles: {permittedRoles ? permittedRoles.join(', ') : 'None'}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            Return to Live Monitoring
          </button>
        </div>
      );
    }

    const isRoverValid = rover && rover.battery !== undefined;
    const isMetricsValid = metrics && metrics.cpu !== undefined;
    const isSettingsValid = settings && settings.examHalls;

    if (!isRoverValid || !isMetricsValid || !isSettingsValid) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 font-mono">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <span>SYNCHRONIZING TELEMETRY STREAMS...</span>
        </div>
      );
    }


    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            students={students}
            rover={rover}
            alerts={alerts}
            onSelectStudent={(s) => setSelectedStudent(s)}
            theme={theme}
          />
        );
      case 'exam-management':
        return (
          <ExamManagementView
            allStudents={students}
            theme={theme}
            role={session?.role || ''}
            operatorName={session?.fullName || 'Operator'}
            examHalls={settings.examHalls}
          />
        );
      case 'incident-review':
        return (
          <IncidentReviewView
            theme={theme}
            role={session?.role || ''}
            operatorName={session?.fullName || 'Operator'}
          />
        );
      case 'add-student':
        return (
          <AddStudentView
            onAddStudent={handleAddStudent}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            theme={theme}
          />
        );
      case 'rover':
        return (
          <RoverView
            rover={rover}
            role={session?.role || ''}
            onSendCommand={handleSendCommand}
            theme={theme}
          />
        );
      case 'alerts':
        return (
          <AlertsView
            alerts={alerts}
            role={session?.role || ''}
            onResolveAlert={handleResolveAlert}
            onTriggerAlert={handleTriggerMockAlert}
            theme={theme}
          />
        );
      case 'reports':
        return (
          <ReportsView
            students={students}
            role={session?.role || ''}
            operatorName={session?.fullName || 'Operator'}
            theme={theme}
          />
        );
      case 'analytics':
        return <AnalyticsView students={students} metrics={metrics} theme={theme} />;
      case 'health':
        return <HealthView metrics={metrics} theme={theme} />;
      case 'history':
        return <HistoryView logs={logs} theme={theme} />;
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            role={session?.role || ''}
            onSaveSettings={handleSaveSettings}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen flex font-sans overflow-x-hidden transition-colors duration-200 ${
      theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#070a13] text-slate-100'
    }`}>

      {/* Dynamic Toast alert notifications banner */}
      {toastNotification && (
        <div className="fixed top-20 right-4 z-50 max-w-sm rounded-2xl bg-rose-950 border border-rose-500/40 p-4 shadow-xl flex gap-3.5 items-start animate-in slide-in-from-right duration-300">
          <ShieldAlert className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5 animate-bounce" />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white uppercase tracking-wide">AI TELEMETRY FLAG INCIDENT</h4>
            <span className="block text-[11px] font-extrabold text-rose-300 mt-1">{toastNotification.title}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">{toastNotification.location}</span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-0.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        onLogout={handleLogout}
        wsConnected={wsConnected}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
        onGoToLanding={() => setViewMode('landing')}
      />

      {/* Main Content scroll window with comfortable distance from sidebar */}
      <main className="flex-1 min-w-0 lg:pl-72 lg:pr-8 pt-20 lg:pt-8 p-6 min-h-screen flex flex-col justify-between print:pl-0 print:pt-0">
        <div className="space-y-8">

          {/* Telemetry Warning banner */}
          {showOfflineBanner && (
            <div className="px-4 py-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 font-mono print:hidden">
              <span className="flex items-center gap-2">
                <WifiOff className="h-4.5 w-4.5 animate-pulse" />
                TELEMETRY LINK INTERRUPTED. COMMENCING HYBRID REST-POLLING ROUTINE.
              </span>
              <button
                onClick={hydrateAllStates}
                className="px-2 py-1 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 font-bold uppercase rounded cursor-pointer"
              >
                Sync Force
              </button>
            </div>
          )}

          {/* Core subview rendering */}
          <div key={activeTab} className="animate-in fade-in duration-200">
            {renderTabContent()}
          </div>

        </div>

        {/* Footer */}
        <footer className={`mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono text-slate-500 print:hidden ${
          theme === 'light' ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <span>DESIGNATION: AI SURVEILLANCE SUITE · UNIVERSITY PROJECT v2.84</span>
          <span>© 2026 EXAMSHIELD AGENT. ALL TELEMETRY CHASSIS ACTIVE.</span>
        </footer>
      </main>

      {/* Student popup profile modal */}
      {selectedStudent && (
        <StudentProfileModal
          student={students.find(s => s.id === selectedStudent.id) || selectedStudent}
          role={session?.role || ''}
          theme={theme}
          onClose={() => setSelectedStudent(null)}
          onUpdateDecision={(sId, dec, fields) => {
            const isAllowed = dec === 'Allowed';
            setStudents(prev => prev.map(s => s.id === sId ? {
              ...s,
              ...fields,
              entryDecision: dec,
              entryAllowed: isAllowed,
              status: isAllowed ? 'Verified' : 'Flagged',
              verificationCompleted: isAllowed,
            } : s));
          }}
        />
      )}

    </div>
  );
}
