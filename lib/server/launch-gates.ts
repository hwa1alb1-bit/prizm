export type LaunchTarget = 'staging' | 'production'

type LaunchEnv = Record<string, string | undefined>

type LaunchGateDefinition = {
  id: string
  title: string
  requiredEnv: readonly string[]
}

export type LaunchGateFailure = {
  id: string
  title: string
  envKeys: string[]
  reason: 'missing' | 'invalid'
}

export type LaunchReadinessResult = {
  ok: boolean
  target: LaunchTarget
  failures: LaunchGateFailure[]
}

export type LaunchGateCheckResult = {
  ok: boolean
  failures: LaunchGateFailure[]
}

const commonLaunchGates: readonly LaunchGateDefinition[] = [
  {
    id: 'supabase-configured',
    title: 'Supabase project and service credentials are configured',
    requiredEnv: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
  {
    id: 'stripe-configured',
    title: 'Stripe checkout, webhook, public key, and plan prices are configured',
    requiredEnv: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_PRICE_STARTER_MONTHLY',
      'STRIPE_PRICE_STARTER_ANNUAL',
      'STRIPE_PRICE_PRO_MONTHLY',
      'STRIPE_PRICE_PRO_ANNUAL',
    ],
  },
  {
    id: 'resend-configured',
    title: 'Resend transactional email credentials are configured',
    requiredEnv: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
  },
  {
    id: 'sentry-configured',
    title: 'Sentry source map and alert routing credentials are configured',
    requiredEnv: ['NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'],
  },
  {
    id: 'upstash-configured',
    title: 'Upstash Redis rate-limit credentials are configured',
    requiredEnv: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  },
  {
    id: 'cron-secret-configured',
    title: 'Vercel Cron authentication secret is configured',
    requiredEnv: ['CRON_SECRET'],
  },
]

const legacyAwsS3LaunchGates: readonly LaunchGateDefinition[] = [
  {
    id: 'aws-oidc-configured',
    title: 'AWS OIDC role assumption is configured',
    requiredEnv: ['AWS_REGION', 'AWS_ROLE_ARN'],
  },
  {
    id: 's3-upload-bucket-configured',
    title: 'S3 browser upload bucket is configured',
    requiredEnv: ['S3_UPLOAD_BUCKET'],
  },
]

const cloudflareR2RuntimeEnv = [
  'R2_ACCOUNT_ID',
  'R2_UPLOAD_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_EXTRACTOR_URL',
  'CLOUDFLARE_EXTRACTOR_TOKEN',
  'CLOUDFLARE_EXTRACTOR_HEALTHCHECK_STORAGE_KEY',
] as const

const cloudflareR2ProductionProofEnv = [
  'CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID',
  'CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT',
  'CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA',
] as const

const cloudflareProofIdPattern =
  /^cf-extraction-staging-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/
const sha256Pattern = /^[a-f0-9]{64}$/

function isPresent(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function isLaunchTarget(value: string | undefined): value is LaunchTarget {
  return value === 'staging' || value === 'production'
}

function isHttpsUrl(value: string | undefined): boolean {
  const candidate = value?.trim()

  if (!candidate) return false

  try {
    return new URL(candidate).protocol === 'https:'
  } catch {
    return false
  }
}

export function evaluateLaunchReadiness({
  target,
  env,
}: {
  target: LaunchTarget
  env: LaunchEnv
}): LaunchReadinessResult {
  const gateDefinitions = [
    ...commonLaunchGates,
    ...(requiresLegacyAwsS3Gates(target, env) ? legacyAwsS3LaunchGates : []),
  ]
  const failures: LaunchGateFailure[] = gateDefinitions.flatMap((gate) => {
    const missingEnv = gate.requiredEnv.filter((key) => !isPresent(env[key]))

    if (missingEnv.length === 0) return []

    return [{ id: gate.id, title: gate.title, envKeys: missingEnv, reason: 'missing' }]
  })

  if (!isHttpsUrl(env.NEXT_PUBLIC_SITE_URL)) {
    failures.push({
      id: 'launch-site-url-secure',
      title: 'Launch site URL uses HTTPS',
      envKeys: ['NEXT_PUBLIC_SITE_URL'],
      reason: 'invalid',
    })
  }

  const staticAwsKeys = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].filter((key) =>
    isPresent(env[key]),
  )

  if (staticAwsKeys.length > 0) {
    failures.push({
      id: 'aws-static-keys-absent',
      title: 'Static AWS access keys are absent for managed launch environments',
      envKeys: staticAwsKeys,
      reason: 'invalid',
    })
  }

  if (target === 'production' && env.PRIZM_EXTRACTION_ENGINE === 'kotlin_worker') {
    failures.push({
      id: 'legacy-kotlin-worker-production-disabled',
      title: 'Legacy kotlin_worker production flag stays disabled',
      envKeys: ['PRIZM_EXTRACTION_ENGINE'],
      reason: 'invalid',
    })
  }

  if (
    target === 'production' &&
    (env.DOCUMENT_STORAGE_PROVIDER !== 'r2' || env.DOCUMENT_EXTRACTION_PROVIDER !== 'cloudflare-r2')
  ) {
    failures.push({
      id: 'cloudflare-r2-production-provider-selected',
      title: 'Production launch uses Cloudflare R2 storage and extractor',
      envKeys: ['DOCUMENT_STORAGE_PROVIDER', 'DOCUMENT_EXTRACTION_PROVIDER'],
      reason: 'invalid',
    })
  }

  const requiresCloudflareR2LaunchBundle =
    target === 'production' || env.DOCUMENT_EXTRACTION_PROVIDER === 'cloudflare-r2'

  if (env.DOCUMENT_EXTRACTION_PROVIDER === 'cloudflare-r2') {
    if (env.DOCUMENT_STORAGE_PROVIDER !== 'r2') {
      failures.push({
        id: 'cloudflare-r2-storage-provider',
        title: 'Cloudflare R2 extraction uses R2 document storage',
        envKeys: ['DOCUMENT_STORAGE_PROVIDER'],
        reason: 'invalid',
      })
    }
  }

  if (requiresCloudflareR2LaunchBundle) {
    const missingRuntimeEnv = cloudflareR2RuntimeEnv.filter((key) => !isPresent(env[key]))
    if (missingRuntimeEnv.length > 0) {
      failures.push({
        id: 'cloudflare-r2-extraction-configured',
        title: 'Cloudflare R2 storage and extractor runtime are configured',
        envKeys: [...missingRuntimeEnv],
        reason: 'missing',
      })
    }

    if (isPresent(env.CLOUDFLARE_EXTRACTOR_URL) && !isHttpsUrl(env.CLOUDFLARE_EXTRACTOR_URL)) {
      failures.push({
        id: 'cloudflare-extractor-url-secure',
        title: 'Cloudflare extractor URL uses HTTPS',
        envKeys: ['CLOUDFLARE_EXTRACTOR_URL'],
        reason: 'invalid',
      })
    }

    if (target === 'production') {
      const missingProofEnv = cloudflareR2ProductionProofEnv.filter((key) => !isPresent(env[key]))
      if (missingProofEnv.length > 0) {
        failures.push({
          id: 'cloudflare-r2-staging-proof-archived',
          title: 'Cloudflare R2 extraction has a current staging proof archive',
          envKeys: [...missingProofEnv],
          reason: 'missing',
        })
      } else if (!cloudflareProofMetadataValid(env)) {
        failures.push({
          id: 'cloudflare-r2-staging-proof-metadata-valid',
          title: 'Cloudflare R2 extraction staging proof metadata is well formed',
          envKeys: [...cloudflareR2ProductionProofEnv],
          reason: 'invalid',
        })
      }
    }
  }

  return {
    ok: failures.length === 0,
    target,
    failures,
  }
}

function cloudflareProofMetadataValid(env: LaunchEnv): boolean {
  const proofId = env.CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID?.trim() ?? ''
  const archivedAt = env.CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT?.trim() ?? ''
  const sha = env.CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA?.trim() ?? ''

  return (
    cloudflareProofIdPattern.test(proofId) &&
    !Number.isNaN(Date.parse(archivedAt)) &&
    sha256Pattern.test(sha)
  )
}

function requiresLegacyAwsS3Gates(target: LaunchTarget, env: LaunchEnv): boolean {
  if (
    env.DOCUMENT_STORAGE_PROVIDER === 'r2' &&
    env.DOCUMENT_EXTRACTION_PROVIDER === 'cloudflare-r2'
  ) {
    return false
  }

  return target === 'staging'
}

export function evaluateLiveConnectorSmokeGate(env: LaunchEnv): LaunchGateCheckResult {
  const failures: LaunchGateFailure[] = []

  if (env.LIVE_CONNECTOR_SMOKE !== '1') {
    failures.push({
      id: 'live-connector-smoke-enabled',
      title: 'Live connector smoke tests are explicitly enabled',
      envKeys: ['LIVE_CONNECTOR_SMOKE'],
      reason: 'missing',
    })
  }

  if (!isLaunchTarget(env.LAUNCH_GATE_TARGET)) {
    failures.push({
      id: 'launch-target-configured',
      title: 'Live connector smoke target is explicitly staging or production',
      envKeys: ['LAUNCH_GATE_TARGET'],
      reason: 'missing',
    })
  }

  if (!isHttpsUrl(env.NEXT_PUBLIC_SITE_URL)) {
    failures.push({
      id: 'launch-site-url-secure',
      title: 'Live connector smoke site URL uses HTTPS',
      envKeys: ['NEXT_PUBLIC_SITE_URL'],
      reason: 'invalid',
    })
  }

  return {
    ok: failures.length === 0,
    failures,
  }
}

export function formatLaunchGateReport(result: LaunchReadinessResult): string {
  if (result.ok) {
    return `Launch gate passed for ${result.target}`
  }

  const lines = [`Launch gate failed for ${result.target}`]

  for (const failure of result.failures) {
    const label = failure.reason === 'missing' ? 'Missing' : 'Invalid'
    lines.push(`- ${failure.title} (${failure.id})`)
    lines.push(`  ${label}: ${failure.envKeys.join(', ')}`)
  }

  return lines.join('\n')
}
