import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CorsRule = {
  allowed?: {
    origins?: string[]
    methods?: string[]
    headers?: string[]
  }
  exposeHeaders?: string[]
  maxAgeSeconds?: number
}

type CorsConfig = {
  rules?: CorsRule[]
}

type NormalizedCorsRule = {
  origins: string[]
  methods: string[]
  headers: string[]
  exposeHeaders: string[]
  maxAgeSeconds: number | null
}

type NormalizedCorsConfig = {
  rules: NormalizedCorsRule[]
}

type CloudflareEnv = {
  CLOUDFLARE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  R2_ACCOUNT_ID?: string
  R2_UPLOAD_BUCKET?: string
}

const defaultCorsPath = 'infra/cloudflare/r2-upload-cors.json'

export async function readCorsConfig(path = defaultCorsPath): Promise<CorsConfig> {
  const raw = await readFile(resolve(process.cwd(), path), 'utf8')
  return parseCorsConfig(raw)
}

export function parseCorsConfig(raw: string): CorsConfig {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed) || !Array.isArray(parsed.rules)) {
    throw new Error('R2 CORS config must be a JSON object with a rules array.')
  }
  return parsed as CorsConfig
}

export function cloudflareR2CorsUrl(accountId: string, bucketName: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/r2/buckets/${encodeURIComponent(bucketName)}/cors`
}

export async function fetchR2CorsConfig(input: {
  accountId: string
  bucketName: string
  token: string
}): Promise<CorsConfig> {
  const response = await fetch(cloudflareR2CorsUrl(input.accountId, input.bucketName), {
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
  })
  const bodyText = await response.text()
  const body = bodyText ? (JSON.parse(bodyText) as unknown) : {}

  if (!response.ok) {
    throw new Error(
      `Cloudflare R2 CORS read failed with HTTP ${response.status}: ${apiErrorMessage(body)}`,
    )
  }

  return extractCorsConfig(body)
}

export function extractCorsConfig(body: unknown): CorsConfig {
  if (!isRecord(body)) {
    throw new Error('Cloudflare R2 CORS response was not a JSON object.')
  }

  if (isRecord(body.result) && Array.isArray(body.result.rules)) {
    return body.result as CorsConfig
  }

  if (Array.isArray(body.rules)) {
    return body as CorsConfig
  }

  throw new Error('Cloudflare R2 CORS response did not include result.rules.')
}

export function diffCorsConfig(expected: CorsConfig, actual: CorsConfig): string[] {
  const expectedConfig = normalizeCorsConfig(expected)
  const actualConfig = normalizeCorsConfig(actual)
  const diffs: string[] = []

  if (expectedConfig.rules.length !== actualConfig.rules.length) {
    diffs.push(
      `rules.length expected ${expectedConfig.rules.length}, got ${actualConfig.rules.length}`,
    )
  }

  const ruleCount = Math.min(expectedConfig.rules.length, actualConfig.rules.length)
  for (let index = 0; index < ruleCount; index += 1) {
    const expectedRule = expectedConfig.rules[index]
    const actualRule = actualConfig.rules[index]
    compareField(diffs, index, 'allowed.origins', expectedRule.origins, actualRule.origins)
    compareField(diffs, index, 'allowed.methods', expectedRule.methods, actualRule.methods)
    compareField(diffs, index, 'allowed.headers', expectedRule.headers, actualRule.headers)
    compareField(
      diffs,
      index,
      'exposeHeaders',
      expectedRule.exposeHeaders,
      actualRule.exposeHeaders,
    )

    if (expectedRule.maxAgeSeconds !== actualRule.maxAgeSeconds) {
      diffs.push(
        `rules[${index}].maxAgeSeconds expected ${expectedRule.maxAgeSeconds}, got ${actualRule.maxAgeSeconds}`,
      )
    }
  }

  return diffs
}

export function normalizeCorsConfig(config: CorsConfig): NormalizedCorsConfig {
  return {
    rules: (config.rules ?? []).map((rule) => ({
      origins: normalizeStringList(rule.allowed?.origins),
      methods: normalizeStringList(rule.allowed?.methods).map((method) => method.toUpperCase()),
      headers: normalizeStringList(rule.allowed?.headers).map((header) => header.toLowerCase()),
      exposeHeaders: normalizeStringList(rule.exposeHeaders).map((header) => header.toLowerCase()),
      maxAgeSeconds: rule.maxAgeSeconds ?? null,
    })),
  }
}

export function resolveCloudflareEnv(env: CloudflareEnv): {
  accountId: string
  bucketName: string
  token: string
} {
  const token = requiredEnv(env.CLOUDFLARE_API_TOKEN, 'CLOUDFLARE_API_TOKEN')
  const accountId = requiredEnv(
    env.CLOUDFLARE_ACCOUNT_ID ?? env.R2_ACCOUNT_ID,
    'CLOUDFLARE_ACCOUNT_ID or R2_ACCOUNT_ID',
  )
  const bucketName = requiredEnv(env.R2_UPLOAD_BUCKET, 'R2_UPLOAD_BUCKET')

  return { accountId, bucketName, token }
}

async function main() {
  const desired = await readCorsConfig()
  const cloudflareEnv = resolveCloudflareEnv({
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_UPLOAD_BUCKET: process.env.R2_UPLOAD_BUCKET,
  })
  const actual = await fetchR2CorsConfig(cloudflareEnv)
  const diffs = diffCorsConfig(desired, actual)

  if (diffs.length > 0) {
    throw new Error(`R2 browser-upload CORS drift detected:\n${diffs.join('\n')}`)
  }

  console.log(
    `R2 browser-upload CORS matches ${defaultCorsPath} for bucket ${cloudflareEnv.bucketName}.`,
  )
}

function compareField(
  diffs: string[],
  index: number,
  field: string,
  expected: string[],
  actual: string[],
) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    diffs.push(
      `rules[${index}].${field} expected ${JSON.stringify(expected)}, got ${JSON.stringify(
        actual,
      )}`,
    )
  }
}

function normalizeStringList(value: string[] | undefined): string[] {
  return [...(value ?? [])].sort((a, b) => a.localeCompare(b))
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required to verify production R2 CORS.`)
  }
  return value.trim()
}

function apiErrorMessage(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.errors) || body.errors.length === 0) {
    return 'unknown Cloudflare API error'
  }

  return body.errors
    .map((error) => {
      if (!isRecord(error)) return String(error)
      return typeof error.message === 'string' ? error.message : JSON.stringify(error)
    })
    .join('; ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
