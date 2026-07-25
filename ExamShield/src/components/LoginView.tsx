import React, { useState } from 'react';
import { Shield, Key, Eye, UserCheck, Cpu, Terminal } from 'lucide-react';
import { UserRole } from '../types';

interface LoginViewProps {
  onLoginSuccess: (session: { username: string; role: UserRole; fullName: string }) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('officer_kiran');
  const [password, setPassword] = useState('••••••••');
  const [role, setRole] = useState<UserRole>('Operator');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const PRESETS = [
    { label: 'Officer Kiran (Operator)', role: 'Operator' as UserRole, username: 'officer_kiran', desc: 'Can control rover, clear safe alerts' },
    { label: 'Prof. Rangan (Controller)', role: 'Exam Controller' as UserRole, username: 'prof_rangan', desc: 'Approve/deny student entry status' },
    { label: 'Dr. Carter (System Admin)', role: 'Admin' as UserRole, username: 'dr_carter', desc: 'Full configuration & system thresholds' },
    { label: 'Standard Observer (Viewer)', role: 'Viewer' as UserRole, username: 'visitor_view', desc: 'Read-only live terminal overview' },
  ];

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setUsername(preset.username);
    setRole(preset.role);
    setPassword('demopass123');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('Please provide a security badge username.');
      return;
    }
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await response.json();
      if (data.success) {
        onLoginSuccess({
          username: data.username,
          role: data.role as UserRole,
          fullName: data.fullName,
        });
      } else {
        setErrorMessage(data.error || 'Identity verification failed.');
      }
    } catch (error) {
      setErrorMessage('Security server connection timed out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      {/* Decorative background grid and neon circles */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-cyan-600/5 blur-[100px]" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Side: Brand Promo Card */}
        <div className="md:col-span-7 flex flex-col justify-between p-8 rounded-3xl border border-blue-900/30 bg-slate-900/40 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                ExamShield AI
              </span>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              AI Rover Monitoring & Examination Security Dashboard
            </h1>
            
            <p className="text-slate-400 text-sm lg:text-base leading-relaxed mb-8">
              Protect academic integrity with active autonomous patrols. ExamShield utilizes computerized vision, 
              spectrum RF anomaly tracking, thermal imaging, and real-time gate controls to enforce exam environments safely.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl bg-blue-950/20 border border-blue-900/20">
                <Cpu className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold text-sm">Computer Vision Patrols</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Automated head posture profiling and smart device optical scanning.</p>
                </div>
              </div>
              
              <div className="flex gap-4 p-4 rounded-xl bg-blue-950/20 border border-blue-900/20">
                <Terminal className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold text-sm">Role-Based Access (RBAC)</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Strict authorization policies segregating Operators, Controllers, and Admins.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-blue-900/30 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>VESSEL DESIGNATION: SECURITY ROVER MONITOR</span>
            <span>v2.8.4-SECURE</span>
          </div>
        </div>

        {/* Right Side: Login Form Card */}
        <form onSubmit={handleSubmit} className="md:col-span-5 p-8 rounded-3xl border border-blue-500/30 bg-slate-900/60 backdrop-blur-lg flex flex-col justify-between shadow-2xl shadow-blue-500/10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Security Verification</h2>
            <p className="text-slate-400 text-xs mb-6">Authorize your station token using credentials or select a fast preset.</p>

            {errorMessage && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">User Identity</label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter user handle..."
                    className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Role Privilege</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 px-3 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="Operator">Operator (Primary Patrol & Safety)</option>
                  <option value="Exam Controller">Exam Controller (Clear Decisions)</option>
                  <option value="Admin">System Administrator</option>
                  <option value="Viewer">Observer / Guest</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Encryption Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter encryption key..."
                    className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-blue-500/20 active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  <span>DECRYPT & SECURE ACCESS</span>
                </>
              )}
            </button>
          </div>

          {/* Quick presets list for user convenience */}
          <div className="mt-8 pt-6 border-t border-blue-900/30">
            <span className="block text-xs font-semibold text-slate-400 mb-2.5 font-mono uppercase">Demonstration Quick Presets</span>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.username}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className="w-full text-left p-2 rounded-lg bg-blue-950/15 hover:bg-blue-500/10 border border-blue-900/20 hover:border-blue-500/40 transition-all flex items-start gap-2.5"
                >
                  <Eye className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="block text-[11px] font-bold text-slate-200">{preset.label}</span>
                    <span className="block text-[9px] text-slate-400 leading-tight">{preset.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
