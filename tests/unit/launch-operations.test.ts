import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')

describe('launch operations controls', () => {
  it('runs launch gates in CI for staging and production contexts', () => {
    const requiredLaunchEnvKeys = [
      'NEXT_PUBLIC_SITE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_PROJECT_ID',
      'AWS_REGION',
      'AWS_ROLE_ARN',
      'S3_UPLOAD_BUCKET',
      'S3_KMS_KEY_ID',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_PRICE_STARTER_MONTHLY',
      'STRIPE_PRICE_STARTER_ANNUAL',
      'STRIPE_PRICE_PRO_MONTHLY',
      'STRIPE_PRICE_PRO_ANNUAL',
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'NEXT_PUBLIC_SENTRY_DSN',
      'SENTRY_AUTH_TOKEN',
      'SENTRY_ORG',
      'SENTRY_PROJECT',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'CRON_SECRET',
    ]

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('launch_target:')
    expect(workflow).toContain("inputs.launch_target == 'staging'")
    expect(workflow).toContain("inputs.launch_target == 'production'")
    expect(workflow).toContain('staging-launch-gate:')
    expect(workflow).toContain('production-launch-gate:')
    expect(workflow).toContain('environment: staging')
    expect(workflow).toContain('environment: production')
    expect(workflow).toContain('LAUNCH_GATE_TARGET: staging')
    expect(workflow).toContain('LAUNCH_GATE_TARGET: production')
    expect(workflow.match(/pnpm check:launch-gates/g)).toHaveLength(2)

    for (const key of requiredLaunchEnvKeys) {
      expect(workflow).toContain(`${key}:`)
    }

    expect(workflow).not.toContain('AWS_ACCESS_KEY_ID:')
    expect(workflow).not.toContain('AWS_SECRET_ACCESS_KEY:')
    expect(workflow).not.toContain('LIVE_CONNECTOR_SMOKE:')
  })

  it('documents app deploy and database migration rollback procedures', () => {
    const path = 'docs/runbooks/launch-rollback.md'

    expect(existsSync(path)).toBe(true)

    const runbook = readFileSync(path, 'utf8')
    const requiredSections = [
      '## App Deploy Rollback',
      '## Database Migration Rollback',
      '## Owners',
      '## Severity',
      '## Detection',
      '## Response',
      '## Verification',
    ]

    for (const section of requiredSections) {
      expect(runbook).toContain(section)
    }
  })

  it('documents staging rehearsal checks for launch-critical controls', () => {
    const path = 'docs/runbooks/staging-rehearsal.md'

    expect(existsSync(path)).toBe(true)

    const rehearsal = readFileSync(path, 'utf8')
    const requiredSections = [
      '## Preflight Gates',
      '## Upload And Conversion Path',
      '## Billing And Webhook Sanity',
      '## Deletion Expiry',
      '## Audit Evidence',
      '## Alert And Ops Dashboard Signal',
      '## Evidence Package',
    ]

    for (const section of requiredSections) {
      expect(rehearsal).toContain(section)
    }
  })
})
