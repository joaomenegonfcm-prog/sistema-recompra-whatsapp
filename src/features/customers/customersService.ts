import { supabase, supabaseConfigurationError } from '../../lib/supabase';
import { normalizePhone } from '../../lib/formatters';
import type { ContactAttempt, PurchaseStatus } from '../../types/purchase';

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  opt_out: boolean;
  opt_out_at: string | null;
  opt_out_reason: string | null;
  opt_out_updated_at: string | null;
  created_at: string;
  purchases: {
    id: string;
    status: PurchaseStatus;
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
  opt_out: boolean;
  opt_out_at: string | null;
  opt_out_reason: string | null;
  opt_out_updated_at: string | null;
  created_at: string;
  purchases: {
    id: string;
    product: string;
    purchase_date: string;
    reorder_days: number;
    reorder_date: string;
    status: PurchaseStatus;
    observation: string | null;
    created_at: string;
    contact_attempts: ContactAttempt[];
  }[];
};

export type UpdatedCustomer = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  opt_out: boolean;
  opt_out_at: string | null;
  opt_out_reason: string | null;
  opt_out_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerOptOutState = {
  customer_id: string;
  opt_out: boolean;
  opt_out_at: string | null;
  opt_out_reason: string | null;
  opt_out_updated_at: string | null;
};

export interface UpdateCustomerInput {
  customerId: string;
  name: string;
  phone: string;
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
  }

  return supabase;
}

export async function listCustomers(): Promise<CustomerListItem[]> {
  const query = getSupabaseClient()
    .from('customers')
    .select(`
      id,
      name,
      phone,
      notes,
      opt_out,
      opt_out_at,
      opt_out_reason,
      opt_out_updated_at,
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

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((customer) => ({
    ...customer,
    purchases: customer.purchases ?? [],
  }));
}

export async function getCustomerHistory(customerId: string): Promise<CustomerHistory> {
  const query = getSupabaseClient()
    .from('customers')
    .select(`
      id,
      name,
      phone,
      notes,
      opt_out,
      opt_out_at,
      opt_out_reason,
      opt_out_updated_at,
      created_at,
      purchases (
        id,
        product,
        purchase_date,
        reorder_days,
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
          channel,
          voided_at,
          voided_by,
          voided_reason,
          voided_status_change_id
        )
      )
    `)
    .eq('id', customerId)
    .maybeSingle();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Cliente não encontrado.');
  }

  return {
    ...data,
    purchases: (data.purchases ?? []).map((purchase) => ({
      ...purchase,
      contact_attempts: purchase.contact_attempts ?? [],
    })),
  };
}

export async function updateCustomer(input: UpdateCustomerInput): Promise<UpdatedCustomer> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);

  if (!name) {
    throw new Error('Informe o nome do cliente.');
  }

  if (phone.length < 10) {
    throw new Error('Informe um telefone com pelo menos 10 dígitos.');
  }

  const updatedAt = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from('customers')
    .update({ name, phone, updated_at: updatedAt })
    .eq('id', input.customerId)
    .select('id, name, phone, notes, opt_out, opt_out_at, opt_out_reason, opt_out_updated_at, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este telefone já pertence a outro cliente.');
    }

    throw error;
  }

  return data as UpdatedCustomer;
}

export async function setCustomerOptOut(
  customerId: string,
  optOut: boolean,
  reason: string,
): Promise<CustomerOptOutState> {
  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    throw new Error('Informe o motivo.');
  }

  const { data, error } = await getSupabaseClient().rpc('set_customer_opt_out', {
    p_customer_id: customerId,
    p_opt_out: optOut,
    p_reason: trimmedReason,
  });

  if (error) {
    throw error;
  }

  const updatedState = Array.isArray(data) ? data[0] : data;

  if (!updatedState) {
    throw new Error('Não foi possível confirmar a alteração de opt-out.');
  }

  return updatedState as CustomerOptOutState;
}
