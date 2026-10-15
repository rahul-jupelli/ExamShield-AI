import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const VALID_STAFF_ROLES = ["Admin", "Exam Controller", "Operator", "Viewer"];

  const formatUser = (rawUser) => {
    if (!rawUser) return null;
    // CRITICAL: user_metadata is untrusted user-editable data and must NOT be used for authorization.
    // Trusted staff roles must be provisioned in app_metadata.role (by an admin or secure backend).
    const trustedRole = rawUser.app_metadata?.role;
    const role = VALID_STAFF_ROLES.includes(trustedRole) ? trustedRole : null;
    const isStaff = Boolean(role);
    const claimedRole = rawUser.user_metadata?.role || null;

    return {
      ...rawUser,
      id: rawUser.id,
      email: rawUser.email,
      fullName: rawUser.user_metadata?.full_name || rawUser.email?.split("@")[0] || "User",
      role,          // "Admin" | "Exam Controller" | "Operator" | "Viewer" | null
      isStaff,       // boolean: true only when app_metadata contains a whitelisted staff role
      claimedRole,   // untrusted metadata role for auditing/informational display only
    };
  };

  useEffect(() => {
    // 1. Restore active session
    async function restoreSession() {
      try {
        const { data, error } = await authService.getSession();
        if (error) {
          console.warn("Session retrieval notice:", error.message);
        } else if (data?.session) {
          setSession(data.session);
          setUser(formatUser(data.session.user));
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (err) {
        console.warn("Unexpected session restoration failure:", err);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();

    // 2. Listen to auth state changes
    const { data: { subscription } } = authService.onAuthStateChange((_event, currentSession) => {
      if (currentSession?.user) {
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
    try {
      const { error } = await authService.signOut();
      if (error) {
        console.warn("Sign out notice:", error.message);
      }
    } catch (err) {
      console.warn("Unexpected sign out failure:", err);
    } finally {
      setSession(null);
      setUser(null);
    }
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
