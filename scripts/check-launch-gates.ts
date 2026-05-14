import {
  evaluateLaunchReadiness,
  formatLaunchGateReport,
  type LaunchTarget,
} from '@/lib/server/launch-gates'
import { validateCloudflareExtractionProofArchive } from '@/lib/server/cloudflare-extraction-proof'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function loadEnvFileIfExists(filePath: string): void {
  if (!existsSync(filePath)) return

  const content = readFileSync(filePath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    const value = unquoteEnvValue(trimmed.slice(separator + 1).trim())

    process.env[key] ??= value
  }
}

function readTarget(value: string | undefined): LaunchTarget | null {
  if (value === 'staging' || value === 'production') return value
  return null
}

async function main(): Promise<void> {
  loadEnvFileIfExists(resolve(process.cwd(), '.env.local'))

  const target = readTarget(process.env.LAUNCH_GATE_TARGET)

  if (!target) {
    console.error('Launch gate failed: LAUNCH_GATE_TARGET must be staging or production.')
    process.exit(1)
  }

  let result = evaluateLaunchReadiness({ target, env: process.env })
  if (target === 'production' && result.ok) {
    const proofValidation = validateCloudflareExtractionProofArchive({
      env: process.env,
      cwd: process.cwd(),
    })
    if (!proofValidation.ok) {
      result = {
        ...result,
        ok: false,
        failures: [
          ...result.failures,
          {
            id: 'cloudflare-r2-staging-proof-archive-valid',
            title: 'Cloudflare R2 extraction staging proof archive matches env metadata',
            envKeys: [
              'CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID',
              'CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT',
              'CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA',
            ],
            reason: 'invalid',
          },
        ],
      }
      console.error(`Cloudflare proof archive validation failed: ${proofValidation.failure}`)
    }
  }
  console.log(formatLaunchGateReport(result))

  if (!result.ok) {
    process.exit(1)
  }
}

void main()
