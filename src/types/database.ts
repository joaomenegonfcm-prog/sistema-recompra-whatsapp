import type { AttemptStatus, PurchaseAttemptHandling, PurchaseStatus } from './purchase';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          phone: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          phone?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          user_id: string;
          customer_id: string;
          product: string;
          purchase_date: string;
          reorder_days: number;
          reorder_date: string;
          status: PurchaseStatus;
          observation: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          customer_id: string;
          product: string;
          purchase_date: string;
          reorder_days?: number;
          reorder_date: string;
          status?: PurchaseStatus;
          observation?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          customer_id?: string;
          product?: string;
          purchase_date?: string;
          reorder_days?: number;
          reorder_date?: string;
          status?: PurchaseStatus;
          observation?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_attempts: {
        Row: {
          id: string;
          user_id: string;
          purchase_id: string;
          attempt_number: number;
          attempt_date: string;
          channel: string;
          message: string;
          status: AttemptStatus;
          created_at: string;
          voided_at: string | null;
          voided_by: string | null;
          voided_reason: string | null;
          voided_status_change_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          purchase_id: string;
          attempt_number: number;
          attempt_date?: string;
          channel?: string;
          message: string;
          status?: AttemptStatus;
          created_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
          voided_reason?: string | null;
          voided_status_change_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          purchase_id?: string;
          attempt_number?: number;
          attempt_date?: string;
          channel?: string;
          message?: string;
          status?: AttemptStatus;
          created_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
          voided_reason?: string | null;
          voided_status_change_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_attempts_purchase_id_fkey';
            columns: ['purchase_id'];
            isOneToOne: false;
            referencedRelation: 'purchases';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_attempts_voided_status_change_id_fkey';
            columns: ['voided_status_change_id'];
            isOneToOne: false;
            referencedRelation: 'purchase_status_history';
            referencedColumns: ['id'];
          },
        ];
      };
      purchase_status_history: {
        Row: {
          id: string;
          user_id: string;
          purchase_id: string;
          changed_by: string;
          old_status: PurchaseStatus;
          new_status: PurchaseStatus;
          reason: string;
          attempt_handling: PurchaseAttemptHandling;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          purchase_id: string;
          changed_by: string;
          old_status: PurchaseStatus;
          new_status: PurchaseStatus;
          reason: string;
          attempt_handling?: PurchaseAttemptHandling;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          purchase_id?: string;
          changed_by?: string;
          old_status?: PurchaseStatus;
          new_status?: PurchaseStatus;
          reason?: string;
          attempt_handling?: PurchaseAttemptHandling;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_status_history_purchase_id_fkey';
            columns: ['purchase_id'];
            isOneToOne: false;
            referencedRelation: 'purchases';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          id: string;
          user_id: string;
          default_reorder_days: number;
          second_attempt_after_days: number;
          third_attempt_after_days: number;
          max_attempts: number;
          default_message_template: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          default_reorder_days?: number;
          second_attempt_after_days?: number;
          third_attempt_after_days?: number;
          max_attempts?: number;
          default_message_template?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          default_reorder_days?: number;
          second_attempt_after_days?: number;
          third_attempt_after_days?: number;
          max_attempts?: number;
          default_message_template?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      today_contacts: {
        Row: {
          purchase_id: string;
          customer_id: string;
          customer_name: string;
          phone: string;
          product: string;
          purchase_date: string;
          reorder_date: string;
          status: PurchaseStatus;
          attempts_count: number;
          next_attempt_number: number | null;
          next_contact_date: string;
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      create_purchase_cycle: {
        Args: {
          p_customer_name: string;
          p_phone: string;
          p_product: string;
          p_purchase_date: string;
          p_reorder_days?: number;
          p_observation?: string | null;
        };
        Returns: string;
      };
      register_contact_attempt: {
        Args: {
          p_purchase_id: string;
          p_message: string;
        };
        Returns: string;
      };
      pause_purchase: {
        Args: {
          p_purchase_id: string;
        };
        Returns: undefined;
      };
      cancel_purchase: {
        Args: {
          p_purchase_id: string;
        };
        Returns: undefined;
      };
      change_purchase_status: {
        Args: {
          p_purchase_id: string;
          p_new_status: PurchaseStatus;
          p_reason: string;
          p_attempt_handling?: PurchaseAttemptHandling;
        };
        Returns: string;
      };
    };
    Enums: {
      purchase_status: PurchaseStatus;
      attempt_status: AttemptStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
