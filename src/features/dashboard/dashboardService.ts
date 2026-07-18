import { supabase, supabaseConfigurationError } from '../../lib/supabase';
import { countValidRepurchasesByCustomer } from '../../lib/repurchase';
import type { PurchaseStatus } from '../../types/purchase';

export type DashboardSummary = {
  todayContacts: number;
  inFollowup: number;
  repurchased: number;
  paused: number;
  attemptsThisMonth: number;
};

type CountQuery = PromiseLike<{
  count: number | null;
  error: { message: string } | null;
}>;

type RepurchaseMetricRow = {
  customer_id: string | null;
  status: PurchaseStatus;
};

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
  }

  return supabase;
}

async function getCount(query: CountQuery): Promise<number> {
  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const client = getSupabaseClient();
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  const [
    todayContacts,
    inFollowup,
    validPurchasesForRepurchaseMetrics,
    paused,
    attemptsThisMonth,
  ] = await Promise.all([
    getCount(
      client.from('today_contacts').select('*', { count: 'exact', head: true }),
    ),
    getCount(
      client
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_followup'),
    ),
    client
      .from('purchases')
      .select('customer_id, status')
      .neq('status', 'cancelled'),
    getCount(
      client
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paused'),
    ),
    getCount(
      client
        .from('contact_attempts')
        .select('*', { count: 'exact', head: true })
        .gte('attempt_date', firstDayOfMonth.toISOString()),
    ),
  ]);

  if (validPurchasesForRepurchaseMetrics.error) {
    throw new Error(validPurchasesForRepurchaseMetrics.error.message);
  }

  return {
    todayContacts,
    inFollowup,
    repurchased: countValidRepurchasesByCustomer(
      (validPurchasesForRepurchaseMetrics.data ?? []) as RepurchaseMetricRow[],
    ),
    paused,
    attemptsThisMonth,
  };
}
