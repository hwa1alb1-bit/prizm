import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

const runbooks = [
  'incident-response.md',
  'provider-outage.md',
  'provider-quota-exhaustion.md',
  'deletion-failure.md',
  'billing-stripe-webhook-replay.md',
  'aws-textract-degradation.md',
]

const complianceDocs = [
  'vendors.md',
  'subprocessors.md',
  'sar-workflow.md',
  'account-deletion-workflow.md',
  'evidence-index.md',
  'soc2-evidence-queries.sql',
]

describe('compliance docs and runbooks', () => {
  it('publishes required operational runbooks with owner, severity, detection, response, and verification sections', () => {
    for (const filename of runbooks) {
      const file = path.join(repoRoot, 'docs', 'runbooks', filename)
      expect(existsSync(file), `${filename} should exist`).toBe(true)
      const body = readFileSync(file, 'utf8')
      for (const heading of ['Owner', 'Severity', 'Detection', 'Response', 'Verification']) {
        expect(body, `${filename} should include ${heading}`).toContain(`## ${heading}`)
      }
    }
  })

  it('publishes compliance inventory, workflow, and SOC 2 evidence artifacts', () => {
    for (const filename of complianceDocs) {
      const file = path.join(repoRoot, 'docs', 'compliance', filename)
      expect(existsSync(file), `${filename} should exist`).toBe(true)
    }

    const evidenceSql = readFileSync(
      path.join(repoRoot, 'docs', 'compliance', 'soc2-evidence-queries.sql'),
      'utf8',
    )
    for (const table of [
      'audit_event',
      'deletion_evidence',
      'deletion_health',
      'ops_usage_snapshot',
      'ops_collection_run',
      'ops_admin',
      'privacy_request',
    ]) {
      expect(evidenceSql).toContain(table)
    }
    expect(evidenceSql).toContain("ae.target_type = 'privacy_request'")
    expect(evidenceSql).toContain('ae.target_id = pr.id')
  })

  it('keeps deletion and subprocessor compliance docs aligned with public commitments', () => {
    const deletionWorkflow = readFileSync(
      path.join(repoRoot, 'docs', 'compliance', 'account-deletion-workflow.md'),
      'utf8',
    )
    expect(deletionWorkflow).toContain('10-day due date')
    expect(deletionWorkflow).not.toContain('30-day due date')

    const subprocessorDocs = [
      readFileSync(path.join(repoRoot, 'docs', 'compliance', 'subprocessors.md'), 'utf8'),
      readFileSync(path.join(repoRoot, 'docs', 'compliance', 'vendors.md'), 'utf8'),
    ].join('\n')

    for (const vendor of [
      'Supabase',
      'AWS',
      'Stripe',
      'Vercel',
      'Resend',
      'Sentry',
      'Upstash',
      'Cloudflare',
    ]) {
      expect(subprocessorDocs).toContain(vendor)
    }
    expect(subprocessorDocs).toContain('DPA')
    expect(subprocessorDocs).toContain('https://')
  })
})
