import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('extraction benchmark gate', () => {
  it('is exposed as pnpm benchmark:extraction', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.['benchmark:extraction']).toBe(
      'tsx --conditions react-server scripts/benchmark-extraction.ts',
    )
  })

  it('records the required concurrency levels, invariants, and pricing sources', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'benchmark-extraction.ts'), 'utf8')

    for (const level of ['100', '250', '500']) {
      expect(script).toContain(level)
    }
    for (const invariant of [
      'lostJobs',
      'duplicateCreditCharges',
      'duplicateStatementRows',
      'convertAcceptanceP95Ms',
      'timeToReadyP95Ms',
      'goldenFixtureMatches',
    ]) {
      expect(script).toContain(invariant)
    }
    for (const source of [
      'https://developers.cloudflare.com/workers/platform/pricing/',
      'https://developers.cloudflare.com/r2/pricing/',
      'https://developers.cloudflare.com/queues/platform/pricing/',
      'https://developers.cloudflare.com/containers/pricing/',
      'https://aws.amazon.com/textract/pricing/',
    ]) {
      expect(script).toContain(source)
    }
  })
})
