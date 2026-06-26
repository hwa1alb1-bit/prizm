import { describe, expect, it } from 'vitest'
import { formatBenchmarkSummary, type Benchmark } from '@/lib/marketing/throughput'

const fixture: Benchmark = {
  schemaVersion: 1,
  generatedAt: '2026-06-19T18:13:27.294Z',
  gitSha: 'local',
  mode: 'fixture',
  invariants: {
    lostJobs: 0,
    duplicateCreditCharges: 0,
    duplicateStatementRows: 0,
    goldenFixtureMatches: true,
  },
  runs: [
    {
      concurrency: 100,
      submitted: 100,
      accepted: 100,
      ready: 100,
      failed: 0,
      lostJobs: 0,
      duplicateCreditCharges: 0,
      duplicateStatementRows: 0,
      convertAcceptanceP95Ms: 0.094,
      convertAcceptanceP95ThresholdMs: 2000,
      timeToReadyP95Ms: 0.204,
      timeToReadyP95ThresholdMs: 60000,
      goldenFixtureMatches: true,
    },
    {
      concurrency: 500,
      submitted: 500,
      accepted: 500,
      ready: 500,
      failed: 0,
      lostJobs: 0,
      duplicateCreditCharges: 0,
      duplicateStatementRows: 0,
      convertAcceptanceP95Ms: 255,
      convertAcceptanceP95ThresholdMs: 2000,
      timeToReadyP95Ms: 387,
      timeToReadyP95ThresholdMs: 180000,
      goldenFixtureMatches: true,
    },
  ],
}

describe('formatBenchmarkSummary', () => {
  it('returns null when no benchmark is available', () => {
    expect(formatBenchmarkSummary(null)).toBeNull()
  })

  it('returns null when the benchmark has no runs', () => {
    expect(formatBenchmarkSummary({ ...fixture, runs: [] })).toBeNull()
  })

  it('picks the highest-concurrency run as the headline figure', () => {
    const summary = formatBenchmarkSummary(fixture)
    expect(summary?.peakConcurrency).toBe(500)
  })

  it('formats time-to-ready P95 in seconds with two decimals for sub-second values', () => {
    const summary = formatBenchmarkSummary(fixture)
    expect(summary?.timeToReadyP95Display).toBe('0.39s')
  })

  it('formats time-to-ready P95 in seconds with one decimal when over one second', () => {
    const slow: Benchmark = {
      ...fixture,
      runs: [{ ...fixture.runs[1]!, timeToReadyP95Ms: 4200 }],
    }
    const summary = formatBenchmarkSummary(slow)
    expect(summary?.timeToReadyP95Display).toBe('4.2s')
  })

  it('exposes the ISO generatedAt timestamp for "last run at" copy', () => {
    const summary = formatBenchmarkSummary(fixture)
    expect(summary?.generatedAt).toBe('2026-06-19T18:13:27.294Z')
  })
})
