// Generated from Supabase project dcirauvtuvvokvcwczft on 2026-05-08.
// Regenerate with: pnpm dlx supabase@latest gen types typescript --project-id dcirauvtuvvokvcwczft --schema public
// Reconcile against checked-in migrations when live project migrations lag this branch.
// Do not edit by hand except to resolve branch-only migration drift before the live DB catches up.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
          billing_period_end: string | null
          billing_period_start: string | null
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
          billing_period_end?: string | null
          billing_period_start?: string | null
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
          billing_period_end?: string | null
          billing_period_start?: string | null
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
            referencedRelation: 'deletion_evidence'
            referencedColumns: ['document_id']
          },
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
      credit_reservation: {
        Row: {
          consumed_at: string | null
          created_at: string
          credits: number
          document_id: string
          id: string
          released_at: string | null
          request_id: string | null
          reserved_at: string
          reserved_by: string | null
          status: string
          trace_id: string | null
          workspace_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          credits: number
          document_id: string
          id?: string
          released_at?: string | null
          request_id?: string | null
          reserved_at?: string
          reserved_by?: string | null
          status: string
          trace_id?: string | null
          workspace_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          credits?: number
          document_id?: string
          id?: string
          released_at?: string | null
          request_id?: string | null
          reserved_at?: string
          reserved_by?: string | null
          status?: string
          trace_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'credit_reservation_document_id_fkey'
            columns: ['document_id']
            isOneToOne: true
            referencedRelation: 'deletion_evidence'
            referencedColumns: ['document_id']
          },
          {
            foreignKeyName: 'credit_reservation_document_id_fkey'
            columns: ['document_id']
            isOneToOne: true
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'credit_reservation_reserved_by_fkey'
            columns: ['reserved_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'credit_reservation_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      deletion_receipt: {
        Row: {
          created_at: string
          document_id: string
          error_code: string | null
          id: string
          recipient_email: string | null
          recipient_user_id: string | null
          sent_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          error_code?: string | null
          id?: string
          recipient_email?: string | null
          recipient_user_id?: string | null
          sent_at: string
          status: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          error_code?: string | null
          id?: string
          recipient_email?: string | null
          recipient_user_id?: string | null
          sent_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'deletion_receipt_document_id_fkey'
            columns: ['document_id']
            isOneToOne: true
            referencedRelation: 'deletion_evidence'
            referencedColumns: ['document_id']
          },
          {
            foreignKeyName: 'deletion_receipt_document_id_fkey'
            columns: ['document_id']
            isOneToOne: true
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deletion_receipt_recipient_user_id_fkey'
            columns: ['recipient_user_id']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deletion_receipt_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      deletion_sweep_run: {
        Row: {
          created_at: string
          deleted_document_count: number
          deleted_statement_count: number
          error_detail: string | null
          expired_document_count: number
          expired_statement_count: number
          finished_at: string | null
          id: string
          receipt_count: number
          receipt_failure_count: number
          s3_absent_count: number
          s3_deleted_count: number
          started_at: string
          status: string
          survivor_count: number
          trigger: string
        }
        Insert: {
          created_at?: string
          deleted_document_count?: number
          deleted_statement_count?: number
          error_detail?: string | null
          expired_document_count?: number
          expired_statement_count?: number
          finished_at?: string | null
          id?: string
          receipt_count?: number
          receipt_failure_count?: number
          s3_absent_count?: number
          s3_deleted_count?: number
          started_at?: string
          status: string
          survivor_count?: number
          trigger: string
        }
        Update: {
          created_at?: string
          deleted_document_count?: number
          deleted_statement_count?: number
          error_detail?: string | null
          expired_document_count?: number
          expired_statement_count?: number
          finished_at?: string | null
          id?: string
          receipt_count?: number
          receipt_failure_count?: number
          s3_absent_count?: number
          s3_deleted_count?: number
          started_at?: string
          status?: string
          survivor_count?: number
          trigger?: string
        }
        Relationships: []
      }
      document: {
        Row: {
          charge_status: string
          content_type: string
          conversion_cost_credits: number
          conversion_started_at: string | null
          converted_at: string | null
          created_at: string
          deleted_at: string | null
          duplicate_checked_at: string | null
          duplicate_fingerprint: Json | null
          duplicate_of_document_id: string | null
          expires_at: string
          extraction_engine: string | null
          extraction_job_id: string | null
          failure_reason: string | null
          file_sha256: string | null
          filename: string
          id: string
          pages: number | null
          s3_bucket: string
          s3_key: string
          size_bytes: number
          status: string
          textract_job_id: string | null
          uploaded_by: string
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          charge_status?: string
          content_type: string
          conversion_cost_credits?: number
          conversion_started_at?: string | null
          converted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          duplicate_checked_at?: string | null
          duplicate_fingerprint?: Json | null
          duplicate_of_document_id?: string | null
          expires_at?: string
          extraction_engine?: string | null
          extraction_job_id?: string | null
          failure_reason?: string | null
          file_sha256?: string | null
          filename: string
          id?: string
          pages?: number | null
          s3_bucket: string
          s3_key: string
          size_bytes: number
          status: string
          textract_job_id?: string | null
          uploaded_by: string
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          charge_status?: string
          content_type?: string
          conversion_cost_credits?: number
          conversion_started_at?: string | null
          converted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          duplicate_checked_at?: string | null
          duplicate_fingerprint?: Json | null
          duplicate_of_document_id?: string | null
          expires_at?: string
          extraction_engine?: string | null
          extraction_job_id?: string | null
          failure_reason?: string | null
          file_sha256?: string | null
          filename?: string
          id?: string
          pages?: number | null
          s3_bucket?: string
          s3_key?: string
          size_bytes?: number
          status?: string
          textract_job_id?: string | null
          uploaded_by?: string
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'document_duplicate_of_document_id_fkey'
            columns: ['duplicate_of_document_id']
            isOneToOne: false
            referencedRelation: 'deletion_evidence'
            referencedColumns: ['document_id']
          },
          {
            foreignKeyName: 'document_duplicate_of_document_id_fkey'
            columns: ['duplicate_of_document_id']
            isOneToOne: false
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
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
      export_artifact: {
        Row: {
          byte_size: number
          checksum_sha256: string | null
          content_type: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_id: string
          expires_at: string | null
          filename: string | null
          format: string
          id: string
          request_id: string | null
          s3_bucket: string | null
          s3_key: string | null
          statement_id: string
          trace_id: string | null
          workspace_id: string
        }
        Insert: {
          byte_size: number
          checksum_sha256?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id: string
          expires_at?: string | null
          filename?: string | null
          format: string
          id?: string
          request_id?: string | null
          s3_bucket?: string | null
          s3_key?: string | null
          statement_id: string
          trace_id?: string | null
          workspace_id: string
        }
        Update: {
          byte_size?: number
          checksum_sha256?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id?: string
          expires_at?: string | null
          filename?: string | null
          format?: string
          id?: string
          request_id?: string | null
          s3_bucket?: string | null
          s3_key?: string | null
          statement_id?: string
          trace_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'export_artifact_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'export_artifact_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'deletion_evidence'
            referencedColumns: ['document_id']
          },
          {
            foreignKeyName: 'export_artifact_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'export_artifact_statement_id_fkey'
            columns: ['statement_id']
            isOneToOne: false
            referencedRelation: 'statement'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'export_artifact_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      extraction_report: {
        Row: {
          category: string
          created_at: string
          document_id: string
          id: string
          note: string | null
          reported_by: string | null
          request_id: string | null
          row_context: Json | null
          statement_id: string | null
          trace_id: string | null
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          document_id: string
          id?: string
          note?: string | null
          reported_by?: string | null
          request_id?: string | null
          row_context?: Json | null
          statement_id?: string | null
          trace_id?: string | null
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          document_id?: string
          id?: string
          note?: string | null
          reported_by?: string | null
          request_id?: string | null
          row_context?: Json | null
          statement_id?: string | null
          trace_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'extraction_report_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'deletion_evidence'
            referencedColumns: ['document_id']
          },
          {
            foreignKeyName: 'extraction_report_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'extraction_report_reported_by_fkey'
            columns: ['reported_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'extraction_report_statement_id_fkey'
            columns: ['statement_id']
            isOneToOne: false
            referencedRelation: 'statement'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'extraction_report_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      ops_admin: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ops_admin_granted_by_fkey'
            columns: ['granted_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ops_admin_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
        ]
      }
      ops_admin_access_review: {
        Row: {
          active_admin_count: number
          active_admins: Json
          admin_count: number
          created_at: string
          evidence_export_id: string | null
          generated_at: string
          id: string
          owner_count: number
          period_end: string
          period_start: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active_admin_count?: number
          active_admins: Json
          admin_count?: number
          created_at?: string
          evidence_export_id?: string | null
          generated_at: string
          id?: string
          owner_count?: number
          period_end: string
          period_start: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active_admin_count?: number
          active_admins?: Json
          admin_count?: number
          created_at?: string
          evidence_export_id?: string | null
          generated_at?: string
          id?: string
          owner_count?: number
          period_end?: string
          period_start?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ops_admin_access_review_evidence_export_id_fkey'
            columns: ['evidence_export_id']
            isOneToOne: false
            referencedRelation: 'soc2_evidence_export'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ops_admin_access_review_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
        ]
      }
      ops_collection_run: {
        Row: {
          error_detail: string | null
          finished_at: string | null
          id: string
          metrics_count: number
          provider_id: string | null
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          metrics_count?: number
          provider_id?: string | null
          started_at?: string
          status: string
          trigger: string
        }
        Update: {
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          metrics_count?: number
          provider_id?: string | null
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ops_collection_run_provider_id_fkey'
            columns: ['provider_id']
            isOneToOne: false
            referencedRelation: 'ops_provider'
            referencedColumns: ['id']
          },
        ]
      }
      ops_metric_config: {
        Row: {
          created_at: string
          critical_threshold: number
          display_name: string
          id: string
          manual_limit: number | null
          metric_key: string
          provider_id: string
          required: boolean
          sort_order: number
          unit: string
          updated_at: string
          warning_threshold: number
        }
        Insert: {
          created_at?: string
          critical_threshold?: number
          display_name: string
          id?: string
          manual_limit?: number | null
          metric_key: string
          provider_id: string
          required?: boolean
          sort_order?: number
          unit: string
          updated_at?: string
          warning_threshold?: number
        }
        Update: {
          created_at?: string
          critical_threshold?: number
          display_name?: string
          id?: string
          manual_limit?: number | null
          metric_key?: string
          provider_id?: string
          required?: boolean
          sort_order?: number
          unit?: string
          updated_at?: string
          warning_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: 'ops_metric_config_provider_id_fkey'
            columns: ['provider_id']
            isOneToOne: false
            referencedRelation: 'ops_provider'
            referencedColumns: ['id']
          },
        ]
      }
      ops_provider: {
        Row: {
          billing_url: string | null
          category: string
          console_url: string
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          management_url: string | null
          updated_at: string
        }
        Insert: {
          billing_url?: string | null
          category: string
          console_url: string
          created_at?: string
          display_name: string
          enabled?: boolean
          id: string
          management_url?: string | null
          updated_at?: string
        }
        Update: {
          billing_url?: string | null
          category?: string
          console_url?: string
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          management_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ops_usage_snapshot: {
        Row: {
          collected_at: string
          display_name: string
          error_code: string | null
          error_detail: string | null
          freshness: string
          id: string
          limit_value: number | null
          metric_key: string
          period_end: string | null
          period_start: string | null
          provider_id: string
          raw_ref: Json | null
          source_url: string | null
          status: string
          unit: string
          used: number | null
        }
        Insert: {
          collected_at?: string
          display_name: string
          error_code?: string | null
          error_detail?: string | null
          freshness: string
          id?: string
          limit_value?: number | null
          metric_key: string
          period_end?: string | null
          period_start?: string | null
          provider_id: string
          raw_ref?: Json | null
          source_url?: string | null
          status: string
          unit: string
          used?: number | null
        }
        Update: {
          collected_at?: string
          display_name?: string
          error_code?: string | null
          error_detail?: string | null
          freshness?: string
          id?: string
          limit_value?: number | null
          metric_key?: string
          period_end?: string | null
          period_start?: string | null
          provider_id?: string
          raw_ref?: Json | null
          source_url?: string | null
          status?: string
          unit?: string
          used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'ops_usage_snapshot_provider_id_fkey'
            columns: ['provider_id']
            isOneToOne: false
            referencedRelation: 'ops_provider'
            referencedColumns: ['id']
          },
        ]
      }
      privacy_request: {
        Row: {
          actor_ip: unknown
          actor_user_agent: string | null
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          metadata: Json | null
          rejected_reason: string | null
          request_type: string
          requested_by: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actor_ip?: unknown
          actor_user_agent?: string | null
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          metadata?: Json | null
          rejected_reason?: string | null
          request_type: string
          requested_by: string
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actor_ip?: unknown
          actor_user_agent?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          metadata?: Json | null
          rejected_reason?: string | null
          request_type?: string
          requested_by?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'privacy_request_requested_by_fkey'
            columns: ['requested_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'privacy_request_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      soc2_evidence_export: {
        Row: {
          active_ops_admin_count: number
          created_at: string
          evidence_pack: Json
          export_type: string
          generated_at: string
          id: string
          period_end: string
          period_start: string
          provider_quota_red_count: number
          review_item_count: number
          status: string
        }
        Insert: {
          active_ops_admin_count?: number
          created_at?: string
          evidence_pack: Json
          export_type: string
          generated_at?: string
          id?: string
          period_end: string
          period_start: string
          provider_quota_red_count?: number
          review_item_count?: number
          status: string
        }
        Update: {
          active_ops_admin_count?: number
          created_at?: string
          evidence_pack?: Json
          export_type?: string
          generated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          provider_quota_red_count?: number
          review_item_count?: number
          status?: string
        }
        Relationships: []
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
          edited_at: string | null
          edited_by: string | null
          expires_at: string
          id: string
          opening_balance: number | null
          period_end: string | null
          period_start: string | null
          reconciles: boolean | null
          reported_total: number | null
          review_status: string
          revision: number
          statement_metadata: Json
          statement_type: string
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
          edited_at?: string | null
          edited_by?: string | null
          expires_at?: string
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          reconciles?: boolean | null
          reported_total?: number | null
          review_status?: string
          revision?: number
          statement_metadata?: Json
          statement_type?: string
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
          edited_at?: string | null
          edited_by?: string | null
          expires_at?: string
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          reconciles?: boolean | null
          reported_total?: number | null
          review_status?: string
          revision?: number
          statement_metadata?: Json
          statement_type?: string
          transactions?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'statement_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'deletion_evidence'
            referencedColumns: ['document_id']
          },
          {
            foreignKeyName: 'statement_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'document'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'statement_edited_by_fkey'
            columns: ['edited_by']
            isOneToOne: false
            referencedRelation: 'user_profile'
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
      stripe_webhook_event: {
        Row: {
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          livemode: boolean
          processed_at: string | null
          status: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          event_type: string
          id?: string
          livemode: boolean
          processed_at?: string | null
          status?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          event_type?: string
          id?: string
          livemode?: boolean
          processed_at?: string | null
          status?: string
          stripe_event_id?: string
        }
        Relationships: []
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
      deletion_evidence: {
        Row: {
          deleted_at: string | null
          deletion_audited_at: string | null
          document_id: string | null
          document_status: string | null
          expires_at: string | null
          filename: string | null
          receipt_error_code: string | null
          receipt_sent_at: string | null
          receipt_status: string | null
          s3_bucket: string | null
          s3_key: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'document_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspace'
            referencedColumns: ['id']
          },
        ]
      }
      deletion_health: {
        Row: {
          expired_survivors: number | null
          last_sweep_at: string | null
          last_sweep_status: string | null
          receipt_failures: number | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      attest_ops_admin_access_review: {
        Args: {
          p_actor_ip?: unknown
          p_actor_user_agent?: string
          p_request_id: string
          p_review_id: string
          p_review_note: string
          p_reviewer_user_id: string
          p_status: string
          p_trace_id: string
        }
        Returns: {
          review_id: string
          reviewed_at: string
          status: string
        }[]
      }
      consume_document_conversion_credit: {
        Args: { p_consumed_at: string; p_document_id: string }
        Returns: {
          charge_status: string
        }[]
      }
      create_pending_document_upload: {
        Args: {
          p_actor_ip?: unknown
          p_actor_user_agent?: string
          p_content_type: string
          p_conversion_cost_credits?: number
          p_expires_at: string
          p_file_sha256?: string
          p_filename: string
          p_request_id: string
          p_s3_bucket: string
          p_s3_key: string
          p_size_bytes: number
          p_trace_id: string
        }
        Returns: {
          document_id: string
          s3_key: string
        }[]
      }
      create_pending_document_upload_for_actor: {
        Args: {
          p_actor_ip?: unknown
          p_actor_user_agent?: string
          p_actor_user_id: string
          p_content_type: string
          p_conversion_cost_credits?: number
          p_expires_at: string
          p_file_sha256?: string
          p_filename: string
          p_request_id: string
          p_s3_bucket: string
          p_s3_key: string
          p_size_bytes: number
          p_trace_id: string
        }
        Returns: {
          document_id: string
          s3_key: string
        }[]
      }
      create_privacy_request: {
        Args: {
          p_actor_ip?: unknown
          p_actor_user_agent?: string
          p_audit_event_type: string
          p_due_at: string
          p_request_id: string
          p_request_type: string
          p_trace_id: string
        }
        Returns: {
          due_at: string
          privacy_request_id: string
          request_type: string
          status: string
        }[]
      }
      create_privacy_request_for_actor: {
        Args: {
          p_actor_ip?: unknown
          p_actor_user_agent?: string
          p_actor_user_id: string
          p_audit_event_type: string
          p_due_at: string
          p_request_id: string
          p_request_type: string
          p_trace_id: string
        }
        Returns: {
          due_at: string
          privacy_request_id: string
          request_type: string
          status: string
        }[]
      }
      create_soc2_evidence_export: {
        Args: {
          p_active_admin_count: number
          p_active_admins: Json
          p_admin_count: number
          p_evidence_pack: Json
          p_generated_at: string
          p_owner_count: number
          p_period_end: string
          p_period_start: string
          p_provider_quota_red_count: number
          p_review_item_count: number
          p_status: string
          p_trigger: string
        }
        Returns: {
          access_review_id: string
          export_id: string
        }[]
      }
      get_soc2_audit_event_counts: {
        Args: { p_period_end: string; p_period_start: string }
        Returns: {
          event_count: number
          event_type: string
        }[]
      }
      open_ops_admin_access_review: {
        Args: {
          p_active_admin_count: number
          p_active_admins: Json
          p_admin_count: number
          p_evidence_export_id: string
          p_generated_at: string
          p_owner_count: number
          p_period_end: string
          p_period_start: string
          p_trigger: string
        }
        Returns: string
      }
      release_document_conversion_credit: {
        Args: { p_document_id: string; p_released_at: string }
        Returns: {
          charge_status: string
        }[]
      }
      reserve_document_conversion_credit: {
        Args: {
          p_actor_ip?: unknown
          p_actor_user_agent?: string
          p_actor_user_id: string
          p_cost_credits: number
          p_document_id: string
          p_request_id: string
          p_trace_id: string
        }
        Returns: {
          charge_status: string
        }[]
      }
      scrub_deleted_document: {
        Args: { p_deleted_at: string; p_document_id: string }
        Returns: undefined
      }
      update_statement_edit_if_current: {
        Args: {
          p_account_last4: string | null
          p_bank_name: string | null
          p_closing_balance: number | null
          p_computed_total: number | null
          p_document_id: string
          p_edited_at: string
          p_edited_by: string
          p_expected_revision: number
          p_opening_balance: number | null
          p_period_end: string | null
          p_period_start: string | null
          p_reconciles: boolean | null
          p_reported_total: number | null
          p_review_status: string
          p_revision: number
          p_statement_metadata: Json | null
          p_statement_id: string
          p_statement_type: string
          p_transactions: Json
          p_workspace_id: string
        }
        Returns: {
          updated: boolean
        }[]
      }
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
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
