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
