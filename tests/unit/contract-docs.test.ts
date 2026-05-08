import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readDoc(...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), 'utf8')
}

describe('contract and launch docs', () => {
  it('does not publish stale Stripe account or overage-meter launch state', () => {
    const launchDocs = [
      readDoc('README.md'),
      readDoc('docs', 'specs', 'wave-0-provisioning-step-by-step.md'),
    ].join('\n')

    expect(launchDocs).not.toContain('acct_1TRZFv44hvL1QSxT')
    expect(launchDocs).toContain('acct_1TRZG9KKeaydfVMo')
    expect(launchDocs).not.toContain('Overage meter pending')
    expect(launchDocs).not.toContain('Overage product has no price')
    expect(launchDocs).toContain('STRIPE_METER_OVERAGE')
    expect(launchDocs).toContain('STRIPE_PRICE_OVERAGE_PAGE')
  })

  it('keeps rehearsal docs aligned with implemented Phase 3 and billing routes', () => {
    const rehearsal = readDoc('docs', 'runbooks', 'staging-rehearsal.md')

    expect(rehearsal).not.toContain('blocked until the Phase 3 conversion pipeline routes exist')
    expect(rehearsal).not.toContain('blocked until Phase 5 billing implementation is complete')
    for (const route of [
      '/api/v1/documents/{documentId}/complete',
      '/api/v1/documents/{documentId}/convert',
      '/api/v1/documents/{documentId}/status',
      '/api/v1/documents/{documentId}/exports',
      '/api/v1/exports/{exportId}/download',
      '/api/v1/billing/checkout',
      '/api/v1/billing/portal',
    ]) {
      expect(rehearsal).toContain(route)
    }
  })

  it('documents protected deep health and the implemented OpenAPI contract', () => {
    const docs = [
      readDoc('README.md'),
      readDoc('docs', 'adr', '005-api-versioning.md'),
      readDoc('docs', 'adr', '007-rate-limiting.md'),
    ].join('\n')

    expect(docs).toContain('/api/v1/openapi.json')
    expect(docs).toContain('/api/ops/health')
    expect(docs).not.toContain('/api/health?deep=true')
    expect(docs).toContain('fixed-window')
    expect(docs).toContain('RateLimit-Limit')
    expect(docs).toContain('X-RateLimit-Limit')
  })
})
