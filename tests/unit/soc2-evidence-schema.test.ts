import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SOC 2 evidence schema', () => {
  it('creates a server-write export table with monthly uniqueness and RLS', () => {
    const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
    const sql = readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => readFileSync(join(migrationsDir, name), 'utf8'))
      .join('\n')

    expect(sql).toContain('create table soc2_evidence_export')
    expect(sql).toContain('unique (export_type, period_start, period_end)')
    expect(sql).toContain('alter table soc2_evidence_export enable row level security')
    expect(sql).toContain('soc2_evidence_export_generated_idx')
    expect(sql).toContain('create table ops_admin_access_review')
    expect(sql).toContain('unique (period_start, period_end)')
    expect(sql).toContain('alter table ops_admin_access_review enable row level security')
    expect(sql).toContain('create function public.create_soc2_evidence_export')
    expect(sql).toContain('create function public.get_soc2_audit_event_counts')
    expect(sql).toContain("'soc2.evidence_export_generated'")
    expect(sql).toContain("'ops_admin.access_review_opened'")
    expect(sql).toContain('create function public.attest_ops_admin_access_review')
    expect(sql).toContain("'ops_admin.access_review_attested'")
    expect(sql).toContain('v_review_completed boolean := false')
    expect(sql).toContain('for update')
    expect(sql).toContain('then soc2_evidence_export.evidence_pack else excluded.evidence_pack end')
    expect(sql).toContain("'evidence_preserved', v_review_completed")
    expect(sql).toContain("case when ops_admin_access_review.status = 'pending'")
    expect(sql).toContain(
      'then excluded.active_admins else ops_admin_access_review.active_admins end',
    )
    expect(sql).toContain('reviewed_by = ops_admin_access_review.reviewed_by')
    expect(sql).toContain('reviewed_at = ops_admin_access_review.reviewed_at')
    expect(sql).toContain('review_note = ops_admin_access_review.review_note')
    expect(sql).toContain('grant execute on function public.create_soc2_evidence_export')
    expect(sql).toContain('grant execute on function public.attest_ops_admin_access_review')
    expect(sql).toContain('grant execute on function public.get_soc2_audit_event_counts')
    expect(sql).toContain('to service_role')
  })
})
