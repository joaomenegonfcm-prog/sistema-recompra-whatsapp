import { supabase, supabaseConfigurationError } from '../../lib/supabase';

export type TodayContact = {
  purchase_id: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  product: string;
  purchase_date: string;
  reorder_date: string;
  status: 'active' | 'in_followup';
  attempts_count: number;
  next_attempt_number: number | null;
  next_contact_date: string;
  user_id: string;
};

export type UserSettings = {
  id: string;
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

export async function listTodayContacts() {
  const { data, error } = await getSupabaseClient()
    .from('today_contacts')
    .select('*')
    .order('next_contact_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TodayContact[];
}

export async function getSettings() {
  const { data, error } = await getSupabaseClient()
    .from('settings')
    .select(`
      id,
      default_reorder_days,
      second_attempt_after_days,
      third_attempt_after_days,
      max_attempts,
      default_message_template
    `)
    .single();

  if (error) {
    throw error;
  }

  return data as UserSettings;
}

export async function registerAttempt(purchaseId: string, message: string) {
  const { data, error } = await getSupabaseClient().rpc('register_contact_attempt', {
    p_purchase_id: purchaseId,
    p_message: message,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function pausePurchase(purchaseId: string) {
  const { error } = await getSupabaseClient().rpc('pause_purchase', {
    p_purchase_id: purchaseId,
  });

  if (error) {
    throw error;
  }
}
