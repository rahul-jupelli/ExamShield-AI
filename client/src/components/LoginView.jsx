import React, { useState } from 'react';
import { supabase } from "../lib/supabase";
import { Shield, Key, UserCheck, Cpu, Terminal, UserPlus, Mail, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LoginView({ onLoginSuccess }) {
  // Modes: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState('signin');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data?.user && onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setErrorMessage(err.message || "An unexpected error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || !fullName.trim()) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'Admin',
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data?.session && onLoginSuccess) {
        onLoginSuccess(data.user);
      } else {
        setSuccessMessage("Admin account created successfully! Please check your email to confirm registration or sign in.");
        setTimeout(() => {
          switchMode('signin');
        }, 3000);
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}`,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage("Password reset link has been dispatched to your email address.");
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-cyan-600/5 blur-[100px]" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">

        {/* Left Side: Brand & Feature Showcase */}
        <div className="md:col-span-7 flex flex-col justify-between p-8 rounded-3xl border border-blue-900/30 bg-slate-900/40 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/40 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-white bg-clip-text text-transparent">
                ExamShield AI
              </span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              Autonomous AI Rover & Exam Integrity Control Center
            </h1>

            <p className="text-slate-400 text-sm lg:text-base leading-relaxed mb-8">
              Protect academic integrity with active autonomous patrols. ExamShield utilizes computer vision,
              thermal imaging, RF spectrum analysis, and real-time gate telemetry for secure examination oversight.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl bg-blue-950/20 border border-blue-900/20">
                <Cpu className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold text-sm">Computer Vision Patrols</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Automated head posture profiling, gaze tracking, and smart device scanning.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-blue-950/20 border border-blue-900/20">
                <Terminal className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold text-sm">Secured Administrator Control</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Protected Supabase authentication enforcing full administrative command of telemetry vectors.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-blue-900/30 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>CHASSIS: SECURITY ROVER MONITOR</span>
            <span>v2.8.4-ADMIN</span>
          </div>
        </div>

        {/* Right Side: Auth Form Card */}
        <div className="md:col-span-5 p-8 rounded-3xl border border-blue-500/30 bg-slate-900/60 backdrop-blur-lg flex flex-col justify-between shadow-2xl shadow-blue-500/10">
          <div>
            {/* Mode Switch Tabs */}
            <div className="flex bg-[#010409] p-1 rounded-xl border border-blue-900/30 mb-6">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                {mode === 'signin' && 'Admin Security Gateway'}
                {mode === 'signup' && 'Register Admin Account'}
                {mode === 'forgot' && 'Reset Access Credentials'}
              </h2>
              <p className="text-slate-400 text-xs">
                {mode === 'signin' && 'Sign in using your registered admin email & password.'}
                {mode === 'signup' && 'Create a new Administrator account for ExamShield.'}
                {mode === 'forgot' && 'Enter your email to receive a password reset link.'}
              </p>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Notification */}
            {successMessage && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* FORMS */}

            {/* 1. SIGN IN FORM */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Admin Email</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@examshield.edu"
                      className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-400 font-mono uppercase">Encryption Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-blue-500/20 active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      <span>AUTHENTICATE & GRANT ACCESS</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 2. SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Full Name</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Admin Name"
                      className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@examshield.edu"
                      className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Password (min 6 chars)</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Confirm Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-blue-500/20 active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>CREATE ADMIN ACCOUNT</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 3. FORGOT PASSWORD FORM */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">Registered Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@examshield.edu"
                      className="w-full bg-[#010409] border border-blue-900/30 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-blue-500/20 active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      <span>DISPATCH RESET LINK</span>
                    </>
                  )}
                </button>

                <div className="pt-3 text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <ArrowRight className="h-3 w-3 rotate-180" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
