import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ylhryvakpswdgapooica.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_DxCOoa3jXlXkhflv_sStjw_dRNjSd7I";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Supabase environment variables missing. Falling back to default credentials.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);