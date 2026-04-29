// Resend transactional email wrapper. Domain prizmview.app must be verified
// in Resend with SPF, DKIM, and DMARC records before sending in production.

import 'server-only'

import { Resend } from 'resend'
import { serverEnv, assertServerEnv } from '../shared/env'

let cached: Resend | null = null

export function getResendClient(): Resend {
  assertServerEnv(['RESEND_API_KEY'])
  if (cached) return cached
  const key = serverEnv.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY not configured')
  }
  cached = new Resend(key)
  return cached
}

export function getFromAddress(): string {
  return serverEnv.RESEND_FROM_EMAIL
}

export async function pingResend(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getResendClient()
    const result = await client.domains.list()
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
