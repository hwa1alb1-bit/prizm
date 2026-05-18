import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260518120000_harden_main_scan_findings.sql',
)
const statementEditRpcGrantMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260518162000_revoke_statement_edit_rpc_client_execute.sql',
)

describe('main branch security hardening migration', () => {
  const sql = () => readFileSync(migrationPath, 'utf8').toLowerCase()

  it('keeps upload writes and upload RPC execution service-role only', () => {
    const migration = sql()

    expect(migration).toContain('revoke insert on public.document from public')
    expect(migration).toContain('revoke insert on public.document from anon')
    expect(migration).toContain('revoke insert on public.document from authenticated')
    expect(migration).toContain(
      'revoke all on function public.create_pending_document_upload_for_actor',
    )
    expect(migration).toContain('from public')
    expect(migration).toContain(
      'grant execute on function public.create_pending_document_upload_for_actor',
    )
    expect(migration).toContain('to service_role')
  })

  it('prevents active original duplicate hashes from racing into separate rows', () => {
    const migration = sql()

    expect(migration).toContain('document_workspace_active_original_hash_uidx')
    expect(migration).toContain('create unique index')
    expect(migration).toContain('duplicate_of_document_id is null')
  })

  it('keeps expired documents and completed access reviews out of privileged lifecycle RPCs', () => {
    const migration = sql()

    expect(migration).toContain('d.expires_at > now()')
    expect(migration).toContain('create or replace function public.attest_ops_admin_access_review')
    expect(migration).toContain("and ar.status = 'pending'")
  })

  it('keeps the statement edit RPC service-role only after signature extensions', () => {
    const migration = readFileSync(statementEditRpcGrantMigrationPath, 'utf8').toLowerCase()

    expect(migration).toContain('revoke all on function public.update_statement_edit_if_current')
    expect(migration).toContain('from public')
    expect(migration).toContain(
      'revoke execute on function public.update_statement_edit_if_current',
    )
    expect(migration).toContain('from anon')
    expect(migration).toContain('from authenticated')
    expect(migration).toContain('grant execute on function public.update_statement_edit_if_current')
    expect(migration).toContain('to service_role')
  })
})
