import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Cloudflare extractor dry-run verification script', () => {
  it('is wired into the extraction verification gate', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

    expect(packageJson.scripts?.['verify:cloudflare-extractor-dry-run']).toBe(
      'tsx scripts/verify-cloudflare-extractor-dry-run.ts',
    )
    expect(packageJson.scripts?.['verify:extraction']).toContain(
      'pnpm verify:cloudflare-extractor-dry-run',
    )
  })

  it('uses a pre-built image for local Wrangler dry runs without changing the production image', () => {
    const script = readFileSync(
      join(process.cwd(), 'scripts/verify-cloudflare-extractor-dry-run.ts'),
      'utf8',
    )
    const wranglerConfig = readFileSync(
      join(process.cwd(), 'workers/cloudflare-extractor/wrangler.jsonc'),
      'utf8',
    )

    expect(wranglerConfig).toContain('"image": "../kotlin-extractor/Dockerfile"')
    expect(script).toContain('docker.io/library/eclipse-temurin:21-jre')
    expect(script).toContain('"image": "../kotlin-extractor/Dockerfile"')
    expect(script).toContain('wrangler')
    expect(script).toContain('--dry-run')
  })

  it('keeps queue retry and DLQ settings explicit for the production proof', () => {
    const wranglerConfig = readFileSync(
      join(process.cwd(), 'workers/cloudflare-extractor/wrangler.jsonc'),
      'utf8',
    )

    expect(wranglerConfig).toContain('"max_retries": 3')
    expect(wranglerConfig).toContain('"retry_delay": 60')
    expect(wranglerConfig).toContain('"dead_letter_queue": "prizm-extractions-dlq"')
  })
})
