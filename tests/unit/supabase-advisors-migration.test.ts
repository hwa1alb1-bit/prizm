import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = () => {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
  const migrationNames = readdirSync(migrationsDir).filter(
    (name) =>
      name.endsWith('_remediate_supabase_advisors.sql') ||
      name.endsWith('_close_supabase_advisor_gaps.sql'),
  )

  if (migrationNames.length < 2) throw new Error('Missing Supabase advisor remediation migrations')

  return migrationNames
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), 'utf8'))
    .join('\n')
}

describe('Supabase advisor remediation migration', () => {
  const sql = () => migrationSql().toLowerCase()

  it('moves user-initiated security definer writes behind service role RPCs', () => {
    const migration = sql()

    expect(migration).toContain(
      'create or replace function public.create_pending_document_upload_for_actor',
    )
    expect(migration).toContain('p_actor_user_id uuid')
    expect(migration).toContain(
      'create or replace function public.create_privacy_request_for_actor',
    )
    expect(migration).toContain(
      'grant execute on function public.create_pending_document_upload_for_actor',
    )
    expect(migration).toContain('grant execute on function public.create_privacy_request_for_actor')
    expect(migration).toContain('to service_role')
  })

  it('explicitly revokes exposed security definer RPC execution from client roles', () => {
    const migration = sql()

    for (const role of ['anon', 'authenticated']) {
      expect(migration).toContain(`from ${role}`)
    }

    for (const functionName of [
      'create_pending_document_upload',
      'reserve_document_conversion_credit',
      'consume_document_conversion_credit',
      'release_document_conversion_credit',
      'scrub_deleted_document',
      'update_statement_edit_if_current',
      'create_privacy_request',
    ]) {
      expect(migration).toContain(`function public.${functionName}`)
    }
  })

  it('hardens deletion views and service-only operational tables', () => {
    const migration = sql()

    expect(migration).toContain(
      'create or replace view public.deletion_evidence with (security_invoker = true)',
    )
    expect(migration).toContain(
      'create or replace view public.deletion_health with (security_invoker = true)',
    )
    expect(migration).toContain('audit_event_no_client_access')
    expect(migration).toContain('ops_provider_no_client_access')
    expect(migration).toContain('soc2_evidence_export_no_client_access')
  })

  it('adds missing foreign-key indexes and fixes the ops admin auth initplan', () => {
    const migration = sql()

    for (const indexName of [
      'credit_reservation_reserved_by_idx',
      'deletion_receipt_recipient_user_id_idx',
      'export_artifact_created_by_idx',
      'export_artifact_statement_id_idx',
      'extraction_report_reported_by_idx',
      'extraction_report_statement_id_idx',
      'extraction_report_workspace_id_idx',
      'ops_admin_granted_by_idx',
      'ops_admin_access_review_evidence_export_id_idx',
      'ops_admin_access_review_reviewed_by_idx',
      'privacy_request_requested_by_idx',
      'statement_edited_by_idx',
    ]) {
      expect(migration).toContain(`create index if not exists ${indexName}`)
    }

    expect(migration).toContain('user_id = (select auth.uid())')
    expect(migration).toContain('where id = (select auth.uid())')
  })
})
