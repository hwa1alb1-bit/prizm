import 'server-only'

export type ProviderId =
  | 'cloudflare'
  | 'vercel'
  | 'upstash'
  | 'supabase'
  | 'sentry'
  | 'resend'
  | 'aws-mailboxes'
  | 'stripe'

export type OpsStatus = 'green' | 'yellow' | 'red' | 'gray'
export type OpsFreshness = 'fresh' | 'stale' | 'failed'
export type OpsMetricUnit =
  | 'requests'
  | 'bytes'
  | 'emails'
  | 'events'
  | 'connections'
  | 'usd'
  | 'status'
  | 'count'

export type OpsUsageSnapshot = {
  provider: ProviderId
  metric: string
  displayName: string
  used: number | null
  limit: number | null
  unit: OpsMetricUnit
  periodStart: string | null
  periodEnd: string | null
  status: OpsStatus
  freshness: OpsFreshness
  sourceUrl: string
  collectedAt: string
  errorCode?: string | null
}
