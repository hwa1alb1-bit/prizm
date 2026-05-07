import 'server-only'

import { publicEnv, serverEnv } from '@/lib/shared/env'
import { getServiceRoleClient } from '../supabase'
import type { OpsMetricUnit, ProviderId } from './types'

export type ProviderMetric = {
  metricKey: string
  displayName: string
  used: number | null
  limit: number | null
  unit: OpsMetricUnit
  periodStart?: string | null
  periodEnd?: string | null
  sourceUrl: string
  required?: boolean
  errorCode?: string | null
}

export type ProviderAdapter = {
  id: ProviderId
  displayName: string
  sourceUrl: string
  staleAfterMinutes: number
  collect: () => Promise<ProviderMetric[]>
}

type ProviderDefinition = {
  id: ProviderId
  displayName: string
  category: string
  sourceUrl: string
  billingUrl: string
  managementUrl: string
  requiredEnv: string[]
  staleAfterMinutes?: number
}

const DAILY_COLLECTION_STALE_AFTER_MINUTES = 26 * 60

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'cloudflare',
    displayName: 'Cloudflare',
    category: 'edge',
    sourceUrl: 'https://dash.cloudflare.com',
    billingUrl: 'https://dash.cloudflare.com/?to=/:account/billing',
    managementUrl: 'https://dash.cloudflare.com',
    requiredEnv: [],
  },
  {
    id: 'vercel',
    displayName: 'Vercel',
    category: 'hosting',
    sourceUrl: 'https://vercel.com/dashboard',
    billingUrl: 'https://vercel.com/dashboard/usage',
    managementUrl: 'https://vercel.com/dashboard',
    requiredEnv: ['VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID'],
  },
  {
    id: 'upstash',
    displayName: 'Upstash',
    category: 'rate-limit',
    sourceUrl: 'https://console.upstash.com',
    billingUrl: 'https://console.upstash.com/account/billing',
    managementUrl: 'https://console.upstash.com',
    requiredEnv: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  },
  {
    id: 'supabase',
    displayName: 'Supabase',
    category: 'database',
    sourceUrl: 'https://supabase.com/dashboard/projects',
    billingUrl: 'https://supabase.com/dashboard/org/_/billing',
    managementUrl: 'https://supabase.com/dashboard/projects',
    requiredEnv: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_PROJECT_ID',
    ],
  },
  {
    id: 'sentry',
    displayName: 'Sentry',
    category: 'observability',
    sourceUrl: 'https://sentry.io',
    billingUrl: 'https://sentry.io/settings/billing/',
    managementUrl: 'https://sentry.io',
    requiredEnv: ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'],
  },
  {
    id: 'resend',
    displayName: 'Resend',
    category: 'email',
    sourceUrl: 'https://resend.com/emails',
    billingUrl: 'https://resend.com/settings/billing',
    managementUrl: 'https://resend.com/domains',
    requiredEnv: ['RESEND_API_KEY'],
  },
  {
    id: 'aws-mailboxes',
    displayName: 'AWS mailboxes',
    category: 'email',
    sourceUrl: 'https://console.aws.amazon.com/ses/home',
    billingUrl: 'https://console.aws.amazon.com/billing/home',
    managementUrl: 'https://console.aws.amazon.com/ses/home',
    requiredEnv: ['AWS_REGION'],
  },
  {
    id: 'stripe',
    displayName: 'Stripe',
    category: 'billing',
    sourceUrl: 'https://dashboard.stripe.com',
    billingUrl: 'https://dashboard.stripe.com/settings/billing',
    managementUrl: 'https://dashboard.stripe.com/customers',
    requiredEnv: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_OVERAGE_PAGE',
      'STRIPE_METER_OVERAGE',
    ],
  },
]

export function getProviderAdapters(): ProviderAdapter[] {
  return PROVIDER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    displayName: definition.displayName,
    sourceUrl: definition.sourceUrl,
    staleAfterMinutes: definition.staleAfterMinutes ?? 15,
    collect: async () =>
      definition.id === 'stripe'
        ? collectStripeProviderMetrics(definition)
        : collectCredentialMetrics(definition),
  }))
}

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_DEFINITIONS.some((definition) => definition.id === value)
}

export function getProviderStaleAfterMinutes(provider: ProviderId): number {
  return (
    PROVIDER_DEFINITIONS.find((definition) => definition.id === provider)?.staleAfterMinutes ??
    DAILY_COLLECTION_STALE_AFTER_MINUTES
  )
}

export function isProviderMetricRequired(metricKey: string): boolean {
  return metricKey !== 'usage_api'
}

export type ProviderLinkTarget = 'console' | 'billing' | 'management'

export function getProviderLink(provider: ProviderId, target: ProviderLinkTarget): string {
  const definition = PROVIDER_DEFINITIONS.find((candidate) => candidate.id === provider)
  if (!definition) throw new Error('provider_not_found')

  switch (target) {
    case 'billing':
      return definition.billingUrl
    case 'management':
      return definition.managementUrl
    case 'console':
      return definition.sourceUrl
  }
}

async function collectCredentialMetrics(definition: ProviderDefinition): Promise<ProviderMetric[]> {
  const missingKeys = definition.requiredEnv.filter((key) => !envValue(key))

  return [
    {
      metricKey: 'credential_gap',
      displayName: 'Missing credential count',
      used: missingKeys.length,
      limit: 1,
      unit: 'count',
      sourceUrl: definition.sourceUrl,
      required: true,
      errorCode: missingKeys.length > 0 ? 'configuration_missing' : null,
    },
    {
      metricKey: 'usage_api',
      displayName: `${definition.displayName} usage API`,
      used: null,
      limit: null,
      unit: 'status',
      sourceUrl: definition.sourceUrl,
      required: false,
      errorCode: null,
    },
  ]
}

async function collectStripeProviderMetrics(
  definition: ProviderDefinition,
): Promise<ProviderMetric[]> {
  const credentialMetrics = await collectCredentialMetrics(definition)
  const counts = await readStripeBillingCounts()

  return [
    ...credentialMetrics,
    ...buildStripeBillingMetrics({
      sourceUrl: definition.sourceUrl,
      failedWebhookEvents: counts.failedWebhookEvents,
      blockedSubscriptions: counts.blockedSubscriptions,
      activeSubscriptions: counts.activeSubscriptions,
    }),
  ]
}

export function buildStripeBillingMetrics(input: {
  sourceUrl: string
  failedWebhookEvents: number
  blockedSubscriptions: number
  activeSubscriptions: number
}): ProviderMetric[] {
  return [
    {
      metricKey: 'webhook_failures_24h',
      displayName: 'Webhook failures, 24h',
      used: input.failedWebhookEvents,
      limit: 1,
      unit: 'count',
      sourceUrl: input.sourceUrl,
      required: true,
      errorCode: input.failedWebhookEvents > 0 ? 'stripe_webhook_failures' : null,
    },
    {
      metricKey: 'blocked_subscription_count',
      displayName: 'Blocked subscriptions',
      used: input.blockedSubscriptions,
      limit: 1,
      unit: 'count',
      sourceUrl: input.sourceUrl,
      required: true,
      errorCode: input.blockedSubscriptions > 0 ? 'stripe_billing_blocked' : null,
    },
    {
      metricKey: 'active_subscription_count',
      displayName: 'Active subscriptions',
      used: input.activeSubscriptions,
      limit: null,
      unit: 'count',
      sourceUrl: input.sourceUrl,
      required: false,
      errorCode: null,
    },
  ]
}

async function readStripeBillingCounts(): Promise<{
  failedWebhookEvents: number
  blockedSubscriptions: number
  activeSubscriptions: number
}> {
  const client = getServiceRoleClient() as unknown as StripeBillingOpsClient
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [webhooks, blockedSubscriptions, activeSubscriptions] = await Promise.all([
    client
      .from('stripe_webhook_event')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since),
    client
      .from('subscription')
      .select('id', { count: 'exact', head: true })
      .in('status', ['past_due', 'incomplete']),
    client
      .from('subscription')
      .select('id', { count: 'exact', head: true })
      .in('status', ['trialing', 'active']),
  ])

  if (webhooks.error || blockedSubscriptions.error || activeSubscriptions.error) {
    throw new Error('stripe_billing_ops_read_failed')
  }

  return {
    failedWebhookEvents: webhooks.count ?? 0,
    blockedSubscriptions: blockedSubscriptions.count ?? 0,
    activeSubscriptions: activeSubscriptions.count ?? 0,
  }
}

function envValue(key: string): string | undefined {
  const publicValues = publicEnv as Record<string, string | undefined>
  const serverValues = serverEnv as Record<string, string | undefined>
  return publicValues[key] ?? serverValues[key]
}

type StripeBillingOpsClient = {
  from: (table: 'stripe_webhook_event' | 'subscription') => {
    select: (
      columns: 'id',
      options: { count: 'exact'; head: true },
    ) => {
      eq: (
        column: 'status',
        value: string,
      ) => {
        gte: (
          column: 'created_at',
          value: string,
        ) => Promise<{
          count: number | null
          error: { message: string } | null
        }>
      }
      in: (
        column: 'status',
        values: string[],
      ) => Promise<{
        count: number | null
        error: { message: string } | null
      }>
    }
  }
}
