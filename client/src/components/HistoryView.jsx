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

export default function HistoryView({ logs = [], theme = 'dark' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [hallFilter, setHallFilter] = useState('ALL');

  const isLight = theme === 'light';

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
    <div className="space-y-7 pb-8">
      
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            AI Inference & Detection History
            <History className="h-6 w-6 text-blue-500" />
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Audit log of every YOLO bounding box prediction, face-match approved, and RFID gate clearance.
          </p>
        </div>
      </div>

      {/* 2. Filters & Search Controls */}
      <GlassCard theme={theme} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className={`absolute left-3.5 top-3 h-4 w-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit history..."
              className={`w-full border rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none transition-all ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className={`w-full border rounded-xl p-2 text-xs focus:outline-none ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500'
              }`}
            >
              <option value="ALL">Filter by Device (All)</option>
              {uniqueDevices.map(device => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={hallFilter}
              onChange={(e) => setHallFilter(e.target.value)}
              className={`w-full border rounded-xl p-2 text-xs focus:outline-none ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#010409] border-blue-900/30 text-white focus:border-blue-500'
              }`}
            >
              <option value="ALL">Filter by Room (All)</option>
              {uniqueHalls.map(hall => (
                <option key={hall} value={hall}>{hall}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* 3. Log History List */}
      <div className="space-y-4">
        {filteredLogs.map((log) => (
          <GlassCard key={log.id} theme={theme} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border flex-shrink-0 mt-0.5 ${
                isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-950/40 border-blue-900/30 text-cyan-400'
              }`}>
                <Cpu className="h-5.5 w-5.5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{log.decision}</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isLight ? 'bg-slate-100 text-slate-700' : 'bg-blue-950 text-cyan-400'
                  }`}>
                    {log.hall || 'LH-302'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {log.detectedObjects.map((obj, i) => (
                    <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      isLight ? 'bg-rose-50 border-rose-200 text-rose-700 font-semibold' : 'bg-rose-950/40 border-rose-800/30 text-rose-300'
                    }`}>
                      {obj}
                    </span>
                  ))}
                </div>

                <span className={`block text-[11px] mt-1 font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  OPERATOR: {log.operator}
                </span>
              </div>
            </div>

            <div className={`text-right text-xs font-mono flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          </GlassCard>
        ))}

        {filteredLogs.length === 0 && (
          <div className={`p-12 text-center rounded-2xl border border-dashed ${
            isLight ? 'bg-white border-slate-300' : 'bg-slate-950/20 border-white/10'
          }`}>
            <History className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <h4 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>No Frame History Found</h4>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Try clearing your search query or filter tags.</p>
          </div>
        )}
      </div>

    </div>
  );
}
