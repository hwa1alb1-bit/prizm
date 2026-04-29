// Health endpoint. Reports per-connector status without leaking error detail.
// Default: shallow check (env + client construction).
// ?deep=true: live ping for connectors that have a cheap status call.

import { NextRequest } from 'next/server'
import { pingSupabase } from '@/lib/server/supabase'
import { pingStripe } from '@/lib/server/stripe'
import { pingS3 } from '@/lib/server/s3'
import { pingTextract } from '@/lib/server/textract'
import { pingResend } from '@/lib/server/resend'
import { pingRedis } from '@/lib/server/ratelimit'
import { pingSentry } from '@/lib/server/sentry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ConnectorStatus = {
  name: string
  ok: boolean
  required: boolean
  error?: string
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url)
  const deep = url.searchParams.get('deep') === 'true'

  const checks: Promise<ConnectorStatus>[] = [
    runCheck('supabase', true, deep ? pingSupabase : shallowOk),
    runCheck('stripe', true, deep ? pingStripe : shallowOk),
    runCheck('s3', true, deep ? pingS3 : shallowOk),
    runCheck('textract', true, pingTextract),
    runCheck('resend', false, deep ? pingResend : shallowOk),
    runCheck('redis', true, deep ? pingRedis : shallowOk),
    runCheck('sentry', false, async () => pingSentry()),
  ]

  const results = await Promise.all(checks)

  const requiredFailures = results.filter((r) => r.required && !r.ok)
  const status = requiredFailures.length === 0 ? 'ok' : 'degraded'
  const httpStatus = status === 'ok' ? 200 : 503

  return Response.json(
    {
      status,
      mode: deep ? 'deep' : 'shallow',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_GIT_SHA ?? 'dev',
      connectors: results,
    },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

async function runCheck(
  name: string,
  required: boolean,
  fn: () => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string },
): Promise<ConnectorStatus> {
  try {
    const result = await fn()
    return { name, ok: result.ok, required, error: result.error }
  } catch (err) {
    return {
      name,
      ok: false,
      required,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function shallowOk(): Promise<{ ok: boolean }> {
  return { ok: true }
}
