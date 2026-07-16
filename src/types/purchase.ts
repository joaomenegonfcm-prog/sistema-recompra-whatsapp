export type PurchaseStatus = 'active' | 'in_followup' | 'repurchased' | 'paused' | 'cancelled';

export type Purchase = {
  id: string;
  customer_name: string;
  phone: string;
  product_name: string;
  purchase_date: string;
  repurchase_date: string;
  status: PurchaseStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseInput = {
  customer_name: string;
  phone: string;
  product_name: string;
  purchase_date: string;
  repurchase_date: string;
  notes?: string | null;
};
