import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = () => {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_fix_user_profile_rls_recursion.sql'),
  )

  if (!migrationName) {
    throw new Error('Missing fix_user_profile_rls_recursion migration')
  }

  return join(migrationsDir, migrationName)
}

const createPolicyBlocks = (sql: string) =>
  sql.match(/create policy[\s\S]*?;/gi)?.map((block) => block.toLowerCase()) ?? []

describe('user_profile RLS recursion migration', () => {
  const sql = () => readFileSync(migrationPath(), 'utf8')

  it('moves workspace membership lookups behind private security definer helpers', () => {
    const migration = sql().toLowerCase()

    expect(migration).toContain('create schema if not exists private')
    expect(migration).toContain('create or replace function private.current_user_workspace_id()')
    expect(migration).toContain('create or replace function private.current_user_role()')
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('from public.user_profile')
    expect(migration).toContain('grant usage on schema private to authenticated, service_role')
    expect(migration).toContain(
      'grant execute on function private.current_user_workspace_id() to authenticated, service_role',
    )
    expect(migration).toContain('to authenticated using')
  })

  it('replaces recursive user_profile policy subqueries with helper calls', () => {
    const policyBlocks = createPolicyBlocks(sql())

    expect(policyBlocks).not.toEqual([])
    expect(policyBlocks).toEqual(
      expect.not.arrayContaining([expect.stringMatching(/from\s+(public\.)?user_profile/)]),
    )
    expect(policyBlocks.join('\n')).toContain(
      'workspace_id = (select private.current_user_workspace_id())',
    )
    expect(policyBlocks.join('\n')).toContain(
      "(select private.current_user_role()) in ('owner', 'admin')",
    )
  })

  it('rewrites every policy that previously depended on user_profile membership', () => {
    const migration = sql()

    for (const policyName of [
      'workspace_member_select',
      'workspace_owner_modify',
      'user_profile_workspace_select',
      'user_profile_self_update',
      'api_key_workspace_all',
      'document_workspace_select',
      'document_workspace_insert',
      'document_workspace_update',
      'document_workspace_delete',
      'statement_workspace_select',
      'statement_workspace_insert',
      'statement_workspace_update',
      'statement_workspace_delete',
      'subscription_workspace_select',
      'credit_ledger_workspace_select',
      'credit_reservation_workspace_select',
      'export_artifact_workspace_select',
      'extraction_report_workspace_select',
      'privacy_request_workspace_owner_select',
    ]) {
      expect(migration).toContain(`drop policy if exists "${policyName}"`)
      expect(migration).toContain(`create policy "${policyName}"`)
    }
  })
})
