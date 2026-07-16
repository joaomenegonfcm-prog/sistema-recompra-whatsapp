import type { PurchaseStatus } from './purchase';

export type Database = {
  public: {
    Tables: {
      purchases: {
        Row: {
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
        Insert: {
          id?: string;
          customer_name: string;
          phone: string;
          product_name: string;
          purchase_date: string;
          repurchase_date: string;
          status?: PurchaseStatus;
          attempt_count?: number;
          last_attempt_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          phone?: string;
          product_name?: string;
          purchase_date?: string;
          repurchase_date?: string;
          status?: PurchaseStatus;
          attempt_count?: number;
          last_attempt_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
