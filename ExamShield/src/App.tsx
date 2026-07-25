import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bell, 
  X, 
  WifiOff, 
  ShieldAlert,
  Volume2
} from 'lucide-react';
import { 
  Student, 
  LiveAlert, 
  RoverStatus, 
  SystemMetrics, 
  AIDetectionLog, 
  UserRole,
  UserSession 
} from './types';

// Importing Custom Subviews
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

export default function App() {
  // 1. Session state (auth)
  const [session, setSession] = useState<UserSession | null>(null);

  // 2. Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 3. Core Live Telemetry variables
  const [students, setStudents] = useState<Student[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [rover, setRover] = useState<RoverStatus | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<AIDetectionLog[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // 4. Detailed focus modal target
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // 5. Connection State
  const [wsConnected, setWsConnected] = useState(false);
  const [toastNotification, setToastNotification] = useState<LiveAlert | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  // 6. Audio Beep feedback
  const playBeep = useCallback((priority: string) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  // 7. Initial Hydration API Fetches (Fallback and Initial Data)
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

      setStudents(studentsRes);
      setAlerts(alertsRes);
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
    
    let reconnectTimeout: any;

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
                if (prev.some(s => s.id === data.student.id)) return prev;
                return [...prev, data.student];
              });
              break;
            case 'NEW_ALERT':
              setAlerts(prev => {
                if (prev.some(a => a.id === data.alert.id)) return prev;
                return [data.alert, ...prev];
              });
              // Fire notification Banner
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

    // Fallback Polling every 6s in case Websocket is blocked
    const pollingInterval = setInterval(() => {
      if (!wsConnected) {
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
  }, [session, wsConnected, hydrateAllStates, playBeep]);

  // 9. Interactive Post Commands Handlers
  const handleSendCommand = async (command: string) => {
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

  const handleResolveAlert = async (alertId: string, status: any, action: string) => {
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

  const handleTriggerMockAlert = async (alertPayload: { title: string; priority: string; location: string; details: string }) => {
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

  const handleSaveSettings = async (updatedSettings: any) => {
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

  const handleLogout = () => {
    setSession(null);
    setActiveTab('dashboard');
  };

  // If session is empty, render Secure Gate login
  if (!session) {
    return <LoginView onLoginSuccess={setSession} />;
  }

  // Render subviews dynamically depending on navigation Tab
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
          />
        );
      case 'rover':
        return (
          <RoverView 
            rover={rover} 
            role={session.role}
            onSendCommand={handleSendCommand} 
          />
        );
      case 'alerts':
        return (
          <AlertsView 
            alerts={alerts} 
            role={session.role}
            onResolveAlert={handleResolveAlert}
            onTriggerAlert={handleTriggerMockAlert}
          />
        );
      case 'reports':
        return (
          <ReportsView 
            students={students} 
            role={session.role}
            operatorName={session.fullName} 
          />
        );
      case 'analytics':
        return <AnalyticsView />;
      case 'health':
        return <HealthView metrics={metrics} />;
      case 'history':
        return <HistoryView logs={logs} />;
      case 'settings':
        return (
          <SettingsView 
            settings={settings} 
            onSaveSettings={handleSaveSettings} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#010409] text-slate-200 flex font-sans overflow-x-hidden">
      
      {/* Dynamic Toast alert notifications banner */}
      {toastNotification && (
        <div className="fixed top-20 right-4 z-50 max-w-sm rounded-2xl bg-rose-950/95 border border-rose-500/40 p-4 shadow-2xl flex gap-3.5 items-start animate-in slide-in-from-right duration-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
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
      />

      {/* Main Content scroll window */}
      <main className="flex-1 min-w-0 lg:pl-64 pt-20 lg:pt-6 p-6 min-h-screen flex flex-col justify-between print:pl-0 print:pt-0">
        <div className="space-y-6">
          
          {/* Telemetry Warning banner when WS falls offline */}
          {!wsConnected && (
            <div className="px-4 py-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 font-mono print:hidden shadow-[0_0_10px_rgba(245,158,11,0.05)]">
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
          <div className="animate-in fade-in duration-200">
            {renderTabContent()}
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-blue-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono text-slate-500 print:hidden">
          <span>DESIGNATION: AI SURVEILLANCE SUITE · UNIVERSITY PROJECT v2.84</span>
          <span>© 2026 EXAMSHIELD AGENT. ALL TELEMETRY CHASSIS ACTIVE.</span>
        </footer>
      </main>

      {/* Detailed student popup profile modal */}
      {selectedStudent && (
        <StudentProfileModal
          student={students.find(s => s.id === selectedStudent.id) || selectedStudent}
          role={session.role}
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
