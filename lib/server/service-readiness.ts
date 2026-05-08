import 'server-only'

export type ServiceReadinessConnector = {
  name: string
  ok: boolean
  required: boolean
  errorCode?: string | null
}

export type ServiceReadinessEvidence = {
  opsHealth: {
    authenticated: boolean
    status: string
    archivedAt: string | null
    connectors: ServiceReadinessConnector[]
  }
  liveConnectorSmoke?: {
    status: string
    collectedAt: string
    connectors: ServiceReadinessConnector[]
  }
  providers: {
    vercel: boolean
    supabase: boolean
    stripe: boolean
    cloudflareDns: boolean
    sentry: boolean
    awsS3Textract: boolean
    resend: boolean
    redis: boolean
  }
  stripe: {
    webhookEndpoint: {
      registered: boolean
      url: string | null
      subscribedEvents: string[]
      deliverySuccess: boolean
    }
    customerPortal: {
      configured: boolean
    }
    checkoutSubscriptionCreditGrant: {
      proven: boolean
    }
  }
  dns: {
    dnssecDsDelegated: boolean
    cloudflareTemplateReconciled: boolean
    drift: string[]
  }
  github: {
    repoPublic: boolean
    rulesetsConfigured: boolean
    requiredStatusChecks: string[]
    dependabotConfigured: boolean
    vulnerabilityAlertsEnabled: boolean
    secretScanningEnabled: boolean
    environmentsProtected: boolean
  }
  dashboardOnlyItems: DashboardOnlyReadinessItem[]
}

export type DashboardOnlyReadinessItem = {
  area: string
  item: string
  owner: string
  nextProofStep: string
}

export type ServiceReadinessResult = {
  ok: boolean
  failures: string[]
}

export type ServiceReadinessArchive = {
  schemaVersion: 1
  branch: 'Branch 4: service readiness'
  generatedAt: string
  evidence: ServiceReadinessEvidence
  result: ServiceReadinessResult
}

export type OpsHealthAuth =
  | {
      ok: true
      headers: Record<string, string>
    }
  | {
      ok: false
      status: 'missing_auth' | 'unsupported_bearer_auth'
    }

type OpsHealthAuthEnv = Record<string, string | undefined>

const providerLabels: Record<keyof ServiceReadinessEvidence['providers'], string> = {
  vercel: 'Vercel',
  supabase: 'Supabase',
  stripe: 'Stripe',
  cloudflareDns: 'Cloudflare/DNS',
  sentry: 'Sentry',
  awsS3Textract: 'AWS/S3/Textract',
  resend: 'Resend',
  redis: 'Redis',
}

const requiredStripeWebhookEvents = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

export function evaluateServiceReadinessEvidence(
  evidence: ServiceReadinessEvidence,
): ServiceReadinessResult {
  const failures: string[] = []

  if (!hasArchivedAuthenticatedOpsHealth(evidence)) {
    failures.push('Authenticated /api/ops/health evidence has not been archived.')
  }

  const missingProviders = missingProviderEvidence(evidence)
  if (missingProviders.length > 0) {
    failures.push(`Production provider evidence is missing for ${missingProviders.join(', ')}.`)
  }

  if (!stripeWebhookRegistered(evidence)) {
    failures.push('Stripe webhook endpoint registration or subscribed events have not been proven.')
  }

  if (!evidence.stripe.webhookEndpoint.deliverySuccess) {
    failures.push('Stripe webhook delivery success has not been proven.')
  }

  if (!evidence.stripe.customerPortal.configured) {
    failures.push('Stripe Customer Portal configuration has not been proven.')
  }

  if (!evidence.stripe.checkoutSubscriptionCreditGrant.proven) {
    failures.push('Checkout-to-subscription-to-credit-grant evidence has not been proven.')
  }

  if (!evidence.dns.dnssecDsDelegated) {
    failures.push('DNSSEC DS delegation is not visible in public DNS.')
  }

  if (!evidence.dns.cloudflareTemplateReconciled) {
    const detail = evidence.dns.drift.length > 0 ? `: ${evidence.dns.drift.join('; ')}.` : '.'
    failures.push(`Cloudflare zone template does not match live DNS${detail}`)
  }

  if (!evidence.github.repoPublic) {
    failures.push('GitHub repository is not public.')
  }

  if (!githubRulesetsReady(evidence)) {
    failures.push('GitHub rulesets with required status checks are not configured.')
  }

  if (!githubSecurityReady(evidence)) {
    failures.push('Dependabot/security alert controls are incomplete.')
  }

  if (!evidence.github.environmentsProtected) {
    failures.push('GitHub environment protections are not configured.')
  }

  for (const item of evidence.dashboardOnlyItems) {
    if (!item.owner.trim() || !item.nextProofStep.trim()) {
      failures.push(
        `Dashboard-only item "${item.area}: ${item.item}" needs an owner and next proof step.`,
      )
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  }
}

export function createServiceReadinessProviders(input: {
  opsHealth: ServiceReadinessEvidence['opsHealth']
  // Diagnostic-only. Local smoke must never satisfy production provider proof.
  localConnectorSmoke?: NonNullable<ServiceReadinessEvidence['liveConnectorSmoke']>
  vercel: boolean
  stripeWebhookRegistered: boolean
  cloudflareDnsReady: boolean
}): ServiceReadinessEvidence['providers'] {
  const productionConnectors = input.opsHealth.authenticated ? input.opsHealth.connectors : []

  return {
    vercel: input.vercel,
    supabase: connectorOk(productionConnectors, 'supabase'),
    stripe: connectorOk(productionConnectors, 'stripe') && input.stripeWebhookRegistered,
    cloudflareDns: input.cloudflareDnsReady,
    sentry: connectorOk(productionConnectors, 'sentry'),
    awsS3Textract:
      connectorOk(productionConnectors, 's3') && connectorOk(productionConnectors, 'textract'),
    resend: connectorOk(productionConnectors, 'resend'),
    redis: connectorOk(productionConnectors, 'redis'),
  }
}

export function resolveOpsHealthAuth(env: OpsHealthAuthEnv): OpsHealthAuth {
  const cookie = env.OPS_HEALTH_COOKIE ?? env.SERVICE_READINESS_OPS_COOKIE
  if (cookie) {
    return {
      ok: true,
      headers: {
        'cache-control': 'no-store',
        cookie,
      },
    }
  }

  if (env.OPS_HEALTH_BEARER_TOKEN || env.SERVICE_READINESS_OPS_BEARER) {
    return {
      ok: false,
      status: 'unsupported_bearer_auth',
    }
  }

  return {
    ok: false,
    status: 'missing_auth',
  }
}

export function createServiceReadinessArchive(input: {
  generatedAt?: string
  evidence: ServiceReadinessEvidence
}): ServiceReadinessArchive {
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  return {
    schemaVersion: 1,
    branch: 'Branch 4: service readiness',
    generatedAt,
    evidence: input.evidence,
    result: evaluateServiceReadinessEvidence(input.evidence),
  }
}

function hasArchivedAuthenticatedOpsHealth(evidence: ServiceReadinessEvidence): boolean {
  if (!evidence.opsHealth.authenticated) return false
  if (evidence.opsHealth.status !== 'ok') return false
  if (!evidence.opsHealth.archivedAt) return false

  return evidence.opsHealth.connectors
    .filter((connector) => connector.required)
    .every((connector) => connector.ok)
}

function missingProviderEvidence(evidence: ServiceReadinessEvidence): string[] {
  return Object.entries(evidence.providers).flatMap(([key, present]) =>
    present ? [] : [providerLabels[key as keyof ServiceReadinessEvidence['providers']]],
  )
}

function connectorOk(connectors: ServiceReadinessConnector[], name: string): boolean {
  const connector = connectors.find((candidate) => candidate.name === name)
  return connector?.ok === true
}

function stripeWebhookRegistered(evidence: ServiceReadinessEvidence): boolean {
  const endpoint = evidence.stripe.webhookEndpoint
  if (!endpoint.registered) return false
  if (!endpoint.url?.startsWith('https://')) return false

  const subscribedEvents = new Set(endpoint.subscribedEvents)
  return requiredStripeWebhookEvents.every((event) => subscribedEvents.has(event))
}

function githubRulesetsReady(evidence: ServiceReadinessEvidence): boolean {
  return evidence.github.rulesetsConfigured && evidence.github.requiredStatusChecks.length >= 2
}

function githubSecurityReady(evidence: ServiceReadinessEvidence): boolean {
  return (
    evidence.github.dependabotConfigured &&
    evidence.github.vulnerabilityAlertsEnabled &&
    evidence.github.secretScanningEnabled
  )
}
