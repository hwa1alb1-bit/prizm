import { describe, expect, it } from 'vitest'
import { computeFreshness, computeMetricStatus } from '@/lib/server/ops/status'

describe('ops status rules', () => {
  it('classifies quota pressure using warning and critical thresholds', () => {
    expect(computeMetricStatus({ used: 69, limit: 100, required: true })).toBe('green')
    expect(computeMetricStatus({ used: 70, limit: 100, required: true })).toBe('yellow')
    expect(computeMetricStatus({ used: 86, limit: 100, required: true })).toBe('red')
  })

  it('marks unsupported or unbounded metrics gray unless required collection failed', () => {
    expect(computeMetricStatus({ used: null, limit: null, required: true })).toBe('gray')
    expect(
      computeMetricStatus({
        used: null,
        limit: null,
        required: true,
        errorCode: 'configuration_missing',
      }),
    ).toBe('red')
  })

  it('marks stale required metrics red but stale informational metrics gray', () => {
    expect(
      computeMetricStatus({
        used: 10,
        limit: 100,
        required: true,
        freshness: 'stale',
      }),
    ).toBe('red')
    expect(
      computeMetricStatus({
        used: 10,
        limit: 100,
        required: false,
        freshness: 'stale',
      }),
    ).toBe('gray')
  })

  it('calculates freshness from provider SLA', () => {
    const now = new Date('2026-05-05T23:30:00.000Z')

    expect(
      computeFreshness({
        collectedAt: '2026-05-05T23:20:00.000Z',
        now,
        staleAfterMinutes: 15,
      }),
    ).toBe('fresh')
    expect(
      computeFreshness({
        collectedAt: '2026-05-05T23:00:00.000Z',
        now,
        staleAfterMinutes: 15,
      }),
    ).toBe('stale')
    expect(
      computeFreshness({
        collectedAt: null,
        now,
        staleAfterMinutes: 15,
        failed: true,
      }),
    ).toBe('failed')
  })
})
