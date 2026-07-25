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
  ShieldCheck
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function SettingsView({ settings = {}, onSaveSettings }) {
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
    <div className="space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            System Configuration Deck
            <Settings className="h-5 w-5 text-blue-400" />
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Manage artificial intelligence detection bounds, exam room registries, and proctor dispatch alerts.</p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 active:translate-y-px transition-all cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>COMMIT ADJUSTMENTS</span>
        </button>
      </div>

      {showSavedToast && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 items-center text-emerald-300 text-xs animate-in slide-in-from-top-4 duration-300">
          <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="block font-bold">Parameters Saved Successfully</span>
            <span className="block text-[10px] text-emerald-400/80">Broadcasting updated bounding box metrics to active rover vessels.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-7 space-y-6">
          
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-cyan-400" />
              YOLO Classifiers & Posture Confidence Thresholds
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Optical Device Match Confidence</span>
                  <span className="font-mono text-cyan-400 font-bold">{aiThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={aiThreshold}
                  onChange={(e) => setAiThreshold(parseInt(e.target.value))}
                  className="w-full accent-blue-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                />
                <span className="block text-[10px] text-slate-500 leading-tight">
                  Adjusts the minimum required classification bounding box probability. Higher numbers decrease false flags.
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Nervous Posture Deviance Threshold</span>
                  <span className="font-mono text-cyan-400 font-bold">{suspicionThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="95"
                  value={suspicionThreshold}
                  onChange={(e) => setSuspicionThreshold(parseInt(e.target.value))}
                  className="w-full accent-blue-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                />
                <span className="block text-[10px] text-slate-500 leading-tight">
                  Sets the sensitivity trigger for skeletal pose estimation models tracking head-turns and lap-concealments.
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-cyan-400" />
              Active Exam Room Registry
            </h3>

            <div className="space-y-3">
              <form onSubmit={handleAddHall} className="flex gap-2.5">
                <input
                  type="text"
                  value={newHall}
                  onChange={(e) => setNewHall(e.target.value)}
                  placeholder="Add exam room (e.g. Auditorium-2)..."
                  className="flex-1 bg-[#010409] border border-blue-900/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1.5">
                {halls.map((hall) => (
                  <div key={hall} className="p-2.5 rounded-xl bg-[#010409]/50 border border-blue-900/20 flex items-center justify-between text-xs text-slate-300">
                    <span className="font-mono truncate">{hall}</span>
                    <button
                      onClick={() => handleRemoveHall(hall)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-cyan-400" />
              Patrol & Camera Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Standard Patrol Speed (m/s)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1.5"
                  value={patrolSpeed}
                  onChange={(e) => setPatrolSpeed(parseFloat(e.target.value))}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-xl p-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Thermal imaging scan Sweep (sec)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={thermalInterval}
                  onChange={(e) => setThermalInterval(parseInt(e.target.value))}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-xl p-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-[#010409]/40 border border-blue-900/20">
                <div>
                  <span className="block font-bold text-slate-300">Continuous Camera Facial Tracking</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">Locks frame overlay on faces during entry checking gate cycles.</span>
                </div>
                <input
                  type="checkbox"
                  checked={opticalTracking}
                  onChange={(e) => setOpticalTracking(e.target.checked)}
                  className="h-4 w-4 rounded bg-[#010409] border border-blue-900/30 accent-blue-500"
                />
              </div>
            </div>
          </GlassCard>

        </div>

        <div className="lg:col-span-5 space-y-6">
          
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-cyan-400" />
              Authorized Operator Terminals
            </h3>

            <div className="space-y-2.5">
              {(settings.operators || []).map((op, i) => (
                <div key={i} className="flex gap-3 p-2.5 rounded-xl bg-[#010409]/40 border border-blue-900/20 items-center">
                  <div className="h-7 w-7 rounded-full bg-blue-500/10 flex items-center justify-center font-bold text-xs text-blue-400 border border-blue-500/20">
                    {op.name.charAt(op.name.startsWith('Prof') ? 5 : 0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-slate-200 truncate">{op.name}</span>
                    <span className="block text-[9px] font-mono text-cyan-400 uppercase">{op.role}</span>
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-cyan-400" />
              Automated Proctor Warning Channels
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>Active Dashboard Toasts</span>
                <input type="checkbox" checked={dashboard} onChange={(e) => setDashboard(e.target.checked)} className="h-4 w-4 rounded accent-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <span>Horns and Audio Alerts (Beeps)</span>
                <input type="checkbox" checked={audioAlerts} onChange={(e) => setAudioAlerts(e.target.checked)} className="h-4 w-4 rounded accent-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <span>SMS Dispatch to Hall Proctor</span>
                <input type="checkbox" checked={smsDispatch} onChange={(e) => setSmsDispatch(e.target.checked)} className="h-4 w-4 rounded accent-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <span>Auto-Email Dean Administration</span>
                <input type="checkbox" checked={deanEmail} onChange={(e) => setDeanEmail(e.target.checked)} className="h-4 w-4 rounded accent-blue-500" />
              </div>
            </div>
          </GlassCard>

        </div>

      </div>

    </div>
  );
}
