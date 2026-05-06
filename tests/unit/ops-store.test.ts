import { describe, expect, it } from 'vitest'
import { normalizeOpsSnapshotRows } from '@/lib/server/ops/store'

describe('normalizeOpsSnapshotRows', () => {
  it('recomputes stale required snapshots as red at read time', () => {
    const snapshots = normalizeOpsSnapshotRows(
      [
        {
          provider_id: 'stripe',
          metric_key: 'credential_gap',
          display_name: 'Missing credential count',
          used: 0,
          limit_value: 1,
          unit: 'count',
          period_start: null,
          period_end: null,
          status: 'green',
          freshness: 'fresh',
          source_url: 'https://dashboard.stripe.com',
          collected_at: '2026-05-05T23:00:00.000Z',
          error_code: null,
        },
      ],
      { now: new Date('2026-05-05T23:30:00.000Z') },
    )

    expect(snapshots[0]).toMatchObject({
      freshness: 'stale',
      status: 'red',
    })
  })

  it('deduplicates to the newest snapshot per provider metric', () => {
    const snapshots = normalizeOpsSnapshotRows(
      [
        snapshotRow('2026-05-05T23:20:00.000Z', 'red'),
        snapshotRow('2026-05-05T23:00:00.000Z', 'green'),
      ],
      { now: new Date('2026-05-05T23:21:00.000Z') },
    )

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      collectedAt: '2026-05-05T23:20:00.000Z',
      status: 'red',
    })
  })
})

function snapshotRow(collectedAt: string, status: 'green' | 'red') {
  return {
    provider_id: 'vercel' as const,
    metric_key: 'credential_gap',
    display_name: 'Missing credential count',
    used: status === 'red' ? 1 : 0,
    limit_value: 1,
    unit: 'count' as const,
    period_start: null,
    period_end: null,
    status,
    freshness: 'fresh' as const,
    source_url: 'https://vercel.com/dashboard',
    collected_at: collectedAt,
    error_code: status === 'red' ? 'configuration_missing' : null,
  }
}
