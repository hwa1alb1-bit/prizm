import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '0009_phase1_lean_converter.sql',
)

describe('Phase 1 lean converter schema migration', () => {
  const sql = () => readFileSync(migrationPath, 'utf8')

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

  it('updates audited RPCs and deletion scrubbing for sensitive hashes and transactions', () => {
    const migration = sql()

    expect(migration).toContain('create or replace function public.create_pending_document_upload')
    expect(migration).toContain('p_file_sha256')
    expect(migration).toContain('p_conversion_cost_credits')
    expect(migration).toContain('create or replace function public.scrub_deleted_document')
    expect(migration).toContain('transactions = ')
    expect(migration).toContain('file_sha256 = null')
  })
})
