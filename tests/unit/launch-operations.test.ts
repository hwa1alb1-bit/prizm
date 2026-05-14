import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  evaluateStagingRehearsalEvidence,
  stagingRehearsalSections,
} from '@/lib/server/staging-rehearsal-evidence'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')

describe('launch operations controls', () => {
  it('runs the extraction verification gate in CI with Java 21 available', () => {
    expect(workflow).toContain('extraction-gate:')
    expect(workflow).toContain('distribution: temurin')
    expect(workflow).toContain('java-version: 21')
    expect(workflow).toContain('pnpm verify:extraction')
    expect(workflow).toContain('docs/evidence/extraction-benchmarks/')
  })

  it('runs launch gates in CI for staging and production contexts', () => {
    const requiredLaunchEnvKeys = [
      'NEXT_PUBLIC_SITE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AWS_REGION',
      'AWS_ROLE_ARN',
      'S3_UPLOAD_BUCKET',
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

    for (const key of [
      'DOCUMENT_STORAGE_PROVIDER',
      'DOCUMENT_EXTRACTION_PROVIDER',
      'R2_ACCOUNT_ID',
      'R2_UPLOAD_BUCKET',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'CLOUDFLARE_EXTRACTOR_URL',
      'CLOUDFLARE_EXTRACTOR_TOKEN',
      'CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY',
      'CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID',
      'CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT',
      'CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA',
    ]) {
      expect(workflow).toContain(`${key}:`)
    }

    expect(workflow).not.toContain('AWS_ACCESS_KEY_ID:')
    expect(workflow).not.toContain('AWS_SECRET_ACCESS_KEY:')
    expect(workflow).not.toContain('SUPABASE_ACCESS_TOKEN:')
    expect(workflow).not.toContain('SUPABASE_PROJECT_ID:')
    expect(workflow).not.toContain('S3_KMS_KEY_ID:')
    expect(workflow).not.toContain('LIVE_CONNECTOR_SMOKE:')
  })

  it('enforces STAGING_HOST before running security header checks on main', () => {
    expect(workflow).toContain('needs: [e2e, staging-launch-gate]')
    expect(workflow).toContain('NEXT_PUBLIC_SITE_URL: ${{ vars.NEXT_PUBLIC_SITE_URL }}')
    expect(workflow).toContain('STAGING_HOST: ${{ vars.STAGING_HOST }}')
    expect(workflow).toContain('host="${STAGING_HOST:-}"')
    expect(workflow).toContain('host="${NEXT_PUBLIC_SITE_URL#http://}"')
    expect(workflow).toContain(
      'STAGING_HOST or NEXT_PUBLIC_SITE_URL is required for security header enforcement.',
    )
    expect(workflow).toContain('STAGING_HOST=$host does not resolve.')
    expect(workflow).toContain('minimum_score=80')
    expect(workflow).toContain('Fail: score $score is below $minimum_score')
    expect(workflow).not.toContain('Skipping Mozilla Observatory check')
    expect(workflow).not.toContain('Skipping Observatory check')
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

  it('documents Branch 4 service readiness evidence and Dependabot governance', () => {
    const runbookPath = 'docs/runbooks/service-readiness-follow-up.md'
    const evidenceReadmePath = 'docs/evidence/service-readiness/README.md'
    const dependabotPath = '.github/dependabot.yml'
    const packageJson = readFileSync('package.json', 'utf8')

    expect(packageJson).toContain('"verify:service-readiness"')
    expect(existsSync(runbookPath)).toBe(true)
    expect(existsSync(evidenceReadmePath)).toBe(true)
    expect(existsSync(dependabotPath)).toBe(true)

    const runbook = readFileSync(runbookPath, 'utf8')
    for (const section of [
      '## Evidence Collection',
      '## Stripe Proof',
      '## AWS Textract Subscription',
      '## DNSSEC And Cloudflare',
      '## GitHub Governance',
      '## Dashboard-Only Exceptions',
    ]) {
      expect(runbook).toContain(section)
    }
    expect(runbook).toContain('connector_subscription_required')
    expect(runbook).toContain(
      'aws textract get-document-analysis --region us-east-1 --job-id prizm-health-probe',
    )

    const evidenceReadme = readFileSync(evidenceReadmePath, 'utf8')
    expect(evidenceReadme).toContain('Branch 4: service readiness')
    expect(evidenceReadme).toContain('SERVICE_READINESS_ALLOW_INCOMPLETE=1')
    expect(evidenceReadme).toContain('acceptedGrayProviders')
    expect(runbook).toContain('SERVICE_READINESS_ACCEPTED_GRAY_PROVIDERS')

    const dependabot = readFileSync(dependabotPath, 'utf8')
    expect(dependabot).toContain("package-ecosystem: 'npm'")
    expect(dependabot).toContain("package-ecosystem: 'github-actions'")
  })

  it('documents the Cloudflare Kotlin production proof before enabling the launch path', () => {
    const fallback = readFileSync('docs/runbooks/kotlin-worker-fallback.md', 'utf8')
    const rehearsal = readFileSync('docs/runbooks/staging-rehearsal.md', 'utf8')

    for (const phrase of [
      '/v1/health',
      'HEALTHCHECK_STORAGE_KEY',
      'CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID',
      'worker health',
      'R2 storage access',
      'extraction success',
      'statement persistence',
      'retry behavior',
      'dead-letter handling',
      'DOCUMENT_EXTRACTION_PROVIDER=cloudflare-r2',
    ]) {
      expect(fallback).toContain(phrase)
    }

    expect(rehearsal).toContain('Cloudflare R2 Kotlin Extraction Proof')
    expect(rehearsal).toContain('CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY')
    expect(rehearsal).toContain('CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA')
  })

  it('requires dated evidence artifacts before a staging rehearsal can pass', () => {
    const artifact = validStagingRehearsalEvidence()

    expect(evaluateStagingRehearsalEvidence(artifact)).toEqual({
      ok: true,
      failures: [],
    })

    const incomplete = {
      ...artifact,
      sectionEvidence: {
        ...artifact.sectionEvidence,
        'billing-and-webhook-sanity': {
          ...artifact.sectionEvidence['billing-and-webhook-sanity'],
          artifactPath: '',
        },
      },
      stripeEventIds: [],
      operatorSignoff: {
        ...artifact.operatorSignoff,
        result: 'pending',
      },
    }

    expect(evaluateStagingRehearsalEvidence(incomplete)).toEqual({
      ok: false,
      failures: [
        'Billing And Webhook Sanity evidence artifact must be archived under docs/evidence/staging-rehearsals/2026-05-14/.',
        'Stripe event IDs are required.',
        'Operator signoff result must be pass or fail.',
      ],
    })
  })

  it('documents the dated staging rehearsal evidence package contract', () => {
    const runbook = readFileSync('docs/runbooks/staging-rehearsal.md', 'utf8')
    const evidenceReadmePath = 'docs/evidence/staging-rehearsals/README.md'
    const packageJson = readFileSync('package.json', 'utf8')

    expect(packageJson).toContain('"check:staging-rehearsal-evidence"')
    expect(existsSync(evidenceReadmePath)).toBe(true)

    const evidenceReadme = readFileSync(evidenceReadmePath, 'utf8')
    for (const section of stagingRehearsalSections) {
      expect(runbook).toContain(`docs/evidence/staging-rehearsals/<YYYY-MM-DD>/${section.id}.md`)
      expect(evidenceReadme).toContain(section.id)
    }

    for (const requiredField of [
      'releaseSha',
      'vercelDeploymentUrl',
      'stagingHost',
      'launchGateOutput',
      'liveConnectorSmokeOutput',
      'uploadRequestId',
      'convertRequestId',
      'statusRequestId',
      'exportRequestId',
      'auditQueryOutput',
      'stripeEventIds',
      'deletionSweepEvidence',
      'deletionMonitorEvidence',
      'sentryAlertLinkOrDrillId',
      'operatorSignoff',
    ]) {
      expect(evidenceReadme).toContain(requiredField)
    }
  })
})

function validStagingRehearsalEvidence() {
  return {
    schemaVersion: 1,
    rehearsalDate: '2026-05-14',
    releaseSha: '5a6b2351b500024ab74b2f7c53b12e0afb478306',
    vercelDeploymentUrl: 'https://prizm-git-main-plknokos-projects.vercel.app',
    stagingHost: 'staging.prizmview.app',
    launchGateOutput: 'Launch gate passed for staging',
    liveConnectorSmokeOutput: 'supabase: ok\nstripe: ok\ns3: ok\nredis: ok',
    uploadRequestId: 'req_upload_123',
    convertRequestId: 'req_convert_123',
    statusRequestId: 'req_status_123',
    exportRequestId: 'req_export_123',
    auditQueryOutput: 'document.upload_requested stripe.checkout.session.completed',
    stripeEventIds: ['evt_123'],
    deletionSweepEvidence: 'sweep_run_id=delete_sweep_123',
    deletionMonitorEvidence: 'monitor_run_id=delete_monitor_123',
    sentryAlertLinkOrDrillId: 'https://prizm.sentry.io/issues/123',
    operatorSignoff: {
      operator: 'Ops',
      result: 'pass',
      signedAt: '2026-05-14T15:30:00.000Z',
    },
    sectionEvidence: Object.fromEntries(
      stagingRehearsalSections.map((section) => [
        section.id,
        {
          artifactPath: `docs/evidence/staging-rehearsals/2026-05-14/${section.id}.md`,
          collectedAt: '2026-05-14T15:30:00.000Z',
          status: 'pass',
        },
      ]),
    ),
  }
}
