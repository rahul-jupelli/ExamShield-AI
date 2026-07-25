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
  Radio
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  session,
  onLogout,
  wsConnected,
  mobileOpen,
  setMobileOpen
}) {
  
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
    <div className="h-full flex flex-col justify-between bg-[#020617]/95 border-r border-blue-900/30 p-5 text-slate-300">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-8 px-2">
          <div className="h-9 w-9 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/10">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight leading-tight">ExamShield</h2>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Rover Surveillance</p>
          </div>
        </div>

        {/* Live WS Connection Banner */}
        <div className="mb-6 mx-1 p-2.5 rounded-xl bg-blue-950/20 border border-blue-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`h-3.5 w-3.5 ${wsConnected ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-[11px] font-mono font-medium text-slate-300">Live Telemetry</span>
          </div>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide ${wsConnected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-rose-500/20 text-rose-400'}`}>
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
                    ? 'bg-blue-600/15 border border-blue-500/40 text-blue-400 font-semibold shadow-[0_0_12px_rgba(37,99,235,0.1)]' 
                    : 'hover:bg-blue-950/30 border border-transparent text-slate-400 hover:text-slate-200'}
                `}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Information & Logout */}
      <div className="pt-4 border-t border-blue-900/30">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-blue-950/20 border border-blue-900/20 mb-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-blue-500/10">
            {session.fullName ? session.fullName.charAt(0) : 'U'}
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <span className="block text-xs font-semibold text-white truncate">{session.fullName}</span>
            <span className="inline-block text-[9px] font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/30 px-1.5 py-0.2 rounded mt-0.5 uppercase tracking-wide">
              {session.role}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl border border-transparent hover:border-rose-500/20 transition-all font-sans cursor-pointer"
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
      <header className="lg:hidden h-16 w-full fixed top-0 left-0 bg-[#020617] border-b border-blue-900/30 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          <span className="text-sm font-bold text-white tracking-tight">ExamShield Terminal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-block h-2 w-2 rounded-full ${wsConnected ? 'bg-cyan-400 animate-pulse' : 'bg-rose-400'}`} />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
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
