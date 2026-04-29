// Typed environment variable loader. Validates required keys at module load.
// Server-only vars throw at import time if missing in production.
// Public vars (NEXT_PUBLIC_*) are validated separately and safe for client bundles.

import { z } from 'zod'

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const isProd = process.env.NODE_ENV === 'production'

// Public schema (NEXT_PUBLIC_*). Bundled into client. Never put secrets here.
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
})

// Server-only schema. Never bundle these into the client.
// Marked optional so dev and build do not crash when keys missing.
// Production runtime should fail loud via the assertServerEnv helper below.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_UPLOAD_BUCKET: z.string().default('prizm-uploads-dev'),
  S3_KMS_KEY_ID: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STARTER_ANNUAL: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('noreply@prizmview.app'),

  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  CRON_SECRET: z.string().optional(),
})

const publicResult = publicSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
})

if (!publicResult.success) {
  throw new Error(
    `Invalid public environment variables:\n${JSON.stringify(publicResult.error.format(), null, 2)}`,
  )
}

const serverResult = serverSchema.safeParse(process.env)

if (!serverResult.success) {
  throw new Error(
    `Invalid server environment variables:\n${JSON.stringify(serverResult.error.format(), null, 2)}`,
  )
}

export const publicEnv = publicResult.data
export const serverEnv = serverResult.data

// Helper for connectors. Call inside server code paths to fail fast on missing keys.
// Skips strict checks during build to avoid breaking next build when keys not yet wired.
export function assertServerEnv<K extends keyof typeof serverEnv>(keys: readonly K[]): void {
  if (isBuild) return
  const missing = keys.filter((k) => !serverEnv[k])
  if (missing.length === 0) return
  if (isProd) {
    throw new Error(`Missing required server env vars: ${missing.join(', ')}`)
  }
  // Dev: warn but do not throw. Lets local dev work without every key configured.
  // eslint-disable-next-line no-console
  console.warn(`[env] Missing server env vars (dev): ${missing.join(', ')}`)
}

export const isProduction = isProd
