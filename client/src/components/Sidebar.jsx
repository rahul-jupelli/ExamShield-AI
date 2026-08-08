import React from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  Cpu, 
  AlertTriangle, 
  FileText, 
  BarChart3, 
  Activity, 
  History, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Radio,
  Sun,
  Moon
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  session,
  onLogout,
  wsConnected,
  mobileOpen,
  setMobileOpen,
  theme = 'dark',
  onToggleTheme
}) {
  const isLight = theme === 'light';

  const MENU_ITEMS = [
    { id: 'dashboard', label: 'Live Monitoring', icon: LayoutDashboard, roles: ['Admin', 'Exam Controller', 'Operator', 'Viewer'] },
    { id: 'rover', label: 'Rover Surveillance', icon: Cpu, roles: ['Admin', 'Exam Controller', 'Operator', 'Viewer'] },
    { id: 'alerts', label: 'Active Alerts', icon: AlertTriangle, roles: ['Admin', 'Exam Controller', 'Operator', 'Viewer'], badgeCount: true },
    { id: 'reports', label: 'Incident Reports', icon: FileText, roles: ['Admin', 'Exam Controller', 'Operator'] },
    { id: 'analytics', label: 'Exam Analytics', icon: BarChart3, roles: ['Admin', 'Exam Controller', 'Operator', 'Viewer'] },
    { id: 'health', label: 'System Health', icon: Activity, roles: ['Admin', 'Exam Controller', 'Viewer'] },
    { id: 'history', label: 'AI Frame History', icon: History, roles: ['Admin', 'Exam Controller', 'Operator', 'Viewer'] },
    { id: 'settings', label: 'System Configuration', icon: Settings, roles: ['Admin', 'Exam Controller'] },
  ];

  // Filters menu items based on active session's role
  const allowedMenuItems = MENU_ITEMS.filter(item => item.roles.includes(session.role));

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setMobileOpen(false);
  };

  const SidebarContent = () => (
    <div className={`h-full flex flex-col justify-between border-r p-5 transition-colors duration-200 ${
      isLight 
        ? 'bg-white/95 border-slate-200 text-slate-800' 
        : 'bg-[#020617]/95 border-blue-900/30 text-slate-300'
    }`}>
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${
              isLight
                ? 'bg-blue-50 border-blue-200 shadow-sm'
                : 'bg-blue-600/20 border-blue-500/30 shadow-lg shadow-blue-500/10'
            }`}>
              <Shield className={`h-5 w-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
            </div>
            <div>
              <h2 className={`text-base font-bold tracking-tight leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>ExamShield</h2>
              <p className={`text-[10px] font-mono tracking-wider uppercase ${isLight ? 'text-slate-500 font-semibold' : 'text-slate-500'}`}>Rover Surveillance</p>
            </div>
          </div>

          {/* Theme Switcher Icon Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isLight 
                  ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' 
                  : 'bg-slate-900 border-blue-900/40 text-cyan-300 hover:border-cyan-400/50'
              }`}
            >
              {isLight ? <Moon className="h-4 w-4 text-blue-600" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </button>
          )}
        </div>

        {/* Live WS Connection Banner */}
        <div className={`mb-6 mx-1 p-2.5 rounded-xl border flex items-center justify-between ${
          isLight
            ? 'bg-slate-50 border-slate-200'
            : 'bg-blue-950/20 border-blue-900/30'
        }`}>
          <div className="flex items-center gap-2">
            <Radio className={`h-3.5 w-3.5 ${wsConnected ? 'text-cyan-500 animate-pulse' : 'text-slate-400'}`} />
            <span className={`text-[11px] font-mono font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Live Telemetry</span>
          </div>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide ${
            wsConnected 
              ? isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-500/20 text-cyan-400' 
              : isLight ? 'bg-rose-100 text-rose-800' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {wsConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="space-y-1">
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium font-sans cursor-pointer transition-all duration-200
                  ${isActive 
                    ? isLight
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                      : 'bg-blue-600/15 border border-blue-500/40 text-blue-400 font-semibold shadow-[0_0_12px_rgba(37,99,235,0.1)]' 
                    : isLight
                      ? 'hover:bg-slate-100 border border-transparent text-slate-600 hover:text-slate-900'
                      : 'hover:bg-blue-950/30 border border-transparent text-slate-400 hover:text-slate-200'}
                `}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4.5 w-4.5 ${isActive ? (isLight ? 'text-white' : 'text-blue-400') : (isLight ? 'text-slate-500' : 'text-slate-500')}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Information & Logout */}
      <div className={`pt-4 border-t ${isLight ? 'border-slate-200' : 'border-blue-900/30'}`}>
        <div className={`flex items-center gap-3 p-2 rounded-xl border mb-3 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-blue-950/20 border-blue-900/20'
        }`}>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-blue-500/10">
            {session.fullName ? session.fullName.charAt(0) : 'U'}
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <span className={`block text-xs font-semibold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{session.fullName}</span>
            <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.2 rounded mt-0.5 uppercase tracking-wide ${
              isLight ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-cyan-950/60 border border-cyan-800/30 text-cyan-400'
            }`}>
              {session.role}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 rounded-xl border border-transparent hover:border-rose-500/20 transition-all font-sans cursor-pointer"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>Disconnect Terminal</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden lg:block w-64 h-screen fixed top-0 left-0 z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Top Header (hidden on desktop) */}
      <header className={`lg:hidden h-16 w-full fixed top-0 left-0 border-b flex items-center justify-between px-4 z-30 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#020617] border-blue-900/30'
      }`}>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <span className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>ExamShield Terminal</span>
        </div>
        <div className="flex items-center gap-3">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`p-1.5 rounded-lg border ${isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-900 border-blue-900/40 text-cyan-300'}`}
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          )}
          <span className={`inline-block h-2 w-2 rounded-full ${wsConnected ? 'bg-cyan-500 animate-pulse' : 'bg-rose-500'}`} />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`p-1 rounded-lg transition-all ${isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="relative w-64 h-full pt-16 flex flex-col z-30">
            <SidebarContent />
          </nav>
        </div>
      )}
    </>
  );
}
