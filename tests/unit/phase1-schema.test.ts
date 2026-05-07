import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const phase1MigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '0009_phase1_lean_converter.sql',
)
const lifecycleMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '0010_harden_conversion_lifecycle.sql',
)
const statementMetadataMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '0011_add_statement_type_metadata.sql',
)
const exportArtifactMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '0012_export_artifact_download_contract.sql',
)

describe('Phase 1 lean converter schema migration', () => {
  const sql = () => readFileSync(phase1MigrationPath, 'utf8')
  const lifecycleSql = () => `${sql()}\n${readFileSync(lifecycleMigrationPath, 'utf8')}`
  const statementMetadataSql = () => readFileSync(statementMetadataMigrationPath, 'utf8')
  const exportArtifactSql = () => readFileSync(exportArtifactMigrationPath, 'utf8')

  it('adds the single-PDF conversion state, duplicate, and charge fields', () => {
    const migration = sql()

    expect(migration).toContain(
      "status in ('pending','verified','processing','ready','failed','expired')",
    )
    expect(migration).toContain('file_sha256')
    expect(migration).toContain('duplicate_of_document_id')
    expect(migration).toContain('conversion_cost_credits')
    expect(migration).toContain('charge_status')
    expect(migration).toContain('converted_at')
  })

  it('adds review/edit state to statements', () => {
    const migration = sql()

    expect(migration).toContain('add column if not exists revision int')
    expect(migration).toContain('review_status')
    expect(migration).toContain('edited_at')
    expect(migration).toContain('edited_by')
  })

  it('creates reservation, export artifact, and extraction report tables', () => {
    const migration = sql()

    expect(migration).toContain('create table credit_reservation')
    expect(migration).toContain('create table export_artifact')
    expect(migration).toContain('create table extraction_report')
  })

  it('defines the credit reservation lifecycle RPCs used by conversion processing', () => {
    const migration = lifecycleSql()

    expect(migration).toContain(
      'create or replace function public.reserve_document_conversion_credit',
    )
    expect(migration).toContain(
      'create or replace function public.consume_document_conversion_credit',
    )
    expect(migration).toContain(
      'create or replace function public.release_document_conversion_credit',
    )
    expect(migration).toContain('reason')
    expect(migration).toContain('document_id')
    expect(migration).toContain('balance_after')
  })

  it('serializes workspace credit transitions and grants lifecycle RPCs only to the server role', () => {
    const migration = lifecycleSql()

    expect(migration).toContain('from public.workspace w')
    expect(migration).toContain('for update;')
    expect(migration).toContain('revoke all on function public.reserve_document_conversion_credit')
    expect(migration).toContain(
      'grant execute on function public.reserve_document_conversion_credit',
    )
    expect(migration).toContain(
      'grant execute on function public.consume_document_conversion_credit',
    )
    expect(migration).toContain(
      'grant execute on function public.release_document_conversion_credit',
    )
    expect(migration).toContain('to service_role')
  })

  it('adds an atomic statement edit RPC that fences document and statement lifecycle state', () => {
    const migration = lifecycleSql()

    expect(migration).toContain(
      'create or replace function public.update_statement_edit_if_current',
    )
    expect(migration).toContain("d.status = 'ready'")
    expect(migration).toContain('d.deleted_at is null')
    expect(migration).toContain('s.deleted_at is null')
    expect(migration).toContain('s.revision = p_expected_revision')
  })

  it('retires the pre-quote upload RPC overload', () => {
    const migration = lifecycleSql()

    expect(migration).toContain('drop function if exists public.create_pending_document_upload')
    expect(migration).toContain('p_file_sha256 text')
    expect(migration).toContain('p_conversion_cost_credits int')
  })

  it('updates audited RPCs and deletion scrubbing for sensitive hashes and transactions', () => {
    const migration = sql()

    expect(migration).toContain('create or replace function public.create_pending_document_upload')
    expect(migration).toContain('p_file_sha256')
    expect(migration).toContain('p_conversion_cost_credits')
    expect(migration).toContain('create or replace function public.scrub_deleted_document')
    expect(migration).toContain('transactions = ')
    expect(migration).toContain('file_sha256 = null')
  })

  it('adds statement type and metadata defaults for persisted statement history', () => {
    const migration = statementMetadataSql()

    expect(migration).toContain('alter table statement')
    expect(migration).toContain("statement_type text not null default 'bank'")
    expect(migration).toContain("statement_metadata jsonb not null default '{}'::jsonb")
    expect(migration).toContain('statement_type in (')
    expect(migration).toContain("'bank'")
    expect(migration).toContain("'credit_card'")
  })

  it('adds object storage and retention fields to export artifacts', () => {
    const migration = exportArtifactSql()

    expect(migration).toContain('alter table export_artifact')
    expect(migration).toContain('filename text')
    expect(migration).toContain('s3_bucket text')
    expect(migration).toContain('s3_key text')
    expect(migration).toContain('content_type text')
    expect(migration).toContain('expires_at timestamptz')
    expect(migration).toContain('deleted_at timestamptz')
    expect(migration).toContain('export_artifact_workspace_active_idx')
  })
})
