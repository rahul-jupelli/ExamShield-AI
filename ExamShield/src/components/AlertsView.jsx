import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Clock, 
  MapPin, 
  Wrench, 
  CornerDownRight, 
  Plus, 
  X,
  Sparkles
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function AlertsView({ alerts = [], role, onResolveAlert, onTriggerAlert }) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('Unauthorized Person Entry');
  const [newPriority, setNewPriority] = useState('HIGH');
  const [newLocation, setNewLocation] = useState('LH-302 Entrance');
  const [newDetails, setNewDetails] = useState('An individual was detected moving inside the restricted exam entrance corridor without matching badge verification.');

  const [resolvingId, setResolvingId] = useState(null);
  const [resolveActionText, setResolveActionText] = useState('');

  const isReadOnly = role === 'Viewer';

  const handleCreateAlert = (e) => {
    e.preventDefault();
    onTriggerAlert({
      title: newTitle,
      priority: newPriority,
      location: newLocation,
      details: newDetails
    });
    setShowForm(false);
  };

  const startResolve = (alertId) => {
    setResolvingId(alertId);
    setResolveActionText('Dispatched floor supervisors to location. Secured situation. Logged resolution.');
  };

  const submitResolve = (alertId) => {
    onResolveAlert(alertId, 'Resolved', resolveActionText);
    setResolvingId(null);
    setResolveActionText('');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            Incident Stream & Active Alerts
            <span className="text-xs px-2.5 py-0.5 rounded font-bold font-mono bg-rose-500/10 text-rose-400">
              {alerts.filter(a => a.status !== 'Resolved').length} Active
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Live proctor notifications from autonomous camera overlays and RF intercept systems.</p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 active:translate-y-px transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>TRIGGER MOCK ALERT</span>
          </button>
        )}
      </div>

      {/* 2. Mock Alert Trigger Form */}
      {showForm && (
        <GlassCard className="p-6 border-blue-500/30 max-w-2xl bg-slate-900/80 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Configure Test Security Incident Event
            </h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleCreateAlert} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Threat Title</label>
                <select
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Unauthorized Person Entry">Unauthorized Person Entry</option>
                  <option value="Electronic Device Intercept">Electronic Device Intercept</option>
                  <option value="Facial Verification Lockout">Facial Verification Lockout</option>
                  <option value="Critical Power Failure warning">Critical Power Failure warning</option>
                  <option value="Optical Sensor Offline">Optical Sensor Offline</option>
                  <option value="Network Handshake Timeout">Network Handshake Timeout</option>
                  <option value="Student Escaped Gate Verification">Student Escaped Gate Verification</option>
                  <option value="Rover Stalled or Stuck">Rover Stalled or Stuck</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Incident Severity</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="CRITICAL">CRITICAL (System Halt)</option>
                  <option value="HIGH">HIGH (Proctor Intervention Required)</option>
                  <option value="MEDIUM">MEDIUM (Investigation Initiated)</option>
                  <option value="LOW">LOW (Log Only)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Incident Location Coordinates</label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g. LH-302 Seat A-4"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Technical Log Details</label>
              <textarea
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                className="w-full bg-[#010409] border border-blue-900/30 rounded-lg p-2.5 text-xs text-white h-20 focus:border-blue-500 focus:outline-none resize-none"
                placeholder="Describe what occurred on the camera feeds or RF spectrum analysis..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
            >
              DISPATCH LIVE INCIDENT METRIC
            </button>
          </form>
        </GlassCard>
      )}

      {/* 3. Alerts Log List */}
      <div className="space-y-4">
        {alerts.map((alert) => {
          const isCritical = alert.priority === 'CRITICAL';
          const isHigh = alert.priority === 'HIGH';
          const isResolved = alert.status === 'Resolved';

          return (
            <div 
              key={alert.id}
              className={`
                relative overflow-hidden rounded-2xl border bg-slate-900/30 backdrop-blur-md p-5 flex flex-col md:flex-row gap-5 transition-all duration-300
                ${isResolved ? 'border-white/5 bg-slate-950/20 opacity-75' : 
                  isCritical ? 'border-rose-500/30 bg-rose-950/5 hover:border-rose-500/50' : 
                  isHigh ? 'border-amber-500/20 bg-amber-950/5 hover:border-amber-500/40' : 
                  'border-white/10 hover:border-blue-500/30'}
              `}
            >
              {/* Vertical Color Stripe Accent */}
              <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                isResolved ? 'bg-slate-700' :
                isCritical ? 'bg-rose-500' :
                isHigh ? 'bg-amber-500' : 'bg-blue-500'
              }`} />

              {/* Snapshot image if alert has one */}
              {alert.snapshot && !isResolved && (
                <div className="w-full md:w-32 h-24 rounded-xl overflow-hidden border border-blue-900/20 bg-slate-950 flex-shrink-0">
                  <img 
                    src={alert.snapshot} 
                    alt="Infraction snapshot" 
                    className="w-full h-full object-cover grayscale"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Core Content details */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isResolved ? 'bg-slate-800 text-slate-400' :
                    isCritical ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    isHigh ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {alert.priority}
                  </span>
                  
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                    isResolved ? 'bg-slate-800 text-slate-400' : 'bg-cyan-950 text-cyan-400'
                  }`}>
                    {alert.status}
                  </span>

                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-white leading-tight">{alert.title}</h3>
                  <p className="text-xs text-slate-400 font-sans mt-1 leading-relaxed">{alert.details}</p>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> LOCATION: {alert.location}</span>
                  {alert.actionTaken && (
                    <span className="flex items-center gap-1.5"><CornerDownRight className="h-3.5 w-3.5 text-slate-400" /> ACT: {alert.actionTaken}</span>
                  )}
                </div>

                {/* Inline Resolve Editor Form */}
                {resolvingId === alert.id && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-blue-500/20 space-y-2 animate-in slide-in-from-bottom-2">
                    <label className="block text-[9px] font-mono text-slate-400 uppercase">Input Resolution & Correction Actions Taken</label>
                    <textarea
                      value={resolveActionText}
                      onChange={(e) => setResolveActionText(e.target.value)}
                      className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setResolvingId(null)}
                        className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => submitResolve(alert.id)}
                        className="px-3 py-1 text-[10px] bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-md cursor-pointer"
                      >
                        Apply Resolution
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-shrink-0">
                {!isResolved && resolvingId !== alert.id && !isReadOnly && (
                  <button
                    onClick={() => startResolve(alert.id)}
                    className="w-full md:w-auto px-4 py-2 text-xs font-bold font-sans bg-blue-950/20 hover:bg-blue-500/10 hover:text-blue-300 rounded-xl border border-blue-900/30 hover:border-blue-500/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="h-4.5 w-4.5" />
                    <span>RESOLVE ALERT</span>
                  </button>
                )}
                {isResolved && (
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    RESOLVED
                  </span>
                )}
              </div>

            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-950/20">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">Clean Incident Log</h4>
            <p className="text-xs text-slate-500 mt-1">No active, unresolved threats are currently flagged by AI sensors.</p>
          </div>
        )}
      </div>

    </div>
  );
}
