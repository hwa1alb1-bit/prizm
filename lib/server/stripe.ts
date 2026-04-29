// Stripe SDK wrapper. Lazy-initialized singleton to avoid eager construction during build.

import 'server-only'

import Stripe from 'stripe'
import { serverEnv, assertServerEnv } from '../shared/env'

let cached: Stripe | null = null

export function getStripeClient(): Stripe {
  assertServerEnv(['STRIPE_SECRET_KEY'])
  if (cached) return cached
  const key = serverEnv.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  cached = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: { name: 'prizm', version: '0.1.0', url: 'https://prizmview.app' },
  })
  return cached
}

export async function pingStripe(): Promise<{ ok: boolean; error?: string }> {
  try {
    const stripe = getStripeClient()
    await stripe.balance.retrieve()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
