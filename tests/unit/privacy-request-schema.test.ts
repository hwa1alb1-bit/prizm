import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '0014_create_privacy_request_tables.sql',
)

describe('privacy request schema', () => {
  it('creates an auditable workflow table for SAR export and account deletion requests', () => {
    expect(existsSync(migrationPath)).toBe(true)

    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('create table privacy_request')
    expect(sql).toContain(
      "request_type text not null check (request_type in ('data_export','account_deletion'))",
    )
    expect(sql).toContain(
      "status text not null check (status in ('received','processing','completed','rejected'))",
    )
    expect(sql).toContain('workspace_id uuid not null references workspace(id)')
    expect(sql).toContain('requested_by uuid not null references user_profile(id)')
    expect(sql).toContain('due_at timestamptz not null')
    expect(sql).toContain('alter table privacy_request enable row level security')
    expect(sql).toContain('create or replace function public.create_privacy_request')
    expect(sql).toContain('insert into public.audit_event')
    expect(sql).toContain('privacy_request')
  })
})
