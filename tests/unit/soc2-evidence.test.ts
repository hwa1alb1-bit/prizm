import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  attestOpsAdminAccessReview,
  buildSoc2EvidencePack,
  generateSoc2EvidenceExport,
} from '@/lib/server/evidence/soc2'
import {
  listActiveOpsAdmins,
  listAuditEventCounts,
  recordOpsAdminAccessReviewAttestation,
  recordSoc2EvidenceExport,
} from '@/lib/server/evidence/store'
import { listDeletionHealth } from '@/lib/server/deletion/store'
import { listLatestOpsSnapshots } from '@/lib/server/ops/store'

vi.mock('@/lib/server/deletion/store', () => ({
  listDeletionHealth: vi.fn(),
}))

vi.mock('@/lib/server/evidence/store', () => ({
  listActiveOpsAdmins: vi.fn(),
  listAuditEventCounts: vi.fn(),
  recordOpsAdminAccessReviewAttestation: vi.fn(),
  recordSoc2EvidenceExport: vi.fn(),
}))

vi.mock('@/lib/server/ops/store', () => ({
  listLatestOpsSnapshots: vi.fn(),
}))

const listAuditEventCountsMock = vi.mocked(listAuditEventCounts)
const listActiveOpsAdminsMock = vi.mocked(listActiveOpsAdmins)
const recordOpsAdminAccessReviewAttestationMock = vi.mocked(recordOpsAdminAccessReviewAttestation)
const recordSoc2EvidenceExportMock = vi.mocked(recordSoc2EvidenceExport)
const listDeletionHealthMock = vi.mocked(listDeletionHealth)
const listLatestOpsSnapshotsMock = vi.mocked(listLatestOpsSnapshots)

describe('buildSoc2EvidencePack', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('summarizes monthly SOC 2 evidence and flags provider and admin review items', () => {
    const pack = buildSoc2EvidencePack({
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-05-01T00:00:00.000Z',
      generatedAt: '2026-05-01T12:00:00.000Z',
      auditEvents: [
        { eventType: 'ops.dashboard_read', count: 5 },
        { eventType: 'document.deleted', count: 3 },
      ],
      deletionHealth: {
        status: 'green',
        lastSweepAt: '2026-05-01T11:45:00.000Z',
        lastSweepStatus: 'ok',
        expiredSurvivors: 0,
        receiptFailures: 0,
      },
      providerSnapshots: [
        {
          provider: 'stripe',
          metric: 'billing_state',
          displayName: 'Stripe billing state',
          used: null,
          limit: null,
          unit: 'status',
          periodStart: null,
          periodEnd: null,
          status: 'red',
          freshness: 'fresh',
          sourceUrl: 'https://dashboard.stripe.com',
          collectedAt: '2026-05-01T11:55:00.000Z',
          errorCode: 'payment_webhook_failed',
        },
        {
          provider: 'vercel',
          metric: 'bandwidth',
          displayName: 'Bandwidth',
          used: 70,
          limit: 100,
          unit: 'bytes',
          periodStart: null,
          periodEnd: null,
          status: 'yellow',
          freshness: 'fresh',
          sourceUrl: 'https://vercel.com/dashboard/usage',
          collectedAt: '2026-05-01T11:55:00.000Z',
          errorCode: null,
        },
      ],
      activeOpsAdmins: [
        {
          userId: 'user_owner',
          role: 'owner',
          grantedBy: 'user_founder',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        {
          userId: 'user_admin',
          role: 'admin',
          grantedBy: 'user_owner',
          createdAt: '2026-04-15T00:00:00.000Z',
        },
      ],
    })

    expect(pack).toMatchObject({
      type: 'monthly_soc2',
      status: 'needs_review',
      period: {
        start: '2026-04-01T00:00:00.000Z',
        end: '2026-05-01T00:00:00.000Z',
      },
      controls: {
        auditLog: {
          eventCount: 8,
          eventTypes: 2,
        },
        deletionEvidence: {
          status: 'green',
          expiredSurvivors: 0,
          receiptFailures: 0,
        },
        providerQuotaReview: {
          providersTotal: 2,
          redProviders: ['stripe'],
          yellowProviders: ['vercel'],
          reviewRequired: true,
        },
        opsAdminAccessReview: {
          activeAdmins: 2,
          owners: 1,
          admins: 1,
          reviewRequired: true,
        },
      },
    })
    expect(pack.reviewItems.map((item) => item.id)).toEqual([
      'provider_quota_red',
      'provider_quota_yellow',
      'ops_admin_monthly_access_review',
    ])
  })

  it('persists a scheduled monthly export and opens an access review atomically', async () => {
    const now = new Date('2026-05-06T12:00:00.000Z')
    const periodStart = '2026-04-01T00:00:00.000Z'
    const periodEnd = '2026-05-01T00:00:00.000Z'

    listAuditEventCountsMock.mockResolvedValue([{ eventType: 'document.deleted', count: 4 }])
    listDeletionHealthMock.mockResolvedValue({
      status: 'green',
      lastSweepAt: '2026-05-06T11:45:00.000Z',
      lastSweepStatus: 'ok',
      expiredSurvivors: 0,
      receiptFailures: 0,
    })
    listLatestOpsSnapshotsMock.mockResolvedValue([])
    listActiveOpsAdminsMock.mockResolvedValue([
      {
        userId: 'user_owner',
        role: 'owner',
        grantedBy: null,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ])
    recordSoc2EvidenceExportMock.mockResolvedValue({
      exportId: 'export_123',
      accessReviewId: 'review_123',
    })

    const result = await generateSoc2EvidenceExport({
      trigger: 'test',
      now,
      periodStart,
      periodEnd,
    })

    expect(result.exportId).toBe('export_123')
    expect(result.pack).toMatchObject({
      type: 'monthly_soc2',
      generatedAt: now.toISOString(),
      period: { start: periodStart, end: periodEnd },
    })
    expect(listAuditEventCountsMock).toHaveBeenCalledWith({ periodStart, periodEnd })
    expect(recordSoc2EvidenceExportMock).toHaveBeenCalledWith({
      periodStart,
      periodEnd,
      generatedAt: now.toISOString(),
      status: 'needs_review',
      pack: result.pack,
      activeOpsAdmins: [
        {
          userId: 'user_owner',
          role: 'owner',
          grantedBy: null,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      trigger: 'test',
    })
  })

  it('fails closed when the atomic export write fails', async () => {
    const now = new Date('2026-05-06T12:00:00.000Z')
    listAuditEventCountsMock.mockResolvedValue([])
    listDeletionHealthMock.mockResolvedValue({
      status: 'green',
      lastSweepAt: '2026-05-06T11:45:00.000Z',
      lastSweepStatus: 'ok',
      expiredSurvivors: 0,
      receiptFailures: 0,
    })
    listLatestOpsSnapshotsMock.mockResolvedValue([])
    listActiveOpsAdminsMock.mockResolvedValue([
      {
        userId: 'user_owner',
        role: 'owner',
        grantedBy: null,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ])
    recordSoc2EvidenceExportMock.mockRejectedValue(new Error('soc2_evidence_export_write_failed'))

    await expect(
      generateSoc2EvidenceExport({
        trigger: 'test',
        now,
        periodStart: '2026-04-01T00:00:00.000Z',
        periodEnd: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('soc2_evidence_export_write_failed')
  })

  it('defaults scheduled exports to the previous UTC month', async () => {
    const now = new Date('2026-05-06T12:00:00.000Z')
    listAuditEventCountsMock.mockResolvedValue([])
    listDeletionHealthMock.mockResolvedValue({
      status: 'green',
      lastSweepAt: null,
      lastSweepStatus: null,
      expiredSurvivors: 0,
      receiptFailures: 0,
    })
    listLatestOpsSnapshotsMock.mockResolvedValue([])
    listActiveOpsAdminsMock.mockResolvedValue([
      {
        userId: 'user_owner',
        role: 'owner',
        grantedBy: null,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ])
    recordSoc2EvidenceExportMock.mockResolvedValue({
      exportId: 'export_previous_month',
      accessReviewId: 'review_previous_month',
    })

    const result = await generateSoc2EvidenceExport({ trigger: 'test', now })

    expect(result.pack.period).toEqual({
      start: '2026-04-01T00:00:00.000Z',
      end: '2026-05-01T00:00:00.000Z',
    })
    expect(listAuditEventCountsMock).toHaveBeenCalledWith({
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-05-01T00:00:00.000Z',
    })
  })

  it('attests an access review through the audited database boundary', async () => {
    recordOpsAdminAccessReviewAttestationMock.mockResolvedValue({
      reviewId: 'review_123',
      status: 'approved',
      reviewedAt: '2026-05-06T12:30:00.000Z',
    })

    const result = await attestOpsAdminAccessReview({
      reviewId: 'review_123',
      status: 'approved',
      note: 'All access still required.',
      reviewedBy: 'user_admin',
      routeContext: {
        requestId: 'req_access_review',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/ops/evidence/access-review',
      },
      actorIp: '203.0.113.20',
      actorUserAgent: 'vitest',
    })

    expect(result).toEqual({
      reviewId: 'review_123',
      status: 'approved',
      reviewedAt: '2026-05-06T12:30:00.000Z',
    })
    expect(recordOpsAdminAccessReviewAttestationMock).toHaveBeenCalledWith({
      reviewId: 'review_123',
      status: 'approved',
      note: 'All access still required.',
      reviewedBy: 'user_admin',
      requestId: 'req_access_review',
      traceId: '0123456789abcdef0123456789abcdef',
      actorIp: '203.0.113.20',
      actorUserAgent: 'vitest',
    })
  })
})
