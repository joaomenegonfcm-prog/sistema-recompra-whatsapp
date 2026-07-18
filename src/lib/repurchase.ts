import { addDays, isAfter, parseISO } from 'date-fns';
import type { PurchaseDueCheck, PurchaseStatus } from '../types/purchase';

export const statusLabels: Record<PurchaseStatus, string> = {
  active: 'Ativo',
  in_followup: 'Em acompanhamento',
  repurchased: 'Recomprou',
  paused: 'Pausado',
  cancelled: 'Cancelado',
};

export function getAttemptDate(repurchaseDate: string, attemptNumber: number) {
  const firstAttemptDate = parseISO(repurchaseDate);

  if (attemptNumber === 1) {
    return firstAttemptDate;
  }

  if (attemptNumber === 2) {
    return addDays(firstAttemptDate, 7);
  }

  return addDays(firstAttemptDate, 22);
}

export function shouldPauseAfterAttempt(attemptNumber: number) {
  return attemptNumber >= 3;
}

type MetricPurchase = {
  status: PurchaseStatus;
};

type CustomerMetricPurchase = MetricPurchase & {
  customer_id: string | null;
};

export function isMetricPurchaseValid(purchase: MetricPurchase) {
  return purchase.status !== 'cancelled';
}

export function countValidRepurchases(purchases: MetricPurchase[]) {
  const validPurchases = purchases.filter(isMetricPurchaseValid);

  return Math.max(validPurchases.length - 1, 0);
}

export function countValidRepurchasesByCustomer(purchases: CustomerMetricPurchase[]) {
  const purchasesByCustomer = purchases
    .filter((purchase) => purchase.customer_id && isMetricPurchaseValid(purchase))
    .reduce<Record<string, number>>((grouped, purchase) => {
      grouped[purchase.customer_id as string] = (grouped[purchase.customer_id as string] ?? 0) + 1;
      return grouped;
    }, {});

  return Object.values(purchasesByCustomer).reduce(
    (total, purchasesCount) => total + Math.max(purchasesCount - 1, 0),
    0,
  );
}

export function isPurchaseDueForContact(purchase: PurchaseDueCheck, referenceDate = new Date()) {
  if (!['active', 'in_followup'].includes(purchase.status)) {
    return false;
  }

  const nextAttempt = Math.min(purchase.attempts_count + 1, 3);
  const nextAttemptDate = getAttemptDate(purchase.reorder_date, nextAttempt);

  return !isAfter(nextAttemptDate, referenceDate);
}
