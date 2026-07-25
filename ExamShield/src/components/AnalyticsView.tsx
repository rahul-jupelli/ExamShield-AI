import React from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { BarChart3, TrendingUp, AlertTriangle, Zap, CheckCircle } from 'lucide-react';
import GlassCard from './GlassCard';

export default function AnalyticsView() {
  
  // 1. Data: Student verified vs flagged
  const verificationData = [
    { name: 'Cleared Safe', value: 142, color: '#10b981' },
    { name: 'Suspicious', value: 12, color: '#f59e0b' },
    { name: 'Device Confirmed', value: 4, color: '#f43f5e' },
  ];

  // 2. Data: Device Types Detected
  const deviceTypeData = [
    { name: 'Smart Watches', count: 18, fill: '#60a5fa' },
    { name: 'Micro Earbuds', count: 9, fill: '#38bdf8' },
    { name: 'Smartphones', count: 14, fill: '#0ea5e9' },
    { name: 'Bluetooth Beacons', count: 5, fill: '#a855f7' },
  ];

  // 3. Data: Violations per Hour (10:00 AM - 01:00 PM)
  const hourlyViolations = [
    { hour: '09:30 AM', scans: 45, flagged: 0 },
    { hour: '10:00 AM', scans: 88, flagged: 1 },
    { hour: '10:30 AM', scans: 112, flagged: 3 },
    { hour: '11:00 AM', scans: 94, flagged: 2 },
    { hour: '11:30 AM', scans: 72, flagged: 5 },
    { hour: '12:00 PM', scans: 89, flagged: 1 },
    { hour: '12:30 PM', scans: 120, flagged: 0 },
    { hour: '01:00 PM', scans: 34, flagged: 0 },
  ];

  // 4. Data: Battery decay curve over 4 hours patrol
  const batteryUsage = [
    { elapsed: '0m', battery: 100, temperature: 35.2 },
    { elapsed: '30m', battery: 92, temperature: 36.8 },
    { elapsed: '60m', battery: 84, temperature: 38.1 },
    { elapsed: '90m', battery: 75, temperature: 38.9 },
    { elapsed: '120m', battery: 67, temperature: 39.4 },
    { elapsed: '150m', battery: 59, temperature: 40.2 },
    { elapsed: '180m', battery: 50, temperature: 41.0 },
    { elapsed: '210m', battery: 42, temperature: 41.5 },
  ];

  // 5. Data: Exam Hall Incident Distributions
  const hallIncidents = [
    { name: 'LH-302', incidents: 14 },
    { name: 'LH-304', incidents: 6 },
    { name: 'Main Gym', incidents: 2 },
    { name: 'Block-C Lab', incidents: 8 },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          Examination Security Analytics
          <BarChart3 className="h-5 w-5 text-blue-400" />
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Statistical distributions of verified students, device types, and rover battery degradation curves.</p>
      </div>

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Verification Funnel distribution (5 cols) */}
        <GlassCard className="lg:col-span-5 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-1">Entry Verification Funnel</h3>
            <p className="text-[10px] text-slate-500 mb-4">Total breakdown of scanned student compliance classifications.</p>
          </div>

          <div className="h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={verificationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {verificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '11px' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Legends list */}
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono mt-4 pt-4 border-t border-blue-900/20">
            {verificationData.map((d, i) => (
              <div key={i} className="text-center">
                <span className="block font-bold" style={{ color: d.color }}>{d.value} Students</span>
                <span className="text-slate-500 mt-0.5 block">{d.name}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Chart 2: Device Counts (7 cols) */}
        <GlassCard className="lg:col-span-7 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-1">Identified Devices By Form Factor</h3>
            <p className="text-[10px] text-slate-500 mb-4">Total positive detections by spectrum radio telemetry and computerized optical filters.</p>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {deviceTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] text-slate-500 text-center font-mono mt-2 pt-2 border-t border-blue-900/20">
            Smart Watches remain the highest threat segment, representing 40.9% of flagged contraband.
          </div>
        </GlassCard>

        {/* Chart 3: Violations per Hour (Line Chart) (8 cols) */}
        <GlassCard className="lg:col-span-8 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-1">Hourly Activity & Scans Curve</h3>
            <p className="text-[10px] text-slate-500 mb-4">Tracking overall student gate sweeps against flagged security deviations over time.</p>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyViolations} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Line type="monotone" dataKey="scans" stroke="#3b82f6" strokeWidth={2.5} name="Total Scans" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="flagged" stroke="#ef4444" strokeWidth={2.5} name="Detections (Flags)" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Chart 4: Exam Hall Incidents Distribution (4 cols) */}
        <GlassCard className="lg:col-span-4 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-1">Violation Frequency by Room</h3>
            <p className="text-[10px] text-slate-500 mb-4">Comparing infraction density index across active examination rooms.</p>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hallIncidents} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                <Bar dataKey="incidents" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Chart 5: Battery Decay Curve (12 cols) */}
        <GlassCard className="lg:col-span-12 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-1">Chassis Thermal & Battery Discharge History</h3>
            <p className="text-[10px] text-slate-500 mb-4">Correlating continuous drive motor speeds with internal CPU thermal sensor rises.</p>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={batteryUsage} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="elapsed" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Line type="monotone" dataKey="battery" stroke="#10b981" strokeWidth={2} name="Battery Reserve (%)" />
                <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} name="CPU Core Temperature (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

      </div>

    </div>
  );
}
