import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Layers,
  MapPin, 
  Clock, 
  Cpu, 
  CheckCircle
} from 'lucide-react';
import GlassCard from './GlassCard';

export default function HistoryView({ logs = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [hallFilter, setHallFilter] = useState('ALL');

  const uniqueDevices = useMemo(() => {
    const devices = new Set();
    logs.forEach(log => {
      log.detectedObjects.forEach(obj => devices.add(obj));
    });
    return Array.from(devices);
  }, [logs]);

  const uniqueHalls = useMemo(() => {
    const halls = new Set();
    logs.forEach(log => {
      if (log.hall) halls.add(log.hall);
    });
    return Array.from(halls);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = searchQuery ? (
        log.decision.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.detectedObjects.some(obj => obj.toLowerCase().includes(searchQuery.toLowerCase()))
      ) : true;

      const matchDevice = deviceFilter === 'ALL' ? true : log.detectedObjects.includes(deviceFilter);
      const matchHall = hallFilter === 'ALL' ? true : log.hall === hallFilter;

      return matchSearch && matchDevice && matchHall;
    });
  }, [logs, searchQuery, deviceFilter, hallFilter]);

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            AI Inference & Detection History
            <History className="h-5 w-5 text-blue-400" />
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Audit log of every YOLO bounding box prediction, face-match approved, and RFID gate clearance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6 relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by object name, decision, or operator..."
            className="w-full bg-slate-900/40 border border-blue-900/30 rounded-xl py-2 pl-9 pr-4 text-white text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="w-full bg-slate-900/40 border border-blue-900/30 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Filter Device: All</option>
            {uniqueDevices.map(dev => (
              <option key={dev} value={dev}>{dev}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={hallFilter}
            onChange={(e) => setHallFilter(e.target.value)}
            className="w-full bg-slate-900/40 border border-blue-900/30 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Filter Hall: All</option>
            {uniqueHalls.map(hall => (
              <option key={hall} value={hall}>{hall}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredLogs.map((log) => {
          const isDanger = log.decision.toLowerCase().includes('flagged') || log.decision.toLowerCase().includes('device');
          const isSuspicious = log.decision.toLowerCase().includes('suspicious');

          return (
            <div key={log.id}>
              <GlassCard className="p-4 flex flex-col md:flex-row gap-5">
                
                <div className="relative w-full md:w-44 aspect-video rounded-xl overflow-hidden border border-blue-900/20 bg-slate-950 flex-shrink-0">
                  <img 
                    src={log.frameUrl || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=500&auto=format&fit=crop&q=80'} 
                    alt="Inference frame" 
                    className="w-full h-full object-cover grayscale"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1.5 left-1.5 bg-slate-950/80 border border-blue-900/20 px-1 py-0.5 rounded text-[8px] font-mono text-slate-400">
                    CV_FRAME_INF
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isDanger ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        isSuspicious ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {log.decision}
                      </span>

                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase py-0.5 mr-1 flex items-center gap-1">
                        <Layers className="h-3 w-3" /> Detects:
                      </span>
                      {log.detectedObjects.map((obj, i) => (
                        <span 
                          key={i} 
                          className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            obj.toLowerCase().includes('watch') || obj.toLowerCase().includes('earbud')
                              ? 'bg-rose-950/30 text-rose-300 border-rose-800/20'
                              : 'bg-blue-950/10 border-blue-900/20 text-slate-300'
                          }`}
                        >
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-900/20 flex justify-between items-center text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> HALL: {log.hall}</span>
                    <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-slate-400" /> OPERATOR_ID: {log.operator}</span>
                  </div>
                </div>

              </GlassCard>
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-950/20">
            <CheckCircle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">No Inference Records Found</h4>
            <p className="text-xs text-slate-500 mt-1">Try relaxing your search terms or filters.</p>
          </div>
        )}
      </div>

    </div>
  );
}
