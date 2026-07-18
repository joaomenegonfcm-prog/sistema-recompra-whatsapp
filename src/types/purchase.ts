export type PurchaseStatus = 'active' | 'in_followup' | 'repurchased' | 'paused' | 'cancelled';

export type AttemptStatus = 'sent' | 'failed' | 'cancelled';

export type PurchaseAttemptHandling = 'keep' | 'void_attempts';

export interface PurchaseStatusHistoryMetadata {
  source: 'manual' | string;
  validAttemptsBefore?: number;
  voidedAttempts?: number;
  voidedAttemptIds?: string[];
}

export interface PurchaseStatusHistory {
  id: string;
  userId: string;
  purchaseId: string;
  changedBy: string;
  oldStatus: PurchaseStatus;
  newStatus: PurchaseStatus;
  reason: string;
  attemptHandling: PurchaseAttemptHandling;
  metadata: PurchaseStatusHistoryMetadata | null;
  createdAt: string;
}

export type ContactAttempt = {
  id: string;
  attempt_number: number;
  attempt_date: string;
  message: string;
  status: AttemptStatus;
  channel: string;
  voided_at: string | null;
  voided_by: string | null;
  voided_reason: string | null;
  voided_status_change_id: string | null;
};

export function isValidContactAttempt(attempt: ContactAttempt): boolean {
  return attempt.status === 'sent' && attempt.voided_at === null;
}

export type PurchaseDueCheck = {
  status: PurchaseStatus;
  attempts_count: number;
  reorder_date: string;
};
