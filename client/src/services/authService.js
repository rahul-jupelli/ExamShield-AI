import { supabase } from "../lib/supabase";

export const signUp = (email, password, fullName) => {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || email,
        role: "Admin"
      }
    }
  });
};

export const signIn = (email, password) => {
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const signOut = () => {
  return supabase.auth.signOut();
};

export const resetPassword = (email) => {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
};

export const updatePassword = (newPassword) => {
  return supabase.auth.updateUser({
    password: newPassword,
  });
};

export const getSession = () => {
  return supabase.auth.getSession();
};

export const getUser = () => {
  return supabase.auth.getUser();
};

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};