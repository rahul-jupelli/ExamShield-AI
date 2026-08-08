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

export default function AnalyticsView({ theme = 'dark' }) {
  const isLight = theme === 'light';

  // 1. Data: Student verified vs flagged
  const verificationData = [
    { name: 'Cleared Safe', value: 142, color: '#10b981' },
    { name: 'Suspicious', value: 12, color: '#f59e0b' },
    { name: 'Device Confirmed', value: 4, color: '#f43f5e' },
  ];

  // 2. Data: Device Types Detected
  const deviceTypeData = [
    { name: 'Smart Watches', count: 18, fill: '#3b82f6' },
    { name: 'Micro Earbuds', count: 9, fill: '#0ea5e9' },
    { name: 'Smartphones', count: 14, fill: '#06b6d4' },
    { name: 'Bluetooth Beacons', count: 5, fill: '#8b5cf6' },
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

  const gridColor = isLight ? '#e2e8f0' : '#1e293b';
  const textColor = isLight ? '#64748b' : '#94a3b8';

  return (
    <div className="space-y-7 pb-8">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Exam Security Analytics & Intelligence
            <BarChart3 className="h-6 w-6 text-blue-500" />
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Aggregated metrics for candidate verification rates, device spectrum signatures, and rover efficiency.
          </p>
        </div>
      </div>

      {/* 2. Top Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className={`block text-xs font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Overall Clearance</span>
            <span className={`text-2xl font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>94.2%</span>
            <span className="block text-[10px] text-emerald-500 font-semibold mt-0.5">142 verified gate passes</span>
          </div>
        </GlassCard>

        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-400'
          }`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className={`block text-xs font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Device Intercepts</span>
            <span className={`text-2xl font-extrabold ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>4 Confirmed</span>
            <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">12 flagged for review</span>
          </div>
        </GlassCard>

        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-cyan-400'
          }`}>
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className={`block text-xs font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>CV Model FPS</span>
            <span className={`text-2xl font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>29.8</span>
            <span className="block text-[10px] text-blue-500 font-semibold mt-0.5">32.4ms inference time</span>
          </div>
        </GlassCard>

        <GlassCard theme={theme} className="p-5 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'
          }`}>
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <span className={`block text-xs font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Rover Range</span>
            <span className={`text-2xl font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>3.2 km</span>
            <span className="block text-[10px] text-amber-500 font-semibold mt-0.5">88% remaining battery</span>
          </div>
        </GlassCard>
      </div>

      {/* 3. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Verification Ratio Pie Chart */}
        <div className="lg:col-span-6">
          <GlassCard theme={theme} className="p-6 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Candidate Verification Ratio Breakdown
            </h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verificationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {verificationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isLight ? '#ffffff' : '#0f172a', 
                      borderColor: isLight ? '#cbd5e1' : '#334155',
                      borderRadius: '12px',
                      color: isLight ? '#0f172a' : '#ffffff',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(value) => <span style={{ color: textColor, fontSize: '11px', fontWeight: 'bold' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Devices Detected Bar Chart */}
        <div className="lg:col-span-6">
          <GlassCard theme={theme} className="p-6 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Detected Device Spectrum Types
            </h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviceTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="name" stroke={textColor} fontSize={10} tickLine={false} />
                  <YAxis stroke={textColor} fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isLight ? '#ffffff' : '#0f172a', 
                      borderColor: isLight ? '#cbd5e1' : '#334155',
                      borderRadius: '12px',
                      color: isLight ? '#0f172a' : '#ffffff',
                      fontSize: '12px'
                    }} 
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {deviceTypeData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Hourly Scans & Flagged Candidates */}
        <div className="lg:col-span-12">
          <GlassCard theme={theme} className="p-6 space-y-4">
            <h3 className={`text-xs font-bold font-mono uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Hourly Scan Telemetry vs Flagged Deviations
            </h3>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyViolations}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="hour" stroke={textColor} fontSize={11} />
                  <YAxis stroke={textColor} fontSize={11} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isLight ? '#ffffff' : '#0f172a', 
                      borderColor: isLight ? '#cbd5e1' : '#334155',
                      borderRadius: '12px',
                      color: isLight ? '#0f172a' : '#ffffff',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend />
                  <Line type="monotone" dataKey="scans" stroke="#3b82f6" strokeWidth={3} name="Total Scans" />
                  <Line type="monotone" dataKey="flagged" stroke="#f43f5e" strokeWidth={3} name="Flagged Infractions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

      </div>

    </div>
  );
}
