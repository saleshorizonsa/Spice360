import { createClient } from '@supabase/supabase-js';

const phpApiUrl = import.meta.env.VITE_API_URL;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase is only active when both Supabase vars AND no PHP API URL are present.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && !phpApiUrl;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
