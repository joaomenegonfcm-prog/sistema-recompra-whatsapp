import { supabase, supabaseConfigurationError } from '../../lib/supabase';

export type AppSettings = {
  id: string;
  user_id: string;
  default_reorder_days: number;
  second_attempt_after_days: number;
  third_attempt_after_days: number;
  max_attempts: number;
  default_message_template: string;
  created_at: string;
  updated_at: string;
};

export type UpdateSettingsInput = {
  default_reorder_days: number;
  second_attempt_after_days: number;
  third_attempt_after_days: number;
  max_attempts: number;
  default_message_template: string;
};

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
  }

  return supabase;
}

export async function getSettings() {
  const { data, error } = await getSupabaseClient()
    .from('settings')
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as AppSettings;
}

export async function updateSettings(settingsId: string, payload: UpdateSettingsInput) {
  const { data, error } = await getSupabaseClient()
    .from('settings')
    .update(payload)
    .eq('id', settingsId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as AppSettings;
}
