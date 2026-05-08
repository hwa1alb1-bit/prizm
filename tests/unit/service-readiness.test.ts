import { describe, expect, it } from 'vitest'
import {
  createServiceReadinessArchive,
  createServiceReadinessProviders,
  evaluateServiceReadinessEvidence,
  resolveOpsHealthAuth,
  type ServiceReadinessEvidence,
} from '@/lib/server/service-readiness'

describe('service readiness evidence', () => {
  it('passes only when production operations, providers, billing, DNS, and GitHub governance are proven', () => {
    const result = evaluateServiceReadinessEvidence(readyEvidence())

    expect(result).toEqual({
      ok: true,
      failures: [],
    })
  })

  it('returns owner-oriented failures for unproven Branch 4 acceptance items', () => {
    const result = evaluateServiceReadinessEvidence(
      readyEvidence({
        opsHealth: {
          authenticated: false,
          status: 'unknown',
          connectors: [],
          archivedAt: null,
        },
        providers: {
          vercel: false,
          supabase: true,
          stripe: true,
          cloudflareDns: false,
          sentry: true,
          awsS3Textract: true,
          resend: true,
          redis: true,
        },
        stripe: {
          webhookEndpoint: {
            registered: true,
            url: 'https://prizmview.app/api/v1/webhooks/stripe',
            subscribedEvents: ['checkout.session.completed'],
            deliverySuccess: false,
          },
          customerPortal: { configured: false },
          checkoutSubscriptionCreditGrant: { proven: false },
        },
        dns: {
          dnssecDsDelegated: false,
          cloudflareTemplateReconciled: false,
          drift: ['resend._domainkey TXT is still the placeholder value'],
        },
        github: {
          repoPublic: false,
          rulesetsConfigured: false,
          requiredStatusChecks: ['Lint, types, unit tests'],
          dependabotConfigured: false,
          vulnerabilityAlertsEnabled: false,
          secretScanningEnabled: false,
          environmentsProtected: false,
        },
        dashboardOnlyItems: [
          {
            area: 'Cloudflare',
            item: 'DNSSEC DS copied to registrar',
            owner: 'Ops',
            nextProofStep: '',
          },
        ],
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual([
      'Authenticated /api/ops/health evidence has not been archived.',
      'Production provider evidence is missing for Vercel, Cloudflare/DNS.',
      'Stripe webhook endpoint registration or subscribed events have not been proven.',
      'Stripe webhook delivery success has not been proven.',
      'Stripe Customer Portal configuration has not been proven.',
      'Checkout-to-subscription-to-credit-grant evidence has not been proven.',
      'DNSSEC DS delegation is not visible in public DNS.',
      'Cloudflare zone template does not match live DNS: resend._domainkey TXT is still the placeholder value.',
      'GitHub repository is not public.',
      'GitHub rulesets with required status checks are not configured.',
      'Dependabot/security alert controls are incomplete.',
      'GitHub environment protections are not configured.',
      'Dashboard-only item "Cloudflare: DNSSEC DS copied to registrar" needs an owner and next proof step.',
    ])
  })

  it('creates an immutable Branch 4 archive envelope with the evaluation result', () => {
    const archive = createServiceReadinessArchive({
      generatedAt: '2026-05-08T20:00:00.000Z',
      evidence: readyEvidence({
        dashboardOnlyItems: [],
      }),
    })

    expect(archive).toMatchObject({
      schemaVersion: 1,
      branch: 'Branch 4: service readiness',
      generatedAt: '2026-05-08T20:00:00.000Z',
      result: { ok: true, failures: [] },
      evidence: {
        opsHealth: {
          authenticated: true,
          status: 'ok',
        },
      },
    })
  })

  it('does not count local connector smoke as production provider proof without ops auth', () => {
    const providers = createServiceReadinessProviders({
      opsHealth: {
        authenticated: false,
        status: 'missing_auth',
        archivedAt: null,
        connectors: [],
      },
      localConnectorSmoke: {
        status: 'ok',
        collectedAt: '2026-05-08T19:00:00.000Z',
        connectors: [
          { name: 'supabase', ok: true, required: true },
          { name: 'stripe', ok: true, required: true },
          { name: 's3', ok: true, required: true },
          { name: 'textract', ok: true, required: true },
          { name: 'resend', ok: true, required: false },
          { name: 'redis', ok: true, required: true },
          { name: 'sentry', ok: true, required: false },
        ],
      },
      vercel: true,
      stripeWebhookRegistered: true,
      cloudflareDnsReady: true,
    })

    expect(providers).toEqual({
      vercel: true,
      supabase: false,
      stripe: false,
      cloudflareDns: true,
      sentry: false,
      awsS3Textract: false,
      resend: false,
      redis: false,
    })
  })

  it('archives authenticated degraded ops health while keeping failed connector evidence', () => {
    const opsHealth: ServiceReadinessEvidence['opsHealth'] = {
      authenticated: true,
      status: 'degraded',
      archivedAt: '2026-05-08T23:43:13.174Z',
      connectors: [
        { name: 'supabase', ok: true, required: true },
        { name: 'stripe', ok: true, required: true },
        { name: 's3', ok: true, required: true },
        { name: 'textract', ok: false, required: true, errorCode: 'connector_failed' },
        { name: 'resend', ok: true, required: false },
        { name: 'redis', ok: true, required: true },
        { name: 'sentry', ok: true, required: false },
      ],
    }
    const evidence = readyEvidence({
      opsHealth,
      providers: createServiceReadinessProviders({
        opsHealth,
        vercel: true,
        stripeWebhookRegistered: true,
        cloudflareDnsReady: true,
      }),
    })

    const result = evaluateServiceReadinessEvidence(evidence)

    expect(result.failures).not.toContain(
      'Authenticated /api/ops/health evidence has not been archived.',
    )
    expect(result.failures).toContain(
      'Production provider evidence is missing for AWS/S3/Textract.',
    )
  })

  it('keeps ops health readiness auth cookie-only', () => {
    expect(
      resolveOpsHealthAuth({
        OPS_HEALTH_BEARER_TOKEN: 'token',
      }),
    ).toEqual({
      ok: false,
      status: 'unsupported_bearer_auth',
    })

    expect(
      resolveOpsHealthAuth({
        OPS_HEALTH_COOKIE: 'session=abc',
        OPS_HEALTH_BEARER_TOKEN: 'token',
      }),
    ).toEqual({
      ok: true,
      headers: {
        'cache-control': 'no-store',
        cookie: 'session=abc',
      },
    })
  })
})

function readyEvidence(
  overrides: Partial<ServiceReadinessEvidence> = {},
): ServiceReadinessEvidence {
  return {
    opsHealth: {
      authenticated: true,
      status: 'ok',
      archivedAt: '2026-05-08T19:00:00.000Z',
      connectors: [
        { name: 'supabase', ok: true, required: true },
        { name: 'stripe', ok: true, required: true },
        { name: 's3', ok: true, required: true },
        { name: 'textract', ok: true, required: true },
        { name: 'resend', ok: true, required: false },
        { name: 'redis', ok: true, required: true },
        { name: 'sentry', ok: true, required: false },
      ],
    },
    providers: {
      vercel: true,
      supabase: true,
      stripe: true,
      cloudflareDns: true,
      sentry: true,
      awsS3Textract: true,
      resend: true,
      redis: true,
    },
    stripe: {
      webhookEndpoint: {
        registered: true,
        url: 'https://prizmview.app/api/v1/webhooks/stripe',
        subscribedEvents: [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ],
        deliverySuccess: true,
      },
      customerPortal: { configured: true },
      checkoutSubscriptionCreditGrant: { proven: true },
    },
    dns: {
      dnssecDsDelegated: true,
      cloudflareTemplateReconciled: true,
      drift: [],
    },
    github: {
      repoPublic: true,
      rulesetsConfigured: true,
      requiredStatusChecks: ['Lint, types, unit tests', 'Playwright E2E'],
      dependabotConfigured: true,
      vulnerabilityAlertsEnabled: true,
      secretScanningEnabled: true,
      environmentsProtected: true,
    },
    dashboardOnlyItems: [
      {
        area: 'Stripe',
        item: 'Live-mode tax and invoice branding review',
        owner: 'Ops',
        nextProofStep: 'Attach the Stripe dashboard screenshot to the monthly evidence pack.',
      },
    ],
    ...overrides,
  }
}
