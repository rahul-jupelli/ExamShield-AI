import React, { useState } from 'react';
import { supabase } from "../lib/supabase";
import { 
  Shield, 
  X, 
  Mail, 
  Key, 
  UserCheck, 
  UserPlus, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ArrowRight 
} from 'lucide-react';

export default function AuthModal({ initialMode = 'signin', onClose, onLoginSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        onClose();
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
        onClose();
      } else {
        setSuccessMessage("Admin account created! Please check your email or sign in.");
        setTimeout(() => switchMode('signin'), 2000);
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
        setSuccessMessage("Reset link dispatched to your email address.");
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={onClose} 
      />

      {/* Floating Modal Content */}
      <div className="relative w-full max-w-[420px] bg-[#090d16] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Shield className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-base font-extrabold text-white tracking-tight">ExamShield AI</span>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
        </div>

        {/* Header Title */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white tracking-tight">
            {mode === 'signin' && 'Sign In to Command Center'}
            {mode === 'signup' && 'Register Admin Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'signin' && 'Enter your admin credentials to access live telemetry.'}
            {mode === 'signup' && 'Create an administrator account for your exam hall.'}
            {mode === 'forgot' && 'Enter your email address to receive a recovery link.'}
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span className="leading-tight">{successMessage}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 uppercase mb-1">
                Admin Email
              </label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@examshield.edu"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-mono font-medium text-slate-400 uppercase">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[10px] font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs font-semibold tracking-wide shadow-sm active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Sign In to Command Center →</span>
              )}
            </button>
          </form>
        )}

        {/* SIGN UP FORM */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 uppercase mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Admin Name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 uppercase mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@examshield.edu"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 uppercase mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs font-semibold tracking-wide shadow-sm active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Register Account →</span>
              )}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 uppercase mb-1">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@examshield.edu"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs font-semibold tracking-wide shadow-sm active:translate-y-px transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Send Reset Link →</span>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180 text-blue-500" />
                <span>Return to Sign In</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
