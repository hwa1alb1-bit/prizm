import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Build-time reader for the ADR-009 extraction benchmark evidence files. The throughput
 * marketing page and the trust cards both consume the latest run via these helpers. Static
 * read at build time, no runtime cost.
 *
 * The evidence directory holds one JSON per benchmark run. Filenames sort chronologically
 * because they begin with a UTC timestamp prefix.
 */

const BENCHMARK_DIR = 'docs/evidence/extraction-benchmarks'

export type BenchmarkRun = {
  concurrency: number
  submitted: number
  accepted: number
  ready: number
  failed: number
  lostJobs: number
  duplicateCreditCharges: number
  duplicateStatementRows: number
  convertAcceptanceP95Ms: number
  convertAcceptanceP95ThresholdMs: number
  timeToReadyP95Ms: number
  timeToReadyP95ThresholdMs: number
  goldenFixtureMatches: boolean
}

export type Benchmark = {
  schemaVersion: number
  generatedAt: string
  gitSha: string
  mode: string
  invariants: {
    lostJobs: number
    duplicateCreditCharges: number
    duplicateStatementRows: number
    goldenFixtureMatches: boolean
  }
  runs: BenchmarkRun[]
}

export function loadLatestBenchmark(): Benchmark | null {
  try {
    const dir = join(process.cwd(), BENCHMARK_DIR)
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort()
    if (files.length === 0) return null
    const latest = files[files.length - 1]
    const contents = readFileSync(join(dir, latest), 'utf8')
    return JSON.parse(contents) as Benchmark
  } catch {
    return null
  }
}

export type BenchmarkSummary = {
  peakConcurrency: number
  timeToReadyP95Ms: number
  timeToReadyP95Display: string
  acceptanceP95Ms: number
  generatedAt: string
}

/**
 * Picks the highest-concurrency run (most stressful test) as the headline
 * figure for marketing copy and formats time-to-ready P95 for display.
 *
 * Returns null when there is no benchmark to summarize, so callers can fall
 * back to abstract copy without runtime errors.
 */
export function formatBenchmarkSummary(benchmark: Benchmark | null): BenchmarkSummary | null {
  if (!benchmark) return null
  const runs = benchmark.runs
  if (!runs || runs.length === 0) return null

  const headline = runs.reduce((best, current) =>
    current.concurrency > best.concurrency ? current : best,
  )

  const seconds = headline.timeToReadyP95Ms / 1000
  const timeToReadyP95Display = seconds < 1 ? `${seconds.toFixed(2)}s` : `${seconds.toFixed(1)}s`

  return {
    peakConcurrency: headline.concurrency,
    timeToReadyP95Ms: headline.timeToReadyP95Ms,
    timeToReadyP95Display,
    acceptanceP95Ms: headline.convertAcceptanceP95Ms,
    generatedAt: benchmark.generatedAt,
  }
}
