import 'server-only'

import {
  collectConnectorHealthSnapshot,
  type ConnectorProbe,
  type ConnectorProbeResult,
  type ConnectorStatus,
  type HealthSnapshot,
} from './connector-health'
import { pingRedis } from './ratelimit'
import { pingResend } from './resend'
import { pingS3 } from './s3'
import { pingSentry } from './sentry'
import { pingStripe } from './stripe'
import { pingSupabase } from './supabase'
import { pingTextract } from './textract'
import { publicEnv, serverEnv } from '../shared/env'

export type { ConnectorStatus, HealthSnapshot }

const CONNECTOR_PROBES: ConnectorProbe[] = [
  {
    name: 'supabase',
    required: true,
    config: () =>
      configured(
        Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      ),
    live: pingSupabase,
  },
  {
    name: 'stripe',
    required: true,
    config: () => configured(Boolean(serverEnv.STRIPE_SECRET_KEY)),
    auth: pingStripe,
  },
  {
    name: 's3',
    required: true,
    config: () => configured(Boolean(serverEnv.S3_UPLOAD_BUCKET)),
    live: pingS3,
  },
  {
    name: 'textract',
    required: true,
    config: () => configured(Boolean(serverEnv.AWS_REGION)),
    auth: pingTextract,
  },
  {
    name: 'resend',
    required: false,
    config: () => configured(Boolean(serverEnv.RESEND_API_KEY)),
    auth: pingResend,
  },
  {
    name: 'redis',
    required: true,
    config: () =>
      configured(Boolean(serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN)),
    auth: pingRedis,
  },
  {
    name: 'sentry',
    required: false,
    config: () => configured(Boolean(publicEnv.NEXT_PUBLIC_SENTRY_DSN)),
    auth: () => pingSentry(),
  },
]

export async function collectHealthSnapshot(input: {
  deep: boolean
  includeErrorCodes: boolean
}): Promise<HealthSnapshot> {
  return collectConnectorHealthSnapshot(CONNECTOR_PROBES, input)
}

function configured(ok: boolean): ConnectorProbeResult {
  return ok ? { ok: true } : { ok: false, error: 'configuration_missing' }
}
