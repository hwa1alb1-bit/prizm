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

  it('is included in the extraction verification gate with Worker and Kotlin tests', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.['verify:extraction']).toBe(
      'pnpm exec vitest run tests/unit/cloudflare-extractor-worker.test.ts tests/unit/extraction-engine.test.ts tests/unit/extraction-benchmark-script.test.ts tests/unit/cloudflare-extractor-dry-run-script.test.ts && pnpm test:kotlin-extractor && pnpm benchmark:extraction && pnpm verify:cloudflare-extractor-dry-run',
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

  it('uses the extractor HTTP contract in target mode instead of fixture-only evidence', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'benchmark-extraction.ts'), 'utf8')

    expect(script).toContain('BENCHMARK_EXTRACTION_TARGET_URL')
    expect(script).toContain('BENCHMARK_EXTRACTION_TOKEN')
    expect(script).toContain("method: 'POST'")
    expect(script).toContain("method: 'GET'")
    expect(script).toContain('/v1/extractions')
    expect(script).toContain('pollTargetExtraction')
    expect(script).toContain('timeToReadyP95Ms')
    expect(script).toContain('timeToReadyP95ThresholdMs')
    expect(script).toContain('run.timeToReadyP95Ms >= run.timeToReadyP95ThresholdMs')
  })
})
