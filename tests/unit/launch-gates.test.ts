import { describe, expect, it } from 'vitest'
import {
  evaluateLaunchReadiness,
  evaluateLiveConnectorSmokeGate,
  formatLaunchGateReport,
} from '@/lib/server/launch-gates'

describe('launch readiness gates', () => {
  it('fails closed when staging is missing launch-critical environment variables', () => {
    const result = evaluateLaunchReadiness({
      target: 'staging',
      env: {
        NEXT_PUBLIC_SITE_URL: 'https://staging.prizmview.app',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.failures.map((failure) => failure.id)).toEqual(
      expect.arrayContaining([
        'supabase-configured',
        'aws-oidc-configured',
        's3-upload-bucket-configured',
        'stripe-configured',
        'resend-configured',
        'sentry-configured',
        'upstash-configured',
        'cron-secret-configured',
      ]),
    )
  })

  it('passes when every launch-critical staging variable is present', () => {
    const result = evaluateLaunchReadiness({
      target: 'staging',
      env: {
        NEXT_PUBLIC_SITE_URL: 'https://staging.prizmview.app',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        AWS_REGION: 'us-east-1',
        AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/prizm-vercel',
        S3_UPLOAD_BUCKET: 'prizm-uploads-staging',
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
        STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_monthly',
        STRIPE_PRICE_STARTER_ANNUAL: 'price_starter_annual',
        STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
        STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual',
        RESEND_API_KEY: 're_123',
        RESEND_FROM_EMAIL: 'noreply@prizmview.app',
        NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1',
        SENTRY_AUTH_TOKEN: 'sentry-token',
        SENTRY_ORG: 'prizm',
        SENTRY_PROJECT: 'web',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        CRON_SECRET: 'cron-secret',
      },
    })

    expect(result).toMatchObject({ ok: true, target: 'staging', failures: [] })
  })

  it('passes with runtime launch credentials without management-only Supabase token or optional S3 KMS key', () => {
    const result = evaluateLaunchReadiness({
      target: 'production',
      env: {
        NEXT_PUBLIC_SITE_URL: 'https://prizmview.app',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        AWS_REGION: 'us-east-1',
        AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/prizm-vercel',
        S3_UPLOAD_BUCKET: 'prizm-uploads-production',
        STRIPE_SECRET_KEY: 'sk_live_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
        STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_monthly',
        STRIPE_PRICE_STARTER_ANNUAL: 'price_starter_annual',
        STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
        STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual',
        RESEND_API_KEY: 're_123',
        RESEND_FROM_EMAIL: 'noreply@prizmview.app',
        NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1',
        SENTRY_AUTH_TOKEN: 'sentry-token',
        SENTRY_ORG: 'prizm',
        SENTRY_PROJECT: 'web',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        CRON_SECRET: 'cron-secret',
      },
    })

    expect(result).toMatchObject({ ok: true, target: 'production', failures: [] })
  })

  it('fails closed before a production Cloudflare R2 extraction launch has runtime config and staging proof', () => {
    const result = evaluateLaunchReadiness({
      target: 'production',
      env: {
        ...completeProductionEnv(),
        DOCUMENT_STORAGE_PROVIDER: 's3',
        DOCUMENT_EXTRACTION_PROVIDER: 'cloudflare-r2',
      },
    })

    expect(result.failures).toEqual(
      expect.arrayContaining([
        {
          id: 'cloudflare-r2-storage-provider',
          title: 'Cloudflare R2 extraction uses R2 document storage',
          envKeys: ['DOCUMENT_STORAGE_PROVIDER'],
          reason: 'invalid',
        },
        {
          id: 'cloudflare-r2-extraction-configured',
          title: 'Cloudflare R2 storage and extractor runtime are configured',
          envKeys: [
            'R2_ACCOUNT_ID',
            'R2_UPLOAD_BUCKET',
            'R2_ACCESS_KEY_ID',
            'R2_SECRET_ACCESS_KEY',
            'CLOUDFLARE_EXTRACTOR_URL',
            'CLOUDFLARE_EXTRACTOR_TOKEN',
            'CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY',
          ],
          reason: 'missing',
        },
        {
          id: 'cloudflare-r2-staging-proof-archived',
          title: 'Cloudflare R2 extraction has a current staging proof archive',
          envKeys: [
            'CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID',
            'CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT',
            'CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA',
          ],
          reason: 'missing',
        },
      ]),
    )
  })

  it('passes the production Cloudflare R2 extraction launch gate after staging proof is archived', () => {
    const result = evaluateLaunchReadiness({
      target: 'production',
      env: {
        ...completeProductionEnv(),
        DOCUMENT_STORAGE_PROVIDER: 'r2',
        DOCUMENT_EXTRACTION_PROVIDER: 'cloudflare-r2',
        R2_ACCOUNT_ID: 'cloudflare-account',
        R2_UPLOAD_BUCKET: 'prizm-r2-uploads-production',
        R2_ACCESS_KEY_ID: 'r2-access-key',
        R2_SECRET_ACCESS_KEY: 'r2-secret-key',
        CLOUDFLARE_EXTRACTOR_URL: 'https://prizm-cloudflare-extractor.example.workers.dev',
        CLOUDFLARE_EXTRACTOR_TOKEN: 'extractor-token',
        CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY: 'probes/known-good.pdf',
        CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID: 'cf-extraction-staging-2026-05-13',
        CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT: '2026-05-13T19:00:00.000Z',
        CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA: 'a9b7cce',
      },
    })

    expect(result).toMatchObject({ ok: true, target: 'production', failures: [] })
  })

  it('rejects the legacy kotlin_worker production flag', () => {
    const result = evaluateLaunchReadiness({
      target: 'production',
      env: {
        ...completeProductionEnv(),
        PRIZM_EXTRACTION_ENGINE: 'kotlin_worker',
      },
    })

    expect(result.failures).toContainEqual({
      id: 'legacy-kotlin-worker-production-disabled',
      title: 'Legacy kotlin_worker production flag stays disabled',
      envKeys: ['PRIZM_EXTRACTION_ENGINE'],
      reason: 'invalid',
    })
  })

  it('requires explicit safe launch-smoke flags before live connector checks run', () => {
    const result = evaluateLiveConnectorSmokeGate({
      LIVE_CONNECTOR_SMOKE: '1',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3030',
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual([
      {
        id: 'launch-target-configured',
        title: 'Live connector smoke target is explicitly staging or production',
        envKeys: ['LAUNCH_GATE_TARGET'],
        reason: 'missing',
      },
      {
        id: 'launch-site-url-secure',
        title: 'Live connector smoke site URL uses HTTPS',
        envKeys: ['NEXT_PUBLIC_SITE_URL'],
        reason: 'invalid',
      },
    ])
  })

  it('formats missing launch gates without exposing environment values', () => {
    const result = evaluateLaunchReadiness({
      target: 'production',
      env: {
        NEXT_PUBLIC_SITE_URL: 'https://prizmview.app',
        STRIPE_SECRET_KEY: 'sk_live_secret_should_not_print',
      },
    })

    const report = formatLaunchGateReport(result)

    expect(report).toContain('Launch gate failed for production')
    expect(report).toContain('Missing: NEXT_PUBLIC_SUPABASE_URL')
    expect(report).not.toContain('sk_live_secret_should_not_print')
  })

  it('requires Stripe plan price IDs so webhook plan mapping cannot fall back to free', () => {
    const result = evaluateLaunchReadiness({
      target: 'production',
      env: {
        NEXT_PUBLIC_SITE_URL: 'https://prizmview.app',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        AWS_REGION: 'us-east-1',
        AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/prizm-vercel',
        S3_UPLOAD_BUCKET: 'prizm-uploads-production',
        STRIPE_SECRET_KEY: 'sk_live_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
        RESEND_API_KEY: 're_123',
        RESEND_FROM_EMAIL: 'noreply@prizmview.app',
        NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1',
        SENTRY_AUTH_TOKEN: 'sentry-token',
        SENTRY_ORG: 'prizm',
        SENTRY_PROJECT: 'web',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        CRON_SECRET: 'cron-secret',
      },
    })

    expect(result.failures).toContainEqual({
      id: 'stripe-configured',
      title: 'Stripe checkout, webhook, public key, and plan prices are configured',
      envKeys: [
        'STRIPE_PRICE_STARTER_MONTHLY',
        'STRIPE_PRICE_STARTER_ANNUAL',
        'STRIPE_PRICE_PRO_MONTHLY',
        'STRIPE_PRICE_PRO_ANNUAL',
      ],
      reason: 'missing',
    })
  })

  it('rejects non-HTTPS staging and production site URLs', () => {
    const result = evaluateLaunchReadiness({
      target: 'staging',
      env: {
        NEXT_PUBLIC_SITE_URL: 'http://staging.prizmview.app',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        AWS_REGION: 'us-east-1',
        AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/prizm-vercel',
        S3_UPLOAD_BUCKET: 'prizm-uploads-staging',
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
        STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_monthly',
        STRIPE_PRICE_STARTER_ANNUAL: 'price_starter_annual',
        STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
        STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual',
        RESEND_API_KEY: 're_123',
        RESEND_FROM_EMAIL: 'noreply@prizmview.app',
        NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1',
        SENTRY_AUTH_TOKEN: 'sentry-token',
        SENTRY_ORG: 'prizm',
        SENTRY_PROJECT: 'web',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        CRON_SECRET: 'cron-secret',
      },
    })

    expect(result.failures).toContainEqual({
      id: 'launch-site-url-secure',
      title: 'Launch site URL uses HTTPS',
      envKeys: ['NEXT_PUBLIC_SITE_URL'],
      reason: 'invalid',
    })
  })

  it('rejects static AWS credentials for staging and production launch gates', () => {
    const result = evaluateLaunchReadiness({
      target: 'production',
      env: {
        NEXT_PUBLIC_SITE_URL: 'https://prizmview.app',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        AWS_REGION: 'us-east-1',
        AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/prizm-vercel',
        AWS_ACCESS_KEY_ID: 'static-key',
        AWS_SECRET_ACCESS_KEY: 'static-secret',
        S3_UPLOAD_BUCKET: 'prizm-uploads-production',
        STRIPE_SECRET_KEY: 'sk_live_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
        STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_monthly',
        STRIPE_PRICE_STARTER_ANNUAL: 'price_starter_annual',
        STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
        STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual',
        RESEND_API_KEY: 're_123',
        RESEND_FROM_EMAIL: 'noreply@prizmview.app',
        NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1',
        SENTRY_AUTH_TOKEN: 'sentry-token',
        SENTRY_ORG: 'prizm',
        SENTRY_PROJECT: 'web',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        CRON_SECRET: 'cron-secret',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContainEqual({
      id: 'aws-static-keys-absent',
      title: 'Static AWS access keys are absent for managed launch environments',
      envKeys: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
      reason: 'invalid',
    })
  })
})

function completeProductionEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_SITE_URL: 'https://prizmview.app',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    AWS_REGION: 'us-east-1',
    AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/prizm-vercel',
    S3_UPLOAD_BUCKET: 'prizm-uploads-production',
    STRIPE_SECRET_KEY: 'sk_live_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
    STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_monthly',
    STRIPE_PRICE_STARTER_ANNUAL: 'price_starter_annual',
    STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
    STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual',
    RESEND_API_KEY: 're_123',
    RESEND_FROM_EMAIL: 'noreply@prizmview.app',
    NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1',
    SENTRY_AUTH_TOKEN: 'sentry-token',
    SENTRY_ORG: 'prizm',
    SENTRY_PROJECT: 'web',
    UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'redis-token',
    CRON_SECRET: 'cron-secret',
  }
}
