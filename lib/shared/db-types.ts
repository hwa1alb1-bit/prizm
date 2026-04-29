// Generated from live Supabase project dcirauvtuvvokvcwczft on 2026-04-29.
// Regenerate with: pnpm supabase gen types typescript --project-id dcirauvtuvvokvcwczft
// Do not edit by hand. Run the codegen instead.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      api_key: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes: string[]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'api_key_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'api_key_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      audit_event: {
        Row: {
          actor_ip: unknown
          actor_user_agent: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          workspace_id: string | null
        }
        Insert: {
          actor_ip?: unknown
          actor_user_agent?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Update: {
          actor_ip?: unknown
          actor_user_agent?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_event_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_event_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          document_id: string | null
          id: string
          reason: string
          stripe_invoice_id: string | null
          workspace_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          document_id?: string | null
          id?: string
          reason: string
          stripe_invoice_id?: string | null
          workspace_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          document_id?: string | null
          id?: string
          reason?: string
          stripe_invoice_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'credit_ledger_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'credit_ledger_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      document: {
        Row: {
          content_type: string
          created_at: string
          deleted_at: string | null
          expires_at: string
          failure_reason: string | null
          filename: string
          id: string
          pages: number | null
          s3_bucket: string
          s3_key: string
          size_bytes: number
          status: string
          textract_job_id: string | null
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          failure_reason?: string | null
          filename: string
          id?: string
          pages?: number | null
          s3_bucket: string
          s3_key: string
          size_bytes: number
          status: string
          textract_job_id?: string | null
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          failure_reason?: string | null
          filename?: string
          id?: string
          pages?: number | null
          s3_bucket?: string
          s3_key?: string
          size_bytes?: number
          status?: string
          textract_job_id?: string | null
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'document_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'document_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      statement: {
        Row: {
          account_last4: string | null
          bank_name: string | null
          closing_balance: number | null
          computed_total: number | null
          created_at: string
          deleted_at: string | null
          document_id: string
          expires_at: string
          id: string
          opening_balance: number | null
          period_end: string | null
          period_start: string | null
          reconciles: boolean | null
          reported_total: number | null
          transactions: Json
          workspace_id: string
        }
        Insert: {
          account_last4?: string | null
          bank_name?: string | null
          closing_balance?: number | null
          computed_total?: number | null
          created_at?: string
          deleted_at?: string | null
          document_id: string
          expires_at?: string
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          reconciles?: boolean | null
          reported_total?: number | null
          transactions?: Json
          workspace_id: string
        }
        Update: {
          account_last4?: string | null
          bank_name?: string | null
          closing_balance?: number | null
          computed_total?: number | null
          created_at?: string
          deleted_at?: string | null
          document_id?: string
          expires_at?: string
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          reconciles?: boolean | null
          reported_total?: number | null
          transactions?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'statement_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'statement_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      subscription: {
        Row: {
          billing_cycle: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscription_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      user_profile: {
        Row: {
          created_at: string
          email: string
          email_normalized: string
          full_name: string | null
          id: string
          role: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          email_normalized?: string
          full_name?: string | null
          id: string
          role?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          email_normalized?: string
          full_name?: string | null
          id?: string
          role?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_profile_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      workspace: {
        Row: {
          created_at: string
          default_region: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_region?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_region?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
