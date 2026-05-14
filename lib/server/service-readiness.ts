import 'server-only'

export type ServiceReadinessConnector = {
  name: string
  ok: boolean
  required: boolean
  errorCode?: string | null
}

export type ServiceReadinessProviders = {
  vercel: boolean
  supabase: boolean
  stripe: boolean
  cloudflareR2Extractor: boolean
  cloudflareDns: boolean
  sentry: boolean
  resend: boolean
  redis: boolean
}

export type ServiceReadinessCloudflareExtractorCheck = {
  ok: boolean
  key?: string | null
  error?: string | null
}

export type ServiceReadinessCloudflareExtractor = {
  configured: boolean
  status: string
  collectedAt: string | null
  url: string | null
  healthcheckStorageKey: string | null
  launchPath: {
    storageProvider: string | null
    extractionProvider: string | null
  }
  stagingProof: {
    id: string | null
    archivedAt: string | null
    sha: string | null
    validated: boolean
    evidencePath: string | null
    error: string | null
  }
  missingEnv: string[]
  checks: {
    jobStateBucket: ServiceReadinessCloudflareExtractorCheck
    uploadBucket: ServiceReadinessCloudflareExtractorCheck
    extractionQueue: ServiceReadinessCloudflareExtractorCheck
    kotlinExtractor: ServiceReadinessCloudflareExtractorCheck
  }
}

export type ServiceReadinessAcceptedGrayProvider = {
  provider: keyof ServiceReadinessProviders
  owner: string
  reason: string
  nextProofStep: string
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
  cloudflareExtractor: ServiceReadinessCloudflareExtractor
  providers: ServiceReadinessProviders
  acceptedGrayProviders?: ServiceReadinessAcceptedGrayProvider[]
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

export type CloudflareExtractorHealthStatusInput = {
  ok: boolean
  status: number
  bodyStatus?: unknown
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

const providerLabels: Record<keyof ServiceReadinessProviders, string> = {
  vercel: 'Vercel',
  supabase: 'Supabase',
  stripe: 'Stripe',
  cloudflareR2Extractor: 'Cloudflare R2 extractor',
  cloudflareDns: 'Cloudflare/DNS',
  sentry: 'Sentry',
  resend: 'Resend',
  redis: 'Redis',
}

const acceptedGrayBlockedProviders = new Set<keyof ServiceReadinessProviders>([
  'cloudflareR2Extractor',
])

const requiredStripeWebhookEvents = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

export function parseAcceptedGrayProviders(
  rawValue: string | undefined,
): ServiceReadinessAcceptedGrayProvider[] {
  if (!rawValue?.trim()) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    throw new Error('SERVICE_READINESS_ACCEPTED_GRAY_PROVIDERS must be a JSON array.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('SERVICE_READINESS_ACCEPTED_GRAY_PROVIDERS must be a JSON array.')
  }

  return parsed.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error(`Accepted-gray provider entry ${index + 1} must be an object.`)
    }

    const provider = readProviderKey(value.provider)
    if (acceptedGrayBlockedProviders.has(provider)) {
      throw new Error(`${providerLabels[provider]} proof cannot be accepted-gray.`)
    }

    return {
      provider,
      owner: readRequiredString(value.owner, `Accepted-gray provider "${provider}" owner`),
      reason: readRequiredString(value.reason, `Accepted-gray provider "${provider}" reason`),
      nextProofStep: readRequiredString(
        value.nextProofStep,
        `Accepted-gray provider "${provider}" nextProofStep`,
      ),
    }
  })
}

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

  for (const item of evidence.acceptedGrayProviders ?? []) {
    if (acceptedGrayBlockedProviders.has(item.provider)) {
      failures.push(
        `Accepted-gray provider "${providerLabels[item.provider]}" cannot bypass launch-required proof.`,
      )
      continue
    }

    if (!acceptedGrayProviderComplete(item)) {
      failures.push(
        `Accepted-gray provider "${providerLabels[item.provider]}" needs an owner, reason, and next proof step.`,
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
  cloudflareExtractor: ServiceReadinessCloudflareExtractor
  vercel: boolean
  stripeWebhookRegistered: boolean
  cloudflareDnsReady: boolean
}): ServiceReadinessEvidence['providers'] {
  const productionConnectors = input.opsHealth.authenticated ? input.opsHealth.connectors : []

  return {
    vercel: input.vercel,
    supabase: connectorOk(productionConnectors, 'supabase'),
    stripe: connectorOk(productionConnectors, 'stripe') && input.stripeWebhookRegistered,
    cloudflareR2Extractor: cloudflareR2ExtractorReady(input.cloudflareExtractor),
    cloudflareDns: input.cloudflareDnsReady,
    sentry: connectorOk(productionConnectors, 'sentry'),
    resend: connectorOk(productionConnectors, 'resend'),
    redis: connectorOk(productionConnectors, 'redis'),
  }
}

export function normalizeLiveConnectorSmokeForLaunchPath(
  smoke: NonNullable<ServiceReadinessEvidence['liveConnectorSmoke']>,
  launchPath: ServiceReadinessCloudflareExtractor['launchPath'],
): NonNullable<ServiceReadinessEvidence['liveConnectorSmoke']> {
  const cloudflareLaunchPath =
    launchPath.storageProvider === 'r2' && launchPath.extractionProvider === 'cloudflare-r2'
  const connectors = smoke.connectors.map((connector) =>
    cloudflareLaunchPath && (connector.name === 's3' || connector.name === 'textract')
      ? { ...connector, required: false }
      : connector,
  )
  const requiredFailure = connectors.some((connector) => connector.required && !connector.ok)

  return {
    ...smoke,
    status:
      smoke.status === 'failed' && connectors.length === 0
        ? 'failed'
        : requiredFailure
          ? 'degraded'
          : 'ok',
    connectors,
  }
}

export function createServiceReadinessDashboardOnlyItems(input: {
  opsHealth: ServiceReadinessEvidence['opsHealth']
  liveConnectorSmoke: NonNullable<ServiceReadinessEvidence['liveConnectorSmoke']>
  providers: ServiceReadinessEvidence['providers']
  cloudflareExtractor: ServiceReadinessCloudflareExtractor
  stripe: ServiceReadinessEvidence['stripe']
  dnsEvidence: ServiceReadinessEvidence['dns']
  github: ServiceReadinessEvidence['github']
}): ServiceReadinessEvidence['dashboardOnlyItems'] {
  const items: ServiceReadinessEvidence['dashboardOnlyItems'] = []

  if (!input.opsHealth.authenticated) {
    items.push({
      area: 'Ops health',
      item: 'Authenticated production /api/ops/health response',
      owner: 'Ops',
      nextProofStep:
        'Run this script with OPS_HEALTH_COOKIE from an owner/admin session and archive the resulting JSON.',
    })
  }

  if (!input.providers.cloudflareR2Extractor) {
    items.push({
      area: 'Cloudflare extraction',
      item: describeCloudflareExtractorGap(input.cloudflareExtractor),
      owner: 'Cloudflare admin',
      nextProofStep:
        'Deploy and prove the Cloudflare Worker/container path, seed the R2 healthcheck PDF, archive the staging extraction proof, and rerun service readiness with Cloudflare extractor env.',
    })
  }

  if (!input.stripe.webhookEndpoint.deliverySuccess) {
    items.push({
      area: 'Stripe',
      item: 'Webhook delivery success for subscribed billing events',
      owner: 'Ops',
      nextProofStep:
        'Complete or replay a required billing event in Stripe, confirm delivery_success=true, then rerun the service readiness archive.',
    })
  }

  if (!input.stripe.checkoutSubscriptionCreditGrant.proven) {
    items.push({
      area: 'Stripe',
      item: 'Checkout-to-subscription-to-credit-grant path',
      owner: 'Ops',
      nextProofStep:
        'Complete a test checkout, pass SERVICE_READINESS_STRIPE_CHECKOUT_SESSION_ID, and confirm a subscription_grant credit ledger row.',
    })
  }

  if (!input.dnsEvidence.cloudflareTemplateReconciled) {
    items.push({
      area: 'Cloudflare/DNS',
      item: `Zone template drift: ${input.dnsEvidence.drift.join('; ') || 'unresolved drift'}`,
      owner: 'Domain admin',
      nextProofStep:
        'Replace placeholder DKIM values from Resend, import or update Cloudflare DNS, and rerun the reconciliation.',
    })
  }

  if (!input.dnsEvidence.dnssecDsDelegated) {
    items.push({
      area: 'Cloudflare/DNS',
      item: 'DNSSEC DS delegation',
      owner: 'Domain admin',
      nextProofStep:
        'Copy Cloudflare DNSSEC DS values to the registrar, then rerun Resolve-DnsName prizmview.app -Type DS.',
    })
  }

  if (!input.github.environmentsProtected) {
    items.push({
      area: 'GitHub',
      item: 'Production environment protection',
      owner: 'Repo admin',
      nextProofStep:
        'Verify the production environment requires protected branches or reviewers, then rerun the governance check.',
    })
  }

  return items
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
  if (!evidence.opsHealth.archivedAt) return false

  return evidence.opsHealth.connectors.length > 0
}

function missingProviderEvidence(evidence: ServiceReadinessEvidence): string[] {
  const acceptedGrayProviders = acceptedGrayProviderSet(evidence)

  return (
    Object.entries(evidence.providers) as Array<[keyof ServiceReadinessProviders, boolean]>
  ).flatMap(([key, present]) =>
    present || acceptedGrayProviders.has(key) ? [] : [providerLabels[key]],
  )
}

function acceptedGrayProviderSet(
  evidence: ServiceReadinessEvidence,
): Set<keyof ServiceReadinessProviders> {
  const providers = new Set<keyof ServiceReadinessProviders>()

  for (const item of evidence.acceptedGrayProviders ?? []) {
    if (acceptedGrayProviderComplete(item) && !acceptedGrayBlockedProviders.has(item.provider)) {
      providers.add(item.provider)
    }
  }

  return providers
}

function acceptedGrayProviderComplete(item: ServiceReadinessAcceptedGrayProvider): boolean {
  return Boolean(item.owner.trim() && item.reason.trim() && item.nextProofStep.trim())
}

function readProviderKey(value: unknown): keyof ServiceReadinessProviders {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(providerLabels, value)) {
    throw new Error(`Unsupported accepted-gray provider "${String(value)}".`)
  }

  return value as keyof ServiceReadinessProviders
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`)
  }

  return value.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function resolveCloudflareExtractorHealthStatus(
  input: CloudflareExtractorHealthStatusInput,
): string {
  if (input.status === 401 || input.status === 403) return 'unauthorized'
  if (!input.ok) return `http_${input.status}`
  if (typeof input.bodyStatus === 'string') return input.bodyStatus
  return 'ok'
}

function cloudflareR2ExtractorReady(extractor: ServiceReadinessCloudflareExtractor): boolean {
  return (
    cloudflareExtractorLaunchPathSelected(extractor) &&
    extractor.configured &&
    extractor.status === 'ok' &&
    cloudflareExtractorChecksReady(extractor) &&
    cloudflareExtractorHealthcheckKeyMatches(extractor) &&
    cloudflareExtractorStagingProofReady(extractor)
  )
}

function describeCloudflareExtractorGap(extractor: ServiceReadinessCloudflareExtractor): string {
  if (!cloudflareExtractorLaunchPathSelected(extractor)) {
    return 'Production launch path is not set to Cloudflare R2 storage and extractor'
  }

  if (!extractor.configured) {
    const missing = extractor.missingEnv.length > 0 ? `: ${extractor.missingEnv.join(', ')}` : ''
    return `Cloudflare R2/container extractor configuration is incomplete${missing}`
  }

  const failedChecks = failedCloudflareExtractorCheckDetails(extractor)
  if (failedChecks) {
    return `Cloudflare R2/container extractor health is degraded: ${failedChecks}`
  }

  if (!cloudflareExtractorHealthcheckKeyMatches(extractor)) {
    return 'Cloudflare R2/container extractor healthcheck key does not match the upload bucket proof'
  }

  if (!cloudflareExtractorStagingProofReady(extractor)) {
    if (!cloudflareExtractorStagingProofMetadataPresent(extractor)) {
      return 'Cloudflare R2/container extractor staging proof is not archived'
    }

    return `Cloudflare R2/container extractor staging proof archive is invalid: ${extractor.stagingProof.error ?? 'unknown'}`
  }

  return 'Cloudflare R2/container extractor production proof'
}

function cloudflareExtractorLaunchPathSelected(
  extractor: ServiceReadinessCloudflareExtractor,
): boolean {
  return (
    extractor.launchPath.storageProvider === 'r2' &&
    extractor.launchPath.extractionProvider === 'cloudflare-r2'
  )
}

function cloudflareExtractorChecksReady(extractor: ServiceReadinessCloudflareExtractor): boolean {
  return Object.values(extractor.checks).every((check) => check.ok)
}

function cloudflareExtractorHealthcheckKeyMatches(
  extractor: ServiceReadinessCloudflareExtractor,
): boolean {
  const expectedKey = extractor.healthcheckStorageKey?.trim()
  return Boolean(expectedKey && extractor.checks.uploadBucket.key === expectedKey)
}

function cloudflareExtractorStagingProofReady(
  extractor: ServiceReadinessCloudflareExtractor,
): boolean {
  return (
    cloudflareExtractorStagingProofMetadataPresent(extractor) && extractor.stagingProof.validated
  )
}

function cloudflareExtractorStagingProofMetadataPresent(
  extractor: ServiceReadinessCloudflareExtractor,
): boolean {
  return Boolean(
    extractor.stagingProof.id?.trim() &&
    extractor.stagingProof.archivedAt?.trim() &&
    extractor.stagingProof.sha?.trim(),
  )
}

function failedCloudflareExtractorCheckDetails(
  extractor: ServiceReadinessCloudflareExtractor,
): string {
  return Object.entries(extractor.checks)
    .flatMap(([name, check]) => {
      if (check.ok) return []
      const error = check.error?.trim()
      return [`${name} failed${error ? `: ${error}` : ''}`]
    })
    .join('; ')
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
