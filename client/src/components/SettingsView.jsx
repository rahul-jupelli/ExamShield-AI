import React, { useState } from 'react';
import { 
  Settings, 
  Layers, 
  MapPin, 
  UserCheck, 
  Bell, 
  Cpu, 
  Sliders, 
  Plus, 
  Trash2, 
  Save, 
  ShieldCheck,
  Sun,
  Moon,
  Palette
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function SettingsView({ settings = {}, onSaveSettings, theme = 'dark', onToggleTheme }) {
  const [aiThreshold, setAiThreshold] = useState(settings.aiThreshold ?? 85);
  const [suspicionThreshold, setSuspicionThreshold] = useState(settings.suspicionThreshold ?? 70);
  const [newHall, setNewHall] = useState('');
  const [halls, setHalls] = useState(settings.examHalls || []);
  
  const [dashboard, setDashboard] = useState(settings.notificationChannels?.dashboard ?? true);
  const [audioAlerts, setAudioAlerts] = useState(settings.notificationChannels?.audioAlerts ?? true);
  const [smsDispatch, setSmsDispatch] = useState(settings.notificationChannels?.smsDispatch ?? false);
  const [deanEmail, setDeanEmail] = useState(settings.notificationChannels?.deanEmail ?? false);

  const [patrolSpeed, setPatrolSpeed] = useState(settings.roverConfig?.patrolSpeed ?? 0.5);
  const [opticalTracking, setOpticalTracking] = useState(settings.roverConfig?.opticalTracking ?? true);
  const [thermalInterval, setThermalInterval] = useState(settings.roverConfig?.thermalInterval ?? 5);

  const [showSavedToast, setShowSavedToast] = useState(false);
  const isLight = theme === 'light';

  const handleAddHall = (e) => {
    e.preventDefault();
    if (newHall.trim() && !halls.includes(newHall.trim())) {
      setHalls([...halls, newHall.trim()]);
      setNewHall('');
    }
  };

  const handleRemoveHall = (hallToRemove) => {
    setHalls(halls.filter(h => h !== hallToRemove));
  };

  const handleSave = () => {
    const updated = {
      examHalls: halls,
      aiThreshold,
      suspicionThreshold,
      notificationChannels: { dashboard, audioAlerts, smsDispatch, deanEmail },
      roverConfig: {
        patrolSpeed,
        thermalInterval,
        opticalTracking,
        rfJammerBlock: settings.roverConfig?.rfJammerBlock ?? false
      },
      operators: settings.operators || []
    };

    onSaveSettings(updated);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 4000);
  };

  return (
    <div className="space-y-7 pb-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            System Configuration Deck
            <Settings className="h-6 w-6 text-blue-500" />
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Manage artificial intelligence detection bounds, exam room registries, and proctor dispatch alerts.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:translate-y-px transition-all cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>COMMIT ADJUSTMENTS</span>
        </button>
      </div>

      {showSavedToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex gap-3 items-center text-emerald-700 dark:text-emerald-300 text-xs animate-in slide-in-from-top-4 duration-300 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <div>
            <span className="block font-bold">Parameters Saved Successfully</span>
            <span className="block text-[11px] opacity-90">Broadcasting updated bounding box metrics to active rover vessels.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Column Settings */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Appearance & Theme Preference */}
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              <Palette className="h-4 w-4 text-blue-500" />
              Interface Theme & Visual Preferences
            </h3>

            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-blue-900/20'
            }`}>
              <div>
                <span className={`block text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Active System Theme</span>
                <span className={`block text-[11px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Select interface color mode ({theme === 'dark' ? 'Dark Futuristic' : 'Clean Light'}).
                </span>
              </div>

              {onToggleTheme && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={theme === 'light' ? undefined : onToggleTheme}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                      theme === 'light'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sun className="h-4 w-4" /> Light
                  </button>
                  <button
                    type="button"
                    onClick={theme === 'dark' ? undefined : onToggleTheme}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                        : 'bg-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Moon className="h-4 w-4" /> Dark
                  </button>
                </div>
              )}
            </div>
          </GlassCard>

          {/* YOLO Classifiers */}
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              <Sliders className="h-4 w-4 text-blue-500" />
              YOLO Classifiers & Posture Confidence Thresholds
            </h3>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>Optical Device Match Confidence</span>
                  <span className="font-mono text-blue-600 dark:text-cyan-400 font-extrabold">{aiThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={aiThreshold}
                  onChange={(e) => setAiThreshold(parseInt(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-950 rounded-lg cursor-pointer"
                />
                <span className={`block text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Adjusts minimum required classification bounding box probability. Higher numbers decrease false flags.
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>Nervous Posture Deviance Threshold</span>
                  <span className="font-mono text-blue-600 dark:text-cyan-400 font-extrabold">{suspicionThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="95"
                  value={suspicionThreshold}
                  onChange={(e) => setSuspicionThreshold(parseInt(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-950 rounded-lg cursor-pointer"
                />
                <span className={`block text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Sensitivity trigger for skeletal pose estimation models tracking head-turns and lap-concealments.
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Active Exam Room Registry */}
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              <MapPin className="h-4 w-4 text-blue-500" />
              Active Exam Room Registry
            </h3>

            <div className="space-y-3.5">
              <form onSubmit={handleAddHall} className="flex gap-2.5">
                <input
                  type="text"
                  value={newHall}
                  onChange={(e) => setNewHall(e.target.value)}
                  placeholder="Add exam room (e.g. Auditorium-2)..."
                  className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 placeholder:text-slate-400' 
                      : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500 placeholder:text-slate-500'
                  }`}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {halls.map((hall) => (
                  <div 
                    key={hall} 
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#010409]/50 border-blue-900/20 text-slate-300'
                    }`}
                  >
                    <span className="font-bold truncate">{hall}</span>
                    <button
                      onClick={() => handleRemoveHall(hall)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Patrol & Camera Config */}
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              <Cpu className="h-4 w-4 text-blue-500" />
              Patrol & Camera Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className={`block font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Standard Patrol Speed (m/s)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1.5"
                  value={patrolSpeed}
                  onChange={(e) => setPatrolSpeed(parseFloat(e.target.value))}
                  className={`w-full border rounded-xl p-2.5 text-xs font-bold focus:outline-none transition-all ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#010409] border-blue-900/30 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Thermal imaging scan Sweep (sec)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={thermalInterval}
                  onChange={(e) => setThermalInterval(parseInt(e.target.value))}
                  className={`w-full border rounded-xl p-2.5 text-xs font-bold focus:outline-none transition-all ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#010409] border-blue-900/30 text-white'
                  }`}
                />
              </div>

              <div className={`sm:col-span-2 flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#010409]/40 border-blue-900/20'
              }`}>
                <div>
                  <span className={`block font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Continuous Camera Facial Tracking</span>
                  <span className={`block text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Locks frame overlay on faces during entry checking gate cycles.</span>
                </div>
                <input
                  type="checkbox"
                  checked={opticalTracking}
                  onChange={(e) => setOpticalTracking(e.target.checked)}
                  className="h-4.5 w-4.5 rounded accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </GlassCard>

        </div>

        {/* Right Column Settings */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Authorized Operators */}
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              <UserCheck className="h-4 w-4 text-blue-500" />
              Authorized Operator Terminals
            </h3>

            <div className="space-y-3">
              {(settings.operators || []).map((op, i) => (
                <div key={i} className={`flex gap-3.5 p-3 rounded-2xl border items-center shadow-sm transition-all ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#010409]/40 border-blue-900/20'
                }`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs border ${
                    isLight ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {op.name.charAt(op.name.startsWith('Prof') ? 5 : 0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`block text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{op.name}</span>
                    <span className="block text-[9px] font-mono text-blue-600 dark:text-cyan-400 font-bold uppercase">{op.role}</span>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Warning Channels */}
          <GlassCard theme={theme} className="p-5 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              <Bell className="h-4 w-4 text-blue-500" />
              Automated Proctor Warning Channels
            </h3>

            <div className="space-y-3 text-xs">
              <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                isLight ? 'bg-slate-50 border-slate-200 hover:bg-blue-50/50' : 'bg-[#010409]/40 border-blue-900/20 hover:bg-slate-900/50'
              }`}>
                <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Active Dashboard Toasts</span>
                <input
                  type="checkbox"
                  checked={dashboard}
                  onChange={(e) => setDashboard(e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                isLight ? 'bg-slate-50 border-slate-200 hover:bg-blue-50/50' : 'bg-[#010409]/40 border-blue-900/20 hover:bg-slate-900/50'
              }`}>
                <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Horns and Audio Alerts (Beeps)</span>
                <input
                  type="checkbox"
                  checked={audioAlerts}
                  onChange={(e) => setAudioAlerts(e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                isLight ? 'bg-slate-50 border-slate-200 hover:bg-blue-50/50' : 'bg-[#010409]/40 border-blue-900/20 hover:bg-slate-900/50'
              }`}>
                <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>SMS Dispatch to Hall Proctor</span>
                <input
                  type="checkbox"
                  checked={smsDispatch}
                  onChange={(e) => setSmsDispatch(e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                isLight ? 'bg-slate-50 border-slate-200 hover:bg-blue-50/50' : 'bg-[#010409]/40 border-blue-900/20 hover:bg-slate-900/50'
              }`}>
                <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Auto-Email Dean Administration</span>
                <input
                  type="checkbox"
                  checked={deanEmail}
                  onChange={(e) => setDeanEmail(e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                />
              </label>
            </div>
          </GlassCard>

        </div>

      </div>

    </div>
  );
}
