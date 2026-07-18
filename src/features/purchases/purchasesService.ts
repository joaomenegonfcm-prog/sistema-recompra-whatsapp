import { addDays, format } from 'date-fns';
import { normalizePhone } from '../../lib/formatters';
import { supabase, supabaseConfigurationError } from '../../lib/supabase';
import { isValidDateString } from '../../lib/validators';
import type {
  PurchaseAttemptHandling,
  PurchaseStatus,
  PurchaseStatusHistory,
  PurchaseStatusHistoryMetadata,
} from '../../types/purchase';

export type {
  PurchaseAttemptHandling,
  PurchaseStatus,
  PurchaseStatusHistory,
  PurchaseStatusHistoryMetadata,
} from '../../types/purchase';

export type CreatePurchaseInput = {
  customerName: string;
  phone: string;
  product: string;
  purchaseDate: string;
  reorderDays: number;
  observation?: string;
};

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

export interface ChangePurchaseStatusInput {
  purchaseId: string;
  newStatus: PurchaseStatus;
  reason: string;
  attemptHandling?: PurchaseAttemptHandling;
}

export interface UpdatePurchaseInput {
  purchaseId: string;
  product: string;
  // purchase_date is read-only here until a transactional RPC can recalculate cycle history safely.
  reorderDays?: number;
  observation?: string | null;
}

export type UpdatedPurchase = {
  id: string;
  product: string;
  purchase_date: string;
  reorder_days: number;
  reorder_date: string;
  status: PurchaseStatus;
  observation: string | null;
  created_at: string;
  updated_at: string;
};

type PurchaseStatusHistoryRow = {
  id: string;
  user_id: string;
  purchase_id: string;
  changed_by: string;
  old_status: PurchaseStatus;
  new_status: PurchaseStatus;
  reason: string;
  attempt_handling: PurchaseAttemptHandling;
  metadata: unknown;
  created_at: string;
};

type ExistingPurchaseEditState = {
  purchase_date: string;
  reorder_days: number;
};

type UpdatePurchasePayload = {
  product: string;
  reorder_days: number;
  reorder_date: string;
  observation?: string | null;
  updated_at: string;
};

export class PurchaseStatusError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'PurchaseStatusError';
  }
}

type PurchaseQueryItem = Omit<PurchaseListItem, 'customers'> & {
  customers: PurchaseListItem['customers'] | NonNullable<PurchaseListItem['customers']>[];
};

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
  }

  return supabase;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMetadata(metadata: unknown): PurchaseStatusHistoryMetadata | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const source = typeof metadata.source === 'string' ? metadata.source : 'manual';
  const normalized: PurchaseStatusHistoryMetadata = { source };

  if (typeof metadata.validAttemptsBefore === 'number') {
    normalized.validAttemptsBefore = metadata.validAttemptsBefore;
  }

  if (typeof metadata.voidedAttempts === 'number') {
    normalized.voidedAttempts = metadata.voidedAttempts;
  }

  if (Array.isArray(metadata.voidedAttemptIds)) {
    normalized.voidedAttemptIds = metadata.voidedAttemptIds.filter(
      (attemptId): attemptId is string => typeof attemptId === 'string',
    );
  }

  return normalized;
}

function mapStatusHistory(row: PurchaseStatusHistoryRow): PurchaseStatusHistory {
  return {
    id: row.id,
    userId: row.user_id,
    purchaseId: row.purchase_id,
    changedBy: row.changed_by,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    reason: row.reason,
    attemptHandling: row.attempt_handling,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

function calculateReorderDate(purchaseDate: string, reorderDays: number) {
  return format(addDays(new Date(`${purchaseDate}T00:00:00`), reorderDays), 'yyyy-MM-dd');
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

export async function changePurchaseStatus(input: ChangePurchaseStatusInput): Promise<void> {
  const reason = input.reason.trim();
  const attemptHandling = input.attemptHandling ?? 'keep';

  if (!reason) {
    throw new PurchaseStatusError('Motivo é obrigatório');
  }

  const { error } = await getSupabaseClient().rpc('change_purchase_status', {
    p_purchase_id: input.purchaseId,
    p_new_status: input.newStatus,
    p_reason: reason,
    p_attempt_handling: attemptHandling,
  });

  if (error) {
    throw new PurchaseStatusError(
      getErrorMessage(error, 'Não foi possível alterar o status da compra.'),
      getErrorCode(error),
    );
  }
}

export async function getPurchaseStatusHistoryByPurchaseIds(
  purchaseIds: string[],
): Promise<PurchaseStatusHistory[]> {
  if (purchaseIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseClient()
    .from('purchase_status_history')
    .select(`
      id,
      user_id,
      purchase_id,
      changed_by,
      old_status,
      new_status,
      reason,
      attempt_handling,
      metadata,
      created_at
    `)
    .in('purchase_id', purchaseIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PurchaseStatusHistoryRow[]).map(mapStatusHistory);
}

export function groupPurchaseStatusHistoryByPurchaseId(
  history: PurchaseStatusHistory[],
): Record<string, PurchaseStatusHistory[]> {
  return history.reduce<Record<string, PurchaseStatusHistory[]>>((grouped, item) => {
    grouped[item.purchaseId] = grouped[item.purchaseId] ?? [];
    grouped[item.purchaseId].push(item);
    return grouped;
  }, {});
}

export async function updatePurchase(input: UpdatePurchaseInput): Promise<UpdatedPurchase> {
  const product = input.product.trim();

  if (!product) {
    throw new Error('Informe o produto comprado.');
  }

  const { data: existingPurchase, error: existingPurchaseError } = await getSupabaseClient()
    .from('purchases')
    .select('purchase_date, reorder_days')
    .eq('id', input.purchaseId)
    .single();

  if (existingPurchaseError) {
    throw existingPurchaseError;
  }

  const currentPurchase = existingPurchase as ExistingPurchaseEditState;
  const purchaseDate = currentPurchase.purchase_date;

  if (!isValidDateString(purchaseDate)) {
    throw new Error('A data da compra cadastrada é inválida.');
  }

  const reorderDays = input.reorderDays ?? currentPurchase.reorder_days;

  if (
    !Number.isFinite(reorderDays) ||
    !Number.isInteger(reorderDays) ||
    reorderDays <= 0
  ) {
    throw new Error(
      'Informe um número inteiro de dias para recompra maior que zero.',
    );
  }

  const reorderDate = calculateReorderDate(purchaseDate, reorderDays);
  const updatedAt = new Date().toISOString();
  const payload: UpdatePurchasePayload = {
    product,
    reorder_days: reorderDays,
    reorder_date: reorderDate,
    updated_at: updatedAt,
  };

  if ('observation' in input) {
    payload.observation = input.observation?.trim() || null;
  }

  const { data, error } = await getSupabaseClient()
    .from('purchases')
    .update(payload)
    .eq('id', input.purchaseId)
    .select(`
      id,
      product,
      purchase_date,
      reorder_days,
      reorder_date,
      status,
      observation,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    throw error;
  }

  return data as UpdatedPurchase;
}

export async function getUserPurchaseSettings() {
  if (!supabase) {
    return { default_reorder_days: 30, max_attempts: 3 };
  }

  const { data, error } = await supabase
    .from('settings')
    .select('default_reorder_days, max_attempts')
    .single();

  if (error || !data) {
    return { default_reorder_days: 30, max_attempts: 3 };
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

  return (data ?? []).map((purchase: PurchaseQueryItem) => ({
    ...purchase,
    customers: Array.isArray(purchase.customers)
      ? (purchase.customers[0] ?? null)
      : purchase.customers,
  }));
}
