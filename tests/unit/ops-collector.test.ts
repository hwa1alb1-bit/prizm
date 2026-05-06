import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectOpsSnapshots } from '@/lib/server/ops/collector'
import { getProviderAdapters } from '@/lib/server/ops/providers'
import { writeOpsCollectionResult } from '@/lib/server/ops/store'
import { recordAuditEvent } from '@/lib/server/audit'

vi.mock('@/lib/server/ops/providers', () => ({
  getProviderAdapters: vi.fn(),
}))

vi.mock('@/lib/server/ops/store', () => ({
  writeOpsCollectionResult: vi.fn(),
}))

vi.mock('@/lib/server/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

const getProviderAdaptersMock = vi.mocked(getProviderAdapters)
const writeOpsCollectionResultMock = vi.mocked(writeOpsCollectionResult)
const recordAuditEventMock = vi.mocked(recordAuditEvent)

describe('collectOpsSnapshots', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('normalizes provider metrics and isolates provider failures', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T23:45:00.000Z'))
    getProviderAdaptersMock.mockReturnValue([
      {
        id: 'stripe',
        displayName: 'Stripe',
        sourceUrl: 'https://dashboard.stripe.com',
        staleAfterMinutes: 15,
        collect: vi.fn().mockResolvedValue([
          {
            metricKey: 'credential_gap',
            displayName: 'Missing credential count',
            used: 0,
            limit: 1,
            unit: 'count',
            sourceUrl: 'https://dashboard.stripe.com',
            required: true,
          },
        ]),
      },
      {
        id: 'vercel',
        displayName: 'Vercel',
        sourceUrl: 'https://vercel.com/dashboard',
        staleAfterMinutes: 15,
        collect: vi.fn().mockRejectedValue(new Error('token secret leaked')),
      },
    ])
    writeOpsCollectionResultMock.mockResolvedValue(undefined)
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_collection' })

    const result = await collectOpsSnapshots({ trigger: 'cron' })

    expect(result).toEqual({
      status: 'partial',
      providers: 2,
      metrics: 2,
      failures: [{ provider: 'vercel', errorCode: 'provider_collection_failed' }],
    })
    expect(writeOpsCollectionResultMock).toHaveBeenCalledWith({
      providerId: 'stripe',
      trigger: 'cron',
      status: 'ok',
      metrics: [
        expect.objectContaining({
          provider: 'stripe',
          metric: 'credential_gap',
          status: 'green',
          freshness: 'fresh',
          collectedAt: '2026-05-05T23:45:00.000Z',
        }),
      ],
    })
    expect(writeOpsCollectionResultMock).toHaveBeenCalledWith({
      providerId: 'vercel',
      trigger: 'cron',
      status: 'failed',
      errorDetail: 'provider_collection_failed',
      metrics: [
        expect.objectContaining({
          provider: 'vercel',
          metric: 'collector_status',
          status: 'red',
          freshness: 'failed',
          errorCode: 'provider_collection_failed',
        }),
      ],
    })
    expect(JSON.stringify(writeOpsCollectionResultMock.mock.calls)).not.toContain('token secret')
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'ops.provider_collection_completed',
      targetType: 'ops_provider',
      metadata: {
        provider: 'stripe',
        trigger: 'cron',
        status: 'ok',
        metrics_count: 1,
      },
    })
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'ops.provider_collection_failed',
      targetType: 'ops_provider',
      metadata: {
        provider: 'vercel',
        trigger: 'cron',
        error_code: 'provider_collection_failed',
      },
    })
  })
})
