import React, { useState } from 'react';
import { supabase } from "../lib/supabase";
import {
  Shield,
  Key,
  UserCheck,
  Cpu,
  Terminal,
  UserPlus,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Sun,
  Moon
} from 'lucide-react';

export default function LoginView({ onLoginSuccess, theme = 'dark', onToggleTheme }) {
  // Modes: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState('signin');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Password visibility UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isLight = theme === 'light';

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
        }, 2500);
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
    <div className={`min-h-screen lg:h-screen w-full flex items-center justify-center p-3 sm:p-5 lg:p-6 relative overflow-x-hidden overflow-y-auto lg:overflow-hidden font-sans transition-colors duration-300 ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#090d16] text-slate-200'
    }`}>

      {/* Top Floating Theme Switcher Button */}
      {onToggleTheme && (
        <button
          type="button"
          onClick={onToggleTheme}
          title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
          className={`absolute top-4 right-4 z-50 p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2 shadow-sm ${
            isLight
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          {isLight ? <Moon className="h-4 w-4 text-blue-600" /> : <Sun className="h-4 w-4 text-amber-400" />}
          <span className="text-xs font-semibold">{isLight ? 'Dark' : 'Light'}</span>
        </button>
      )}

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 relative z-10 my-auto max-h-full">

        {/* Left Side: Brand & Feature Showcase */}
        <div className={`lg:col-span-7 flex flex-col justify-between p-5 sm:p-6 lg:p-7 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900/80 border-slate-800 text-slate-200'
        }`}>
          
          {/* Subtle top border accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />

          <div>
            {/* Header & Logo */}
            <div className="flex items-center justify-between mb-4 lg:mb-5">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                  isLight
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-blue-600/20 border-blue-500/30'
                }`}>
                  <Shield className={`h-5 w-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                </div>
                <div>
                  <span className={`text-xl sm:text-2xl font-extrabold tracking-tight block ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    ExamShield AI
                  </span>
                  <span className={`text-[9px] font-mono tracking-widest uppercase ${isLight ? 'text-blue-600 font-semibold' : 'text-blue-400'}`}>
                    Autonomous Telemetry Suite
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono ${
                isLight
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>GATEWAY ACTIVE</span>
              </div>
            </div>

            <h1 className={`text-2xl sm:text-3xl lg:text-3xl font-extrabold tracking-tight mb-2.5 leading-snug ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              Autonomous AI Rover & Exam Integrity Control Center
            </h1>

            <p className={`text-xs sm:text-sm leading-relaxed mb-4 lg:mb-5 ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Protect academic integrity with active autonomous patrols. ExamShield utilizes computer vision,
              thermal imaging, RF spectrum analysis, and real-time gate telemetry for secure examination oversight.
            </p>

            {/* Feature Highlight Cards */}
            <div className="space-y-2.5 sm:space-y-3">
              <div className={`flex gap-3.5 p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 shadow-sm ${
                isLight
                  ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5 ${
                  isLight
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-blue-600/15 border-blue-500/20 text-blue-400'
                }`}>
                  <Cpu className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className={`font-semibold text-xs sm:text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>Computer Vision Patrols</h4>
                  <p className={`text-[11px] sm:text-xs mt-0.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Automated head posture profiling, gaze tracking, and smart device scanning.
                  </p>
                </div>
              </div>

              <div className={`flex gap-3.5 p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 shadow-sm ${
                isLight
                  ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5 ${
                  isLight
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-blue-600/15 border-blue-500/20 text-blue-400'
                }`}>
                  <Terminal className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className={`font-semibold text-xs sm:text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>Secured Administrator Control</h4>
                  <p className={`text-[11px] sm:text-xs mt-0.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Protected Supabase authentication enforcing full administrative command of telemetry vectors.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Status Metadata */}
          <div className={`pt-4 mt-4 lg:pt-5 lg:mt-5 border-t flex items-center justify-between text-[11px] font-mono ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-500'
          }`}>
            <span className="flex items-center gap-1.5">
              <Lock className={`h-3 w-3 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
              <span>CHASSIS: SECURITY ROVER MONITOR</span>
            </span>
            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
              isLight ? 'bg-slate-100 border-slate-300 text-blue-700' : 'bg-slate-900 border-slate-800 text-blue-400'
            }`}>
              v2.8.4-ADMIN
            </span>
          </div>
        </div>

        {/* Right Side: Auth Form Card */}
        <div className={`lg:col-span-5 p-5 sm:p-6 lg:p-7 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col justify-between transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900/80 border-slate-800 text-slate-200'
        }`}>
          
          <div>
            {/* Mode Switch Segment Tabs */}
            <div className={`flex p-1 rounded-2xl border mb-4 lg:mb-5 ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register
              </button>
            </div>

            {/* Title Header */}
            <div className="mb-4 lg:mb-5">
              <h2 className={`text-xl sm:text-2xl font-bold mb-0.5 tracking-tight ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                {mode === 'signin' && 'Admin Security Gateway'}
                {mode === 'signup' && 'Register Admin Account'}
                {mode === 'forgot' && 'Reset Access Credentials'}
              </h2>
              <p className={`text-[11px] sm:text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {mode === 'signin' && 'Sign in using your registered admin email & password.'}
                {mode === 'signup' && 'Create a new Administrator account for ExamShield.'}
                {mode === 'forgot' && 'Enter your email to receive a password reset link.'}
              </p>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-3 mb-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMessage}</span>
              </div>
            )}

            {/* Success Notification */}
            {successMessage && (
              <div className="p-3 mb-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{successMessage}</span>
              </div>
            )}

            {/* FORMS */}

            {/* 1. SIGN IN FORM */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-3.5">
                <div>
                  <label className={`block text-[10px] font-medium mb-1 font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>Admin Email</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@examshield.edu"
                      className={`w-full border rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm focus:outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
                          : 'bg-slate-950 border-slate-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[10px] font-medium mb-1 font-mono uppercase tracking-wider ${
                      isLight ? 'text-slate-600' : 'text-slate-400'
                    }`}>Encryption Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className={`text-[10px] cursor-pointer font-medium ${
                        isLight ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className={`w-full border rounded-xl py-2 pl-9 pr-9 text-xs sm:text-sm focus:outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
                          : 'bg-slate-950 border-slate-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 lg:mt-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs sm:text-sm font-bold tracking-wide shadow-sm active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
              <form onSubmit={handleSignUp} className="space-y-2.5 sm:space-y-3">
                <div>
                  <label className={`block text-[10px] font-medium mb-1 font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>Full Name</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Admin Name"
                      className={`w-full border rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm focus:outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
                          : 'bg-slate-950 border-slate-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] font-medium mb-1 font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@examshield.edu"
                      className={`w-full border rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm focus:outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
                          : 'bg-slate-950 border-slate-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] font-medium mb-1 font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>Password (min 6 chars)</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full border rounded-xl py-2 pl-9 pr-9 text-xs sm:text-sm focus:outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
                          : 'bg-slate-950 border-slate-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] font-medium mb-1 font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>Confirm Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full border rounded-xl py-2 pl-9 pr-9 text-xs sm:text-sm focus:outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
                          : 'bg-slate-950 border-slate-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 lg:mt-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs sm:text-sm font-bold tracking-wide shadow-sm active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
              <form onSubmit={handleForgotPassword} className="space-y-3 sm:space-y-3.5">
                <div>
                  <label className={`block text-[10px] font-medium mb-1 font-mono uppercase tracking-wider ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>Registered Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@examshield.edu"
                      className={`w-full border rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm focus:outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
                          : 'bg-slate-950 border-slate-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 lg:mt-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs sm:text-sm font-bold tracking-wide shadow-sm active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className={`text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer transition-colors ${
                      isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180 text-blue-500" />
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
