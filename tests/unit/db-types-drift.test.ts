import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('Supabase generated database types', () => {
  it('cover schema objects introduced by the current migration set', () => {
    const dbTypes = readFileSync(join(repoRoot, 'lib', 'shared', 'db-types.ts'), 'utf8')

    for (const schemaName of [
      'credit_reservation',
      'export_artifact',
      'extraction_report',
      'deletion_sweep_run',
      'deletion_receipt',
      'stripe_webhook_event',
      'privacy_request',
      'soc2_evidence_export',
      'ops_admin_access_review',
      'deletion_evidence',
      'deletion_health',
      'create_pending_document_upload_for_actor',
      'create_privacy_request_for_actor',
      'create_soc2_evidence_export',
      'attest_ops_admin_access_review',
    ]) {
      expect(dbTypes).toContain(schemaName)
    }
  })

  it('matches the latest editable statement RPC contract from checked-in migrations', () => {
    const dbTypes = readFileSync(join(repoRoot, 'lib', 'shared', 'db-types.ts'), 'utf8')

    for (const argument of [
      'p_statement_type',
      'p_statement_metadata',
      'p_bank_name',
      'p_account_last4',
      'p_period_start',
      'p_period_end',
      'p_opening_balance',
      'p_closing_balance',
      'p_reported_total',
      'p_computed_total',
      'p_reconciles',
    ]) {
      expect(dbTypes).toContain(argument)
    }
  })
})
