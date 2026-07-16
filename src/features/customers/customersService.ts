import { supabase, supabaseConfigurationError } from '../../lib/supabase';

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  created_at: string;
  purchases: {
    id: string;
    status: string;
    purchase_date: string;
    reorder_date: string;
    created_at: string;
  }[];
};

export type CustomerHistory = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  created_at: string;
  purchases: {
    id: string;
    product: string;
    purchase_date: string;
    reorder_date: string;
    status: string;
    observation: string | null;
    created_at: string;
    contact_attempts: {
      id: string;
      attempt_number: number;
      attempt_date: string;
      message: string;
      status: string;
      channel: string;
    }[];
  }[];
};

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
  }

  return supabase;
}

export async function listCustomers() {
  const { data, error } = await getSupabaseClient()
    .from('customers')
    .select(`
      id,
      name,
      phone,
      notes,
      created_at,
      purchases (
        id,
        status,
        purchase_date,
        reorder_date,
        created_at
      )
    `)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as CustomerListItem[];
}

export async function getCustomerHistory(customerId: string) {
  const { data, error } = await getSupabaseClient()
    .from('customers')
    .select(`
      id,
      name,
      phone,
      notes,
      created_at,
      purchases (
        id,
        product,
        purchase_date,
        reorder_date,
        status,
        observation,
        created_at,
        contact_attempts (
          id,
          attempt_number,
          attempt_date,
          message,
          status,
          channel
        )
      )
    `)
    .eq('id', customerId)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as CustomerHistory;
}
