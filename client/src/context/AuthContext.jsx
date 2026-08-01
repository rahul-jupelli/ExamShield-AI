import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const formatUser = (rawUser) => {
    if (!rawUser) return null;
    return {
      ...rawUser,
      id: rawUser.id,
      email: rawUser.email,
      fullName: rawUser.user_metadata?.full_name || rawUser.email?.split("@")[0] || "Admin User",
      role: "Admin",
    };
  };

  useEffect(() => {
    // 1. Restore active session
    async function restoreSession() {
      try {
        const { data, error } = await authService.getSession();
        if (error) {
          console.error("Error checking session:", error.message);
        } else if (data?.session) {
          setSession(data.session);
          setUser(formatUser(data.session.user));
        }
      } catch (err) {
        console.error("Unexpected session restoration failure:", err);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();

    // 2. Listen to auth state changes
    const { data: { subscription } } = authService.onAuthStateChange((_event, currentSession) => {
      if (currentSession) {
        setSession(currentSession);
        setUser(formatUser(currentSession.user));
      } else {
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    setAuthError(null);
    const { data, error } = await authService.signIn(email, password);
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    return data;
  };

  const signUp = async (email, password, fullName) => {
    setAuthError(null);
    const { data, error } = await authService.signUp(email, password, fullName);
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    return data;
  };

  const signOut = async () => {
    setAuthError(null);
    const { error } = await authService.signOut();
    if (error) {
      console.error("Sign out error:", error.message);
    }
    setSession(null);
    setUser(null);
  };

  const resetPassword = async (email) => {
    setAuthError(null);
    const { data, error } = await authService.resetPassword(email);
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    return data;
  };

  const value = {
    session,
    user,
    loading,
    authError,
    setAuthError,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
