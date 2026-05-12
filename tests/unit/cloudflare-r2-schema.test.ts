import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = () => {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_cloudflare_r2_extraction_path.sql'),
  )

  if (!migrationName) throw new Error('Missing Cloudflare R2 extraction migration')
  return readFileSync(join(migrationsDir, migrationName), 'utf8').toLowerCase()
}

describe('Cloudflare R2 extraction schema migration', () => {
  const sql = () => migrationSql()

  it('adds provider-neutral document storage fields while backfilling existing S3 rows', () => {
    const migration = sql()

    expect(migration).toContain('storage_provider text')
    expect(migration).toContain('storage_bucket text')
    expect(migration).toContain('storage_key text')
    expect(migration).toContain("storage_provider = 's3'")
    expect(migration).toContain('storage_bucket = s3_bucket')
    expect(migration).toContain('storage_key = s3_key')
    expect(migration).toContain("storage_provider in ('s3', 'r2')")
  })

  it('allows the Cloudflare extraction engine and makes provider job ids unique', () => {
    const migration = sql()

    expect(migration).toContain("'cloudflare-r2'")
    expect(migration).toContain('document_extraction_job_unique_idx')
    expect(migration).toContain('unique')
    expect(migration).toContain('extraction_engine, extraction_job_id')
  })

  it('adds statement extraction ordinals for idempotent finalization', () => {
    const migration = sql()

    expect(migration).toContain('add column if not exists extraction_ordinal int')
    expect(migration).toContain('alter column extraction_ordinal set default 0')
    expect(migration).toContain('alter column extraction_ordinal set not null')
    expect(migration).toContain('statement_document_extraction_ordinal_key')
    expect(migration).toContain('unique(document_id, extraction_ordinal)')
  })

  it('passes neutral storage arguments through the audited upload RPC', () => {
    const migration = sql()

    expect(migration).toContain('p_storage_provider text default')
    expect(migration).toContain('p_storage_bucket text default null')
    expect(migration).toContain('p_storage_key text default null')
    expect(migration).toContain('storage_provider,')
    expect(migration).toContain('storage_bucket,')
    expect(migration).toContain('storage_key,')
  })

  it('removes direct authenticated document updates for service-owned lifecycle columns', () => {
    const migration = sql()

    expect(migration).toContain('revoke update on public.document from authenticated')
    expect(migration).toContain('revoke update on public.document from anon')
  })
})
