import { describe, expect, it } from 'vitest'
import {
  createServiceReadinessDashboardOnlyItems,
  createServiceReadinessArchive,
  createServiceReadinessProviders,
  evaluateServiceReadinessEvidence,
  normalizeLiveConnectorSmokeForLaunchPath,
  parseAcceptedGrayProviders,
  resolveCloudflareExtractorHealthStatus,
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
          cloudflareR2Extractor: true,
          cloudflareDns: false,
          sentry: true,
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

  it('accepts production providers that are explicitly archived as accepted-gray', () => {
    const result = evaluateServiceReadinessEvidence(
      readyEvidence({
        providers: {
          ...readyEvidence().providers,
          resend: false,
          sentry: false,
        },
        acceptedGrayProviders: [
          {
            provider: 'resend',
            owner: 'Ops',
            reason:
              'Email sending is intentionally paused until the Resend DKIM cutover is confirmed.',
            nextProofStep: 'Confirm Resend domain verification, then rerun the readiness archive.',
          },
          {
            provider: 'sentry',
            owner: 'Ops',
            reason: 'Error telemetry is intentionally informational during the launch rehearsal.',
            nextProofStep:
              'Verify Sentry alert routing before enabling the provider as launch-required.',
          },
        ],
      }),
    )

    expect(result).toEqual({
      ok: true,
      failures: [],
    })
  })

  it('does not allow accepted-gray proof to bypass the Cloudflare R2 extractor launch proof', () => {
    const result = evaluateServiceReadinessEvidence(
      readyEvidence({
        providers: {
          ...readyEvidence().providers,
          cloudflareR2Extractor: false,
        },
        acceptedGrayProviders: [
          {
            provider: 'cloudflareR2Extractor',
            owner: 'Ops',
            reason: 'Cloudflare proof is still being collected.',
            nextProofStep: 'Deploy the Worker and rerun the readiness archive.',
          },
        ],
      }),
    )

    expect(result.failures).toEqual(
      expect.arrayContaining([
        'Production provider evidence is missing for Cloudflare R2 extractor.',
        'Accepted-gray provider "Cloudflare R2 extractor" cannot bypass launch-required proof.',
      ]),
    )
  })

  it('parses accepted-gray provider proof from the readiness environment', () => {
    expect(
      parseAcceptedGrayProviders(
        JSON.stringify([
          {
            provider: 'sentry',
            owner: 'Ops',
            reason: 'Telemetry is informational during launch rehearsal.',
            nextProofStep: 'Verify alert routing before making Sentry launch-required.',
          },
        ]),
      ),
    ).toEqual([
      {
        provider: 'sentry',
        owner: 'Ops',
        reason: 'Telemetry is informational during launch rehearsal.',
        nextProofStep: 'Verify alert routing before making Sentry launch-required.',
      },
    ])

    expect(() =>
      parseAcceptedGrayProviders(
        JSON.stringify([
          {
            provider: 'unknown-provider',
            owner: 'Ops',
            reason: 'Bad provider.',
            nextProofStep: 'Fix the provider name.',
          },
        ]),
      ),
    ).toThrow('Unsupported accepted-gray provider "unknown-provider".')

    expect(() =>
      parseAcceptedGrayProviders(
        JSON.stringify([
          {
            provider: 'cloudflareR2Extractor',
            owner: 'Ops',
            reason: 'Cloudflare proof is still being collected.',
            nextProofStep: 'Deploy the Worker and rerun the readiness archive.',
          },
        ]),
      ),
    ).toThrow('Cloudflare R2 extractor proof cannot be accepted-gray.')
  })

  it('does not trust a Cloudflare extractor ok body from a failed health response', () => {
    expect(
      resolveCloudflareExtractorHealthStatus({
        ok: false,
        status: 500,
        bodyStatus: 'ok',
      }),
    ).toBe('http_500')

    expect(
      resolveCloudflareExtractorHealthStatus({
        ok: true,
        status: 200,
        bodyStatus: 'ok',
      }),
    ).toBe('ok')
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
      cloudflareExtractor: readyCloudflareExtractor({
        configured: false,
        status: 'missing_config',
        collectedAt: null,
        url: null,
        missingEnv: ['CLOUDFLARE_EXTRACTOR_URL', 'CLOUDFLARE_EXTRACTOR_TOKEN'],
      }),
      vercel: true,
      stripeWebhookRegistered: true,
      cloudflareDnsReady: true,
    })

    expect(providers).toEqual({
      vercel: true,
      supabase: false,
      stripe: false,
      cloudflareR2Extractor: false,
      cloudflareDns: true,
      sentry: false,
      resend: false,
      redis: false,
    })
  })

  it('creates owner-assigned dashboard follow-ups for missing production provider evidence', () => {
    const evidence = readyEvidence({
      opsHealth: {
        authenticated: false,
        status: 'missing_auth',
        archivedAt: null,
        connectors: [],
      },
      providers: {
        vercel: true,
        supabase: false,
        stripe: false,
        cloudflareR2Extractor: true,
        cloudflareDns: true,
        sentry: false,
        resend: false,
        redis: false,
      },
    })

    const items = createServiceReadinessDashboardOnlyItems({
      opsHealth: evidence.opsHealth,
      liveConnectorSmoke: evidence.liveConnectorSmoke!,
      providers: evidence.providers,
      cloudflareExtractor: evidence.cloudflareExtractor,
      stripe: evidence.stripe,
      dnsEvidence: evidence.dns,
      github: evidence.github,
    })

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: 'Supabase',
          item: 'Authenticated production Supabase connector evidence',
          owner: 'Ops',
        }),
        expect.objectContaining({
          area: 'Stripe',
          item: 'Authenticated production Stripe connector evidence',
          owner: 'Ops',
        }),
        expect.objectContaining({
          area: 'Sentry',
          item: 'Authenticated production Sentry connector evidence',
          owner: 'Ops',
        }),
        expect.objectContaining({
          area: 'Resend',
          item: 'Authenticated production Resend connector evidence',
          owner: 'Ops',
        }),
        expect.objectContaining({
          area: 'Redis',
          item: 'Authenticated production Redis connector evidence',
          owner: 'Ops',
        }),
      ]),
    )
    expect(items).not.toContainEqual(
      expect.objectContaining({
        area: 'Cloudflare extraction',
      }),
    )
    expect(items.every((item) => item.nextProofStep.trim().length > 0)).toBe(true)
  })

  it('does not duplicate provider dashboard follow-ups for accepted-gray evidence', () => {
    const evidence = readyEvidence({
      providers: {
        ...readyEvidence().providers,
        sentry: false,
      },
      acceptedGrayProviders: [
        {
          provider: 'sentry',
          owner: 'Ops',
          reason: 'Telemetry is informational during launch rehearsal.',
          nextProofStep: 'Verify alert routing before making Sentry launch-required.',
        },
      ],
    })

    const items = createServiceReadinessDashboardOnlyItems({
      opsHealth: evidence.opsHealth,
      liveConnectorSmoke: evidence.liveConnectorSmoke!,
      providers: evidence.providers,
      acceptedGrayProviders: evidence.acceptedGrayProviders,
      cloudflareExtractor: evidence.cloudflareExtractor,
      stripe: evidence.stripe,
      dnsEvidence: evidence.dns,
      github: evidence.github,
    })

    expect(items).not.toContainEqual(
      expect.objectContaining({
        area: 'Sentry',
        item: 'Authenticated production Sentry connector evidence',
      }),
    )
  })

  it('fails when the Cloudflare R2/container extractor health proof is degraded', () => {
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
    const cloudflareExtractor = readyCloudflareExtractor({
      status: 'degraded',
      checks: {
        ...readyCloudflareExtractor().checks,
        uploadBucket: {
          ok: false,
          key: 'probes/known-good.pdf',
          error: 'Healthcheck storage object was not found.',
        },
      },
    })
    const evidence = readyEvidence({
      opsHealth,
      cloudflareExtractor,
      providers: createServiceReadinessProviders({
        opsHealth,
        cloudflareExtractor,
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
      'Production provider evidence is missing for Cloudflare R2 extractor.',
    )

    const dashboardOnlyItems = createServiceReadinessDashboardOnlyItems({
      opsHealth,
      liveConnectorSmoke: {
        status: 'ok',
        collectedAt: '2026-05-08T23:43:13.174Z',
        connectors: [],
      },
      providers: evidence.providers,
      cloudflareExtractor,
      stripe: evidence.stripe,
      dnsEvidence: evidence.dns,
      github: evidence.github,
    })

    expect(dashboardOnlyItems).toContainEqual(
      expect.objectContaining({
        area: 'Cloudflare extraction',
        item: 'Cloudflare R2/container extractor health is degraded: uploadBucket failed: Healthcheck storage object was not found.',
        owner: 'Cloudflare admin',
      }),
    )
  })

  it('requires archived Cloudflare staging proof for extractor readiness', () => {
    const cloudflareExtractor = readyCloudflareExtractor({
      stagingProof: {
        id: null,
        archivedAt: null,
        sha: null,
        validated: false,
        evidencePath: null,
        error: 'proof_env_missing',
      },
      missingEnv: [
        'CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID',
        'CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT',
        'CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA',
      ],
    })
    const evidence = readyEvidence({
      cloudflareExtractor,
      providers: createServiceReadinessProviders({
        opsHealth: readyEvidence().opsHealth,
        cloudflareExtractor,
        vercel: true,
        stripeWebhookRegistered: true,
        cloudflareDnsReady: true,
      }),
    })

    expect(evaluateServiceReadinessEvidence(evidence).failures).toContain(
      'Production provider evidence is missing for Cloudflare R2 extractor.',
    )
  })

  it('rejects Cloudflare staging proof metadata when the archive cannot be validated', () => {
    const cloudflareExtractor = readyCloudflareExtractor({
      stagingProof: {
        id: 'cf-extraction-staging-2026-05-14T21-14-43-312Z',
        archivedAt: '2026-05-14T21:15:01.124Z',
        sha: '6c236fa3548b3ff7c19e8585ffc565e5586a4ce5f8083704482b26bf0fe1b0b6',
        validated: false,
        evidencePath:
          'docs/evidence/cloudflare-extraction/cf-extraction-staging-2026-05-14T21-14-43-312Z.json',
        error: 'proof_archive_sha_mismatch',
      },
    })
    const evidence = readyEvidence({
      cloudflareExtractor,
      providers: createServiceReadinessProviders({
        opsHealth: readyEvidence().opsHealth,
        cloudflareExtractor,
        vercel: true,
        stripeWebhookRegistered: true,
        cloudflareDnsReady: true,
      }),
    })

    expect(evaluateServiceReadinessEvidence(evidence).failures).toContain(
      'Production provider evidence is missing for Cloudflare R2 extractor.',
    )

    expect(
      createServiceReadinessDashboardOnlyItems({
        opsHealth: evidence.opsHealth,
        liveConnectorSmoke: evidence.liveConnectorSmoke!,
        providers: evidence.providers,
        cloudflareExtractor,
        stripe: evidence.stripe,
        dnsEvidence: evidence.dns,
        github: evidence.github,
      }),
    ).toContainEqual(
      expect.objectContaining({
        area: 'Cloudflare extraction',
        item: 'Cloudflare R2/container extractor staging proof archive is invalid: proof_archive_sha_mismatch',
      }),
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

  it('does not require AWS Textract proof when the Cloudflare extractor proof is healthy', () => {
    const opsHealth: ServiceReadinessEvidence['opsHealth'] = {
      authenticated: true,
      status: 'degraded',
      archivedAt: '2026-05-08T23:43:13.174Z',
      connectors: [
        { name: 'supabase', ok: true, required: true },
        { name: 'stripe', ok: true, required: true },
        { name: 's3', ok: true, required: true },
        {
          name: 'textract',
          ok: false,
          required: true,
          errorCode: 'connector_subscription_required',
        },
        { name: 'resend', ok: true, required: false },
        { name: 'redis', ok: true, required: true },
        { name: 'sentry', ok: true, required: false },
      ],
    }
    const cloudflareExtractor = readyCloudflareExtractor()

    const items = createServiceReadinessDashboardOnlyItems({
      opsHealth,
      liveConnectorSmoke: {
        status: 'degraded',
        collectedAt: '2026-05-08T23:43:13.174Z',
        connectors: [],
      },
      providers: createServiceReadinessProviders({
        opsHealth,
        cloudflareExtractor,
        vercel: true,
        stripeWebhookRegistered: true,
        cloudflareDnsReady: true,
      }),
      cloudflareExtractor,
      stripe: readyEvidence().stripe,
      dnsEvidence: readyEvidence().dns,
      github: readyEvidence().github,
    })

    expect(items.some((item) => item.area === 'AWS/Textract')).toBe(false)
  })

  it('marks legacy S3 and Textract live smoke as diagnostic under the Cloudflare launch path', () => {
    const smoke = normalizeLiveConnectorSmokeForLaunchPath(
      {
        status: 'degraded',
        collectedAt: '2026-05-08T23:43:13.174Z',
        connectors: [
          { name: 'supabase', ok: true, required: true },
          { name: 's3', ok: true, required: true },
          {
            name: 'textract',
            ok: false,
            required: true,
            errorCode: 'connector_subscription_required',
          },
          { name: 'redis', ok: true, required: true },
        ],
      },
      {
        storageProvider: 'r2',
        extractionProvider: 'cloudflare-r2',
      },
    )

    expect(smoke.status).toBe('ok')
    expect(smoke.connectors).toEqual([
      { name: 'supabase', ok: true, required: true },
      { name: 's3', ok: true, required: false },
      {
        name: 'textract',
        ok: false,
        required: false,
        errorCode: 'connector_subscription_required',
      },
      { name: 'redis', ok: true, required: true },
    ])
  })

  it('requires Cloudflare proof metadata to match a validated proof archive', () => {
    const cloudflareExtractor = readyCloudflareExtractor({
      stagingProof: {
        ...readyCloudflareExtractor().stagingProof,
        validated: false,
        error: 'proof_archive_sha_mismatch',
      },
    })
    const evidence = readyEvidence({
      cloudflareExtractor,
      providers: createServiceReadinessProviders({
        opsHealth: readyEvidence().opsHealth,
        cloudflareExtractor,
        vercel: true,
        stripeWebhookRegistered: true,
        cloudflareDnsReady: true,
      }),
    })

    expect(evaluateServiceReadinessEvidence(evidence).failures).toContain(
      'Production provider evidence is missing for Cloudflare R2 extractor.',
    )

    const dashboardOnlyItems = createServiceReadinessDashboardOnlyItems({
      opsHealth: evidence.opsHealth,
      liveConnectorSmoke: {
        status: 'ok',
        collectedAt: '2026-05-08T23:43:13.174Z',
        connectors: [],
      },
      providers: evidence.providers,
      cloudflareExtractor,
      stripe: evidence.stripe,
      dnsEvidence: evidence.dns,
      github: evidence.github,
    })

    expect(dashboardOnlyItems).toContainEqual(
      expect.objectContaining({
        area: 'Cloudflare extraction',
        item: 'Cloudflare R2/container extractor staging proof archive is invalid: proof_archive_sha_mismatch',
      }),
    )
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
        { name: 'resend', ok: true, required: false },
        { name: 'redis', ok: true, required: true },
        { name: 'sentry', ok: true, required: false },
      ],
    },
    cloudflareExtractor: readyCloudflareExtractor(),
    providers: {
      vercel: true,
      supabase: true,
      stripe: true,
      cloudflareR2Extractor: true,
      cloudflareDns: true,
      sentry: true,
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

function readyCloudflareExtractor(
  overrides: Partial<ServiceReadinessEvidence['cloudflareExtractor']> = {},
): ServiceReadinessEvidence['cloudflareExtractor'] {
  return {
    configured: true,
    status: 'ok',
    collectedAt: '2026-05-08T19:00:00.000Z',
    url: 'https://prizm-cloudflare-extractor.example.workers.dev',
    healthcheckStorageKey: 'probes/known-good.pdf',
    launchPath: {
      storageProvider: 'r2',
      extractionProvider: 'cloudflare-r2',
    },
    stagingProof: {
      id: 'cf-extraction-staging-2026-05-14T21-14-43-312Z',
      archivedAt: '2026-05-14T21:15:01.124Z',
      sha: '6c236fa3548b3ff7c19e8585ffc565e5586a4ce5f8083704482b26bf0fe1b0b6',
      validated: true,
      evidencePath:
        'docs/evidence/cloudflare-extraction/cf-extraction-staging-2026-05-14T21-14-43-312Z.json',
      error: null,
    },
    missingEnv: [],
    checks: {
      jobStateBucket: { ok: true },
      uploadBucket: { ok: true, key: 'probes/known-good.pdf' },
      extractionQueue: { ok: true },
      kotlinExtractor: { ok: true },
    },
    ...overrides,
  }
}
