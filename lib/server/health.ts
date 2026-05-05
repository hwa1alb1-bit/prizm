import 'server-only'

import { pingRedis } from './ratelimit'
import { pingResend } from './resend'
import { pingS3 } from './s3'
import { pingSentry } from './sentry'
import { pingStripe } from './stripe'
import { pingSupabase } from './supabase'
import { pingTextract } from './textract'
import { publicEnv, serverEnv } from '../shared/env'

type PingResult = { ok: boolean; error?: string }

type ConnectorCheck = {
  name: string
  required: boolean
  shallow: () => PingResult
  deep: () => Promise<PingResult> | PingResult
}

export type ConnectorStatus = {
  name: string
  ok: boolean
  required: boolean
  errorCode?: string
}

export type HealthSnapshot = {
  status: 'ok' | 'degraded'
  httpStatus: 200 | 503
  connectors: ConnectorStatus[]
}

const CONNECTOR_CHECKS: ConnectorCheck[] = [
  {
    name: 'supabase',
    required: true,
    shallow: () =>
      configured(
        Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      ),
    deep: pingSupabase,
  },
  {
    name: 'stripe',
    required: true,
    shallow: () => configured(Boolean(serverEnv.STRIPE_SECRET_KEY)),
    deep: pingStripe,
  },
  {
    name: 's3',
    required: true,
    shallow: () => configured(Boolean(serverEnv.S3_UPLOAD_BUCKET)),
    deep: pingS3,
  },
  {
    name: 'textract',
    required: true,
    shallow: () => configured(Boolean(serverEnv.AWS_REGION)),
    deep: pingTextract,
  },
  {
    name: 'resend',
    required: false,
    shallow: () => configured(Boolean(serverEnv.RESEND_API_KEY)),
    deep: pingResend,
  },
  {
    name: 'redis',
    required: true,
    shallow: () =>
      configured(Boolean(serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN)),
    deep: pingRedis,
  },
  {
    name: 'sentry',
    required: false,
    shallow: () => configured(Boolean(publicEnv.NEXT_PUBLIC_SENTRY_DSN)),
    deep: () => pingSentry(),
  },
]

export async function collectHealthSnapshot(input: {
  deep: boolean
  includeErrorCodes: boolean
}): Promise<HealthSnapshot> {
  const connectors = await Promise.all(
    CONNECTOR_CHECKS.map(async (check) => runCheck(check, input.deep, input.includeErrorCodes)),
  )
  const hasRequiredFailure = connectors.some((connector) => connector.required && !connector.ok)
  return {
    status: hasRequiredFailure ? 'degraded' : 'ok',
    httpStatus: hasRequiredFailure ? 503 : 200,
    connectors,
  }
}

async function runCheck(
  check: ConnectorCheck,
  deep: boolean,
  includeErrorCodes: boolean,
): Promise<ConnectorStatus> {
  try {
    const result = await (deep ? check.deep() : check.shallow())
    return {
      name: check.name,
      ok: result.ok,
      required: check.required,
      ...(includeErrorCodes && !result.ok ? { errorCode: classifyHealthError(result.error) } : {}),
    }
  } catch {
    return {
      name: check.name,
      ok: false,
      required: check.required,
      ...(includeErrorCodes ? { errorCode: 'connector_exception' } : {}),
    }
  }
}

function configured(ok: boolean): PingResult {
  return ok ? { ok: true } : { ok: false, error: 'configuration_missing' }
}

function classifyHealthError(error: string | undefined): string {
  if (!error) return 'connector_failed'
  const normalized = error.toLowerCase()
  if (normalized.includes('missing') || normalized.includes('configured')) {
    return 'configuration_missing'
  }
  if (normalized.includes('timeout')) return 'connector_timeout'
  if (normalized.includes('unauthorized') || normalized.includes('forbidden')) {
    return 'connector_auth_failed'
  }
  return 'connector_failed'
}
