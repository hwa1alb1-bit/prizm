import 'server-only'

import { publicEnv, serverEnv } from '@/lib/shared/env'
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
    requiredEnv: ['STRIPE_SECRET_KEY'],
  },
]

export function getProviderAdapters(): ProviderAdapter[] {
  return PROVIDER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    displayName: definition.displayName,
    sourceUrl: definition.sourceUrl,
    staleAfterMinutes: definition.staleAfterMinutes ?? 15,
    collect: async () => collectCredentialMetrics(definition),
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

function envValue(key: string): string | undefined {
  const publicValues = publicEnv as Record<string, string | undefined>
  const serverValues = serverEnv as Record<string, string | undefined>
  return publicValues[key] ?? serverValues[key]
}
