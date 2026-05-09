import { execFile } from 'node:child_process'
import dns from 'node:dns/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import {
  createServiceReadinessDashboardOnlyItems,
  createServiceReadinessArchive,
  createServiceReadinessProviders,
  resolveOpsHealthAuth,
  type ServiceReadinessConnector,
  type ServiceReadinessEvidence,
} from '@/lib/server/service-readiness'

const execFileAsync = promisify(execFile)

type JsonRecord = Record<string, unknown>

const DEFAULT_SITE_URL = 'https://prizmview.app'
const PUBLIC_DNS_SERVERS = ['1.1.1.1', '8.8.8.8']
const REQUIRED_STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

async function main(): Promise<void> {
  loadEnvFileIfExists(resolve(process.cwd(), '.env.local'))
  dns.setServers(PUBLIC_DNS_SERVERS)

  const generatedAt = new Date().toISOString()
  const config = readConfig()
  const evidence = await collectServiceReadinessEvidence(config, generatedAt)
  const archive = createServiceReadinessArchive({ generatedAt, evidence })
  const archivePath = writeArchive(archive, generatedAt)

  console.log(`Service readiness archive written to ${archivePath}`)
  console.log(JSON.stringify(archive.result, null, 2))

  if (!archive.result.ok && process.env.SERVICE_READINESS_ALLOW_INCOMPLETE !== '1') {
    process.exitCode = 1
  }
}

type ReadinessConfig = {
  siteUrl: string
  domain: string
  githubRepo: string
  vercelProject: string
  vercelScope: string
  stripeWebhookUrl: string
  cloudflareZonePath: string
}

function readConfig(): ReadinessConfig {
  const siteUrl = trimTrailingSlash(
    process.env.SERVICE_READINESS_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
  )
  const domain = process.env.SERVICE_READINESS_DOMAIN ?? new URL(siteUrl).hostname

  return {
    siteUrl,
    domain,
    githubRepo: process.env.SERVICE_READINESS_GITHUB_REPO ?? 'hwa1alb1-bit/prizm',
    vercelProject: process.env.SERVICE_READINESS_VERCEL_PROJECT ?? 'prizm',
    vercelScope: process.env.SERVICE_READINESS_VERCEL_SCOPE ?? 'plknokos-projects',
    stripeWebhookUrl:
      process.env.SERVICE_READINESS_STRIPE_WEBHOOK_URL ?? `${siteUrl}/api/v1/webhooks/stripe`,
    cloudflareZonePath:
      process.env.SERVICE_READINESS_CLOUDFLARE_ZONE_PATH ??
      resolve(process.cwd(), 'infra', 'cloudflare', 'prizmview-app.zone'),
  }
}

async function collectServiceReadinessEvidence(
  config: ReadinessConfig,
  generatedAt: string,
): Promise<ServiceReadinessEvidence> {
  const [opsHealth, liveConnectorSmoke, vercel, stripe, dnsEvidence, github] = await Promise.all([
    collectOpsHealth(config, generatedAt),
    collectLiveConnectorSmoke(generatedAt),
    collectVercelEvidence(config),
    collectStripeEvidence(config),
    collectDnsEvidence(config),
    collectGithubEvidence(config),
  ])
  const providers = createServiceReadinessProviders({
    opsHealth,
    localConnectorSmoke: liveConnectorSmoke,
    vercel,
    stripeWebhookRegistered: stripe.webhookEndpoint.registered,
    cloudflareDnsReady: dnsEvidence.dnssecDsDelegated && dnsEvidence.cloudflareTemplateReconciled,
  })

  return {
    opsHealth,
    liveConnectorSmoke,
    providers,
    stripe,
    dns: dnsEvidence,
    github,
    dashboardOnlyItems: createServiceReadinessDashboardOnlyItems({
      opsHealth,
      liveConnectorSmoke,
      providers,
      stripe,
      dnsEvidence,
      github,
    }),
  }
}

async function collectLiveConnectorSmoke(
  generatedAt: string,
): Promise<NonNullable<ServiceReadinessEvidence['liveConnectorSmoke']>> {
  try {
    const { collectHealthSnapshot } = await import('@/lib/server/health')
    const snapshot = await collectHealthSnapshot({ deep: true, includeErrorCodes: true })
    return {
      status: snapshot.status,
      collectedAt: generatedAt,
      connectors: snapshot.connectors,
    }
  } catch {
    return {
      status: 'failed',
      collectedAt: generatedAt,
      connectors: [],
    }
  }
}

async function collectOpsHealth(
  config: ReadinessConfig,
  generatedAt: string,
): Promise<ServiceReadinessEvidence['opsHealth']> {
  const auth = resolveOpsHealthAuth(process.env)

  if (!auth.ok) {
    return {
      authenticated: false,
      status: auth.status,
      archivedAt: null,
      connectors: [],
    }
  }

  try {
    const response = await fetch(`${config.siteUrl}/api/ops/health`, { headers: auth.headers })
    const body = (await response.json().catch(() => ({}))) as JsonRecord
    const connectors = Array.isArray(body.connectors) ? body.connectors.map(normalizeConnector) : []
    const authenticated = response.ok || (response.status === 503 && connectors.length > 0)

    return {
      authenticated,
      status: typeof body.status === 'string' ? body.status : `http_${response.status}`,
      archivedAt: authenticated ? generatedAt : null,
      connectors,
    }
  } catch {
    return {
      authenticated: false,
      status: 'request_failed',
      archivedAt: null,
      connectors: [],
    }
  }
}

async function collectVercelEvidence(config: ReadinessConfig): Promise<boolean> {
  try {
    const output = await runNpx([
      'vercel',
      'ls',
      config.vercelProject,
      '--scope',
      config.vercelScope,
      '--format=json',
      '--environment',
      'production',
      '--status',
      'READY',
    ])
    const parsed = parseJsonObject<{
      deployments?: Array<{ state?: string; target?: string | null }>
    }>(output)

    return (
      parsed.deployments?.some(
        (deployment) => deployment.state === 'READY' && deployment.target === 'production',
      ) ?? false
    )
  } catch {
    return false
  }
}

async function collectStripeEvidence(
  config: ReadinessConfig,
): Promise<ServiceReadinessEvidence['stripe']> {
  const fallback: ServiceReadinessEvidence['stripe'] = {
    webhookEndpoint: {
      registered: false,
      url: config.stripeWebhookUrl,
      subscribedEvents: [],
      deliverySuccess: false,
    },
    customerPortal: { configured: false },
    checkoutSubscriptionCreditGrant: { proven: false },
  }

  if (!process.env.STRIPE_SECRET_KEY) return fallback

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const [webhookEndpoint, customerPortal, checkoutGrant] = await Promise.all([
      collectStripeWebhookEvidence(stripe, config),
      collectStripeCustomerPortalEvidence(stripe),
      collectCheckoutCreditGrantEvidence(stripe),
    ])

    return {
      webhookEndpoint,
      customerPortal,
      checkoutSubscriptionCreditGrant: checkoutGrant,
    }
  } catch {
    return fallback
  }
}

async function collectStripeWebhookEvidence(
  stripe: Stripe,
  config: ReadinessConfig,
): Promise<ServiceReadinessEvidence['stripe']['webhookEndpoint']> {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  const endpoint = endpoints.data.find((candidate) => candidate.url === config.stripeWebhookUrl)
  const subscribedEvents = endpoint?.enabled_events ?? []
  const deliveryEvents = await stripe.events.list({
    limit: 10,
    delivery_success: true,
    types: REQUIRED_STRIPE_WEBHOOK_EVENTS,
  })

  return {
    registered: Boolean(endpoint),
    url: endpoint?.url ?? config.stripeWebhookUrl,
    subscribedEvents,
    deliverySuccess: deliveryEvents.data.length > 0,
  }
}

async function collectStripeCustomerPortalEvidence(
  stripe: Stripe,
): Promise<ServiceReadinessEvidence['stripe']['customerPortal']> {
  const configurations = await stripe.billingPortal.configurations.list({
    active: true,
    limit: 10,
  })

  return {
    configured: configurations.data.length > 0,
  }
}

async function collectCheckoutCreditGrantEvidence(
  stripe: Stripe,
): Promise<ServiceReadinessEvidence['stripe']['checkoutSubscriptionCreditGrant']> {
  const sessionId =
    process.env.SERVICE_READINESS_STRIPE_CHECKOUT_SESSION_ID ??
    process.env.STRIPE_CHECKOUT_SESSION_ID

  if (!sessionId) return { proven: false }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  })
  const subscription =
    typeof session.subscription === 'string' ? null : (session.subscription ?? null)
  const workspaceId =
    session.client_reference_id ??
    subscription?.metadata?.workspace_id ??
    session.metadata?.workspace_id

  if (session.status !== 'complete' || !workspaceId) return { proven: false }

  return {
    proven: await hasSubscriptionGrantCredit(workspaceId),
  }
}

async function hasSubscriptionGrantCredit(workspaceId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return false

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client
    .from('credit_ledger')
    .select('id, delta')
    .eq('workspace_id', workspaceId)
    .eq('reason', 'subscription_grant')
    .gt('delta', 0)
    .limit(1)

  return !error && Array.isArray(data) && data.length > 0
}

async function collectDnsEvidence(
  config: ReadinessConfig,
): Promise<ServiceReadinessEvidence['dns']> {
  const [dnssecDsDelegated, drift] = await Promise.all([
    hasPublicDsRecord(config.domain),
    reconcileCloudflareTemplate(config),
  ])

  return {
    dnssecDsDelegated,
    cloudflareTemplateReconciled: drift.length === 0,
    drift,
  }
}

async function hasPublicDsRecord(domain: string): Promise<boolean> {
  return (await resolvePublicDsRecords(domain)).length > 0
}

async function resolvePublicDsRecords(domain: string): Promise<string[]> {
  if (!/^[a-z0-9.-]+$/i.test(domain)) return []

  if (process.platform === 'win32') {
    try {
      const output = await runText('powershell.exe', [
        '-NoProfile',
        '-Command',
        `$ErrorActionPreference='Stop'; Resolve-DnsName -Name '${domain}' -Type DS | ConvertTo-Json -Compress`,
      ])
      const parsed = JSON.parse(output) as unknown
      const records = Array.isArray(parsed) ? parsed : [parsed]
      return records
        .filter(
          (record) =>
            isRecord(record) &&
            (record.Type === 'DS' || record.Type === 43 || record.QueryType === 43),
        )
        .map((record) => JSON.stringify(record))
    } catch {
      return []
    }
  }

  try {
    const output = await runText('dig', ['+short', 'DS', domain])
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function reconcileCloudflareTemplate(config: ReadinessConfig): Promise<string[]> {
  if (!existsSync(config.cloudflareZonePath)) {
    return [`${config.cloudflareZonePath} is missing`]
  }

  const zone = readFileSync(config.cloudflareZonePath, 'utf8')
  const drift: string[] = []

  if (zone.includes('REPLACE_WITH_RESEND_DKIM_VALUE')) {
    drift.push('resend._domainkey TXT is still the placeholder value')
  }

  await expectDnsRecord(drift, 'A', config.domain, '76.76.21.21', () => dns.resolve4(config.domain))
  await expectDnsRecord(drift, 'CNAME', `www.${config.domain}`, 'cname.vercel-dns.com', () =>
    dns.resolveCname(`www.${config.domain}`),
  )
  await expectDnsRecord(
    drift,
    'MX',
    `send.${config.domain}`,
    'feedback-smtp.us-east-1.amazonses.com',
    async () => (await dns.resolveMx(`send.${config.domain}`)).map((record) => record.exchange),
  )
  await expectDnsRecord(drift, 'TXT', `send.${config.domain}`, 'include:amazonses.com', async () =>
    flattenTxtRecords(await dns.resolveTxt(`send.${config.domain}`)),
  )
  await expectDnsRecord(drift, 'TXT', `_dmarc.${config.domain}`, 'v=DMARC1', async () =>
    flattenTxtRecords(await dns.resolveTxt(`_dmarc.${config.domain}`)),
  )

  return drift
}

async function expectDnsRecord(
  drift: string[],
  type: string,
  host: string,
  expected: string,
  resolveRecords: () => Promise<string[]>,
): Promise<void> {
  try {
    const records = await resolveRecords()
    const normalized = records.map((record) => record.toLowerCase())
    if (!normalized.some((record) => record.includes(expected.toLowerCase()))) {
      drift.push(`${host} ${type} does not include ${expected}`)
    }
  } catch {
    drift.push(`${host} ${type} is not resolvable`)
  }
}

async function collectGithubEvidence(
  config: ReadinessConfig,
): Promise<ServiceReadinessEvidence['github']> {
  const fallback: ServiceReadinessEvidence['github'] = {
    repoPublic: false,
    rulesetsConfigured: false,
    requiredStatusChecks: [],
    dependabotConfigured: existsSync(resolve(process.cwd(), '.github', 'dependabot.yml')),
    vulnerabilityAlertsEnabled: false,
    secretScanningEnabled: false,
    environmentsProtected: false,
  }

  try {
    const [repo, rulesetSummaries, environments, vulnerabilityAlerts, automatedSecurityFixes] =
      await Promise.all([
        ghJson<JsonRecord>(`repos/${config.githubRepo}`),
        ghJson<Array<JsonRecord>>(
          `repos/${config.githubRepo}/rulesets?includes_parents=true`,
        ).catch(() => []),
        ghJson<{ environments?: Array<JsonRecord> }>(
          `repos/${config.githubRepo}/environments`,
        ).catch(() => ({ environments: [] })),
        ghEndpointEnabled(`repos/${config.githubRepo}/vulnerability-alerts`),
        ghEndpointEnabled(`repos/${config.githubRepo}/automated-security-fixes`),
      ])
    const rulesets = await hydrateRulesets(config.githubRepo, rulesetSummaries)
    const requiredStatusChecks = extractRequiredStatusChecks(rulesets)

    return {
      repoPublic: repo.visibility === 'public' || repo.private === false,
      rulesetsConfigured: requiredStatusChecks.length >= 2,
      requiredStatusChecks,
      dependabotConfigured: fallback.dependabotConfigured && automatedSecurityFixes,
      vulnerabilityAlertsEnabled: vulnerabilityAlerts,
      secretScanningEnabled: securityFeatureEnabled(repo, 'secret_scanning'),
      environmentsProtected: environmentsProtected(environments.environments ?? []),
    }
  } catch {
    return fallback
  }
}

async function hydrateRulesets(
  repo: string,
  rulesets: Array<JsonRecord>,
): Promise<Array<JsonRecord>> {
  return Promise.all(
    rulesets.map(async (ruleset) => {
      if (Array.isArray(ruleset.rules)) return ruleset
      if (typeof ruleset.id !== 'number') return ruleset

      return ghJson<JsonRecord>(`repos/${repo}/rulesets/${ruleset.id}`).catch(() => ruleset)
    }),
  )
}

function normalizeConnector(value: unknown): ServiceReadinessConnector {
  const record = isRecord(value) ? value : {}

  return {
    name: typeof record.name === 'string' ? record.name : 'unknown',
    ok: record.ok === true,
    required: record.required === true,
    errorCode: typeof record.errorCode === 'string' ? record.errorCode : null,
  }
}

function flattenTxtRecords(records: string[][]): string[] {
  return records.map((parts) => parts.join(''))
}

function extractRequiredStatusChecks(rulesets: Array<JsonRecord>): string[] {
  const checks = new Set<string>()

  for (const ruleset of rulesets) {
    if (ruleset.enforcement !== 'active') continue
    const rules = Array.isArray(ruleset.rules) ? ruleset.rules : []

    for (const rule of rules) {
      if (!isRecord(rule) || rule.type !== 'required_status_checks') continue
      const parameters = isRecord(rule.parameters) ? rule.parameters : {}
      const contexts = Array.isArray(parameters.required_status_checks)
        ? parameters.required_status_checks
        : []

      for (const context of contexts) {
        if (isRecord(context) && typeof context.context === 'string') {
          checks.add(context.context)
        }
      }
    }
  }

  return [...checks].sort()
}

function securityFeatureEnabled(repo: JsonRecord, feature: string): boolean {
  const securityAndAnalysis = isRecord(repo.security_and_analysis) ? repo.security_and_analysis : {}
  const details = isRecord(securityAndAnalysis[feature]) ? securityAndAnalysis[feature] : {}
  return details.status === 'enabled'
}

function environmentsProtected(environments: Array<JsonRecord>): boolean {
  const protectedNames = new Set(['production', 'staging'])
  const matching = environments.filter((environment) =>
    protectedNames.has(String(environment.name).toLowerCase()),
  )

  return (
    matching.length === protectedNames.size &&
    matching.every((environment) => {
      const rules = Array.isArray(environment.protection_rules) ? environment.protection_rules : []
      const branchPolicy = isRecord(environment.deployment_branch_policy)
        ? environment.deployment_branch_policy
        : null
      return (
        rules.length > 0 ||
        branchPolicy?.protected_branches === true ||
        branchPolicy?.custom_branch_policies === true
      )
    })
  )
}

async function ghJson<T>(endpoint: string): Promise<T> {
  return parseJsonObject<T>(await runText('gh', ['api', endpoint]))
}

async function ghEndpointEnabled(endpoint: string): Promise<boolean> {
  try {
    await runText('gh', ['api', endpoint, '--silent'])
    return true
  } catch {
    return false
  }
}

function writeArchive(archive: unknown, generatedAt: string): string {
  const outputDir = resolve(process.cwd(), 'docs', 'evidence', 'service-readiness')
  mkdirSync(outputDir, { recursive: true })
  const filename = `${generatedAt.replace(/[:.]/g, '-')}Z.json`.replace('ZZ', 'Z')
  const outputPath = join(outputDir, filename)
  writeFileSync(outputPath, `${JSON.stringify(archive, null, 2)}\n`, 'utf8')
  return outputPath
}

function loadEnvFileIfExists(filePath: string): void {
  if (!existsSync(filePath)) return

  const content = readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    process.env[key] ??= value
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function parseJsonObject<T>(output: string): T {
  try {
    return JSON.parse(output) as T
  } catch {
    const start = output.indexOf('{')
    const end = output.lastIndexOf('}')

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Command output did not contain a JSON object.')
    }

    return JSON.parse(output.slice(start, end + 1)) as T
  }
}

async function runText(command: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  return stdout.trim()
}

async function runNpx(args: string[]): Promise<string> {
  if (process.platform !== 'win32') return runText('npx', args)

  return runText('cmd.exe', ['/d', '/s', '/c', ['npx', ...args].join(' ')])
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
