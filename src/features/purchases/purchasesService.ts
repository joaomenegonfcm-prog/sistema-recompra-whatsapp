import { normalizePhone } from '../../lib/formatters';
import { supabase, supabaseConfigurationError } from '../../lib/supabase';

export type CreatePurchaseInput = {
  customerName: string;
  phone: string;
  product: string;
  purchaseDate: string;
  reorderDays: number;
  observation?: string;
};

export type PurchaseStatus =
  | 'active'
  | 'in_followup'
  | 'repurchased'
  | 'paused'
  | 'cancelled';

export type PurchaseListItem = {
  id: string;
  product: string;
  purchase_date: string;
  reorder_date: string;
  status: PurchaseStatus;
  observation: string | null;
  created_at: string;
  customers: {
    id: string;
    name: string;
    phone: string;
  } | null;
};

type PurchaseQueryItem = Omit<PurchaseListItem, 'customers'> & {
  customers: PurchaseListItem['customers'] | NonNullable<PurchaseListItem['customers']>[];
};

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
  }

  return supabase;
}

export async function createPurchase(input: CreatePurchaseInput) {
  const { data, error } = await getSupabaseClient().rpc('create_purchase_cycle', {
    p_customer_name: input.customerName.trim(),
    p_phone: normalizePhone(input.phone),
    p_product: input.product.trim(),
    p_purchase_date: input.purchaseDate,
    p_reorder_days: input.reorderDays,
    p_observation: input.observation?.trim() || null,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserPurchaseSettings() {
  if (!supabase) {
    return { default_reorder_days: 30 };
  }

  const { data, error } = await supabase
    .from('settings')
    .select('default_reorder_days')
    .single();

  if (error || !data) {
    return { default_reorder_days: 30 };
  }

  return data;
}

export async function listPurchases(status: PurchaseStatus | 'all' = 'all') {
  let query = getSupabaseClient()
    .from('purchases')
    .select(`
      id,
      product,
      purchase_date,
      reorder_date,
      status,
      observation,
      created_at,
      customers (
        id,
        name,
        phone
      )
    `)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as PurchaseQueryItem[]).map((purchase) => ({
    ...purchase,
    customers: Array.isArray(purchase.customers)
      ? (purchase.customers[0] ?? null)
      : purchase.customers,
  }));
}
