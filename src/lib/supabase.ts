import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurationError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.'
    : null;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
