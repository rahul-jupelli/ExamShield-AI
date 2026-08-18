import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  X,
  WifiOff,
  ShieldAlert,
  Volume2
} from 'lucide-react';
import { supabase } from "./lib/supabase";

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

export default function App() {
  // 1. Session state (auth)
  // >>> AUTH TEMPORARILY DISABLED — session initialized with mock admin <<<
  const [session, setSession] = useState({
    role: 'Admin',
    fullName: 'Dev Admin',
    email: 'dev@examshield.ai',
  });
  const [authLoading, setAuthLoading] = useState(false);

  // View Mode state: 'landing' | 'dashboard'
  const [viewMode, setViewMode] = useState('dashboard');

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

  const formatUserData = (user) => {
    if (!user) return null;
    return {
      ...user,
      role: "Admin",
      fullName: user.user_metadata?.full_name || user.email || "Admin Operator",
    };
  };

  useEffect(() => {
    async function getSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error fetching session:", error.message);
        } else if (data?.session?.user) {
          setSession(formatUserData(data.session.user));
        }
      } catch (err) {
        console.error("Session restoration failed:", err);
      } finally {
        setAuthLoading(false);
      }
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession?.user) {
        setSession(formatUserData(currentSession.user));
      } else {
        setSession(null);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);


  // 2. Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
        fetch('/api/students').then(r => r.json()),
        fetch('/api/alerts').then(r => r.json()),
        fetch('/api/rover').then(r => r.json()),
        fetch('/api/metrics').then(r => r.json()),
        fetch('/api/logs').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ]);

      // Deduplicate fetched students and alerts to keep original entries only
      const uniqueStudentsMap = new Map();
      (studentsRes || []).forEach(s => {
        const key = (s.hallTicket || s.name || s.id || '').trim().toLowerCase();
        if (key && !uniqueStudentsMap.has(key)) {
          uniqueStudentsMap.set(key, s);
        }
      });

      const uniqueAlertsMap = new Map();
      (alertsRes || []).forEach(a => {
        const key = (a.id || (a.title + '_' + a.location)).trim().toLowerCase();
        if (key && !uniqueAlertsMap.has(key)) {
          uniqueAlertsMap.set(key, a);
        }
      });

      setStudents(Array.from(uniqueStudentsMap.values()));
      setAlerts(Array.from(uniqueAlertsMap.values()));
      setRover(roverRes);
      setMetrics(metricsRes);
      setLogs(logsRes);
      setSettings(settingsRes);
    } catch (e) {
      console.error('Failed to pre-hydrate states over REST.', e);
    }
  }, []);

  // Hydrate once logged in
  useEffect(() => {
    if (session) {
      hydrateAllStates();
    }
  }, [session, hydrateAllStates]);

  // 8. WebSocket Telemetry Client
  useEffect(() => {
    if (!session) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let reconnectTimeout;

    const connectWS = () => {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        console.log('ExamShield Telemetry Link established.');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

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
        setWsConnected(false);
        console.warn('ExamShield Telemetry Link lost. Scheduling reconnect...');
        reconnectTimeout = setTimeout(connectWS, 5000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connectWS();

    // Fallback Polling every 6s
    const pollingInterval = setInterval(() => {
      if (!wsConnectedRef.current) {
        hydrateAllStates();
      }
    }, 6000);

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      clearTimeout(reconnectTimeout);
      clearInterval(pollingInterval);
    };
  }, [session, playBeep, hydrateAllStates]);

  // 9. Interactive Post Command Handlers
  const handleSendCommand = async (command) => {
    try {
      const res = await fetch('/api/rover/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    try {
      const res = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    try {
      const res = await fetch('/api/alerts/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentOrStudents),
      });
      const data = await res.json();
      
      const newItems = Array.isArray(studentOrStudents) ? studentOrStudents : [studentOrStudents];
      setStudents(prev => {
        const uniqueMap = new Map();
        [...newItems, ...prev].forEach(s => {
          const key = (s.hallTicket || s.name || s.id || '').trim().toLowerCase();
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, s);
          }
        });
        return Array.from(uniqueMap.values());
      });

      // Direct Supabase fallback insert
      try {
        const recordsToInsert = Array.isArray(studentOrStudents) ? studentOrStudents : [studentOrStudents];
        await supabase.from('students').upsert(recordsToInsert, { onConflict: 'id' });
      } catch (subErr) {
        console.warn('Direct Supabase insert notice:', subErr.message);
      }
      return data;
    } catch (err) {
      console.error('Failed to add student via API:', err);
      const newItems = Array.isArray(studentOrStudents) ? studentOrStudents : [studentOrStudents];
      setStudents(prev => [...newItems, ...prev]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setActiveTab("dashboard");
    setViewMode("landing");
  };

  // 10. Session Restoration Loading Gate
  // >>> AUTH TEMPORARILY DISABLED — RE-ENABLE WHEN READY <<<
  // if (authLoading) {
  //   return (
  //     <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center text-slate-300 font-mono p-4">
  //       <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
  //       <span className="text-sm font-bold tracking-wider text-blue-400">VERIFYING ENCRYPTED SESSION GATEWAY...</span>
  //       <span className="text-xs text-slate-500 mt-2">ExamShield AI Autonomous Surveillance Suite</span>
  //     </div>
  //   );
  // }

  // activeSession fallback no longer needed — session is pre-initialized above

  // Render Minimal Premium Landing Page
  // >>> LANDING PAGE REDIRECT TEMPORARILY DISABLED <<<
  // if (viewMode === 'landing' || (!session && viewMode !== 'dashboard')) {
  //   return (
  //     <LandingView
  //       session={session}
  //       onEnterDashboard={() => setViewMode('dashboard')}
  //       onLoginSuccess={(user) => {
  //         setSession(formatUserData(user));
  //         setViewMode('dashboard');
  //       }}
  //     />
  //   );
  // }


  // Render subviews dynamically
  const renderTabContent = () => {
    if (!rover || !metrics || !settings) {
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
            role={session.role}
            onSendCommand={handleSendCommand}
            theme={theme}
          />
        );
      case 'alerts':
        return (
          <AlertsView
            alerts={alerts}
            role={session.role}
            onResolveAlert={handleResolveAlert}
            onTriggerAlert={handleTriggerMockAlert}
            theme={theme}
          />
        );
      case 'reports':
        return (
          <ReportsView
            students={students}
            role={session.role}
            operatorName={session.fullName}
            theme={theme}
          />
        );
      case 'analytics':
        return <AnalyticsView theme={theme} />;
      case 'health':
        return <HealthView metrics={metrics} theme={theme} />;
      case 'history':
        return <HistoryView logs={logs} theme={theme} />;
      case 'settings':
        return (
          <SettingsView
            settings={settings}
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
          role={session.role}
          theme={theme}
          onClose={() => setSelectedStudent(null)}
          onUpdateDecision={(sId, dec) => {
            setStudents(prev => prev.map(s => s.id === sId ? {
              ...s,
              entryDecision: dec,
              status: dec === 'Allowed' ? 'Verified Safe' : s.status,
              entryAllowed: dec === 'Allowed' ? true : dec === 'Denied' ? false : undefined
            } : s));
          }}
        />
      )}

    </div>
  );
}
