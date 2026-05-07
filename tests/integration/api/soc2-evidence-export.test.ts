import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GET as exportEvidenceViaCron,
  POST as exportEvidence,
} from '@/app/api/ops/evidence/export/route'
import { generateSoc2EvidenceExport } from '@/lib/server/evidence/soc2'

vi.mock('@/lib/server/evidence/soc2', () => ({
  generateSoc2EvidenceExport: vi.fn(),
}))

vi.mock('@/lib/shared/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shared/env')>('@/lib/shared/env')
  return {
    ...actual,
    serverEnv: {
      ...actual.serverEnv,
      CRON_SECRET: 'cron_test_secret',
    },
  }
})

const generateSoc2EvidenceExportMock = vi.mocked(generateSoc2EvidenceExport)

describe('SOC 2 evidence export route', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects scheduled evidence export without the cron secret', async () => {
    const response = await exportEvidence(
      new Request('http://localhost/api/ops/evidence/export', {
        method: 'POST',
        headers: { 'x-request-id': 'req_soc2_denied' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      request_id: 'req_soc2_denied',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(generateSoc2EvidenceExportMock).not.toHaveBeenCalled()
  })

  it('generates a monthly evidence pack for valid cron requests', async () => {
    generateSoc2EvidenceExportMock.mockResolvedValue({
      exportId: 'export_123',
      accessReviewId: 'review_123',
      pack: {
        type: 'monthly_soc2',
        status: 'needs_review',
        generatedAt: '2026-05-06T12:00:00.000Z',
        period: {
          start: '2026-04-01T00:00:00.000Z',
          end: '2026-05-01T00:00:00.000Z',
        },
        controls: {
          auditLog: {
            eventCount: 4,
            eventTypes: 1,
            events: [{ eventType: 'document.deleted', count: 4 }],
          },
          deletionEvidence: {
            status: 'green',
            lastSweepAt: '2026-05-06T11:45:00.000Z',
            lastSweepStatus: 'ok',
            expiredSurvivors: 0,
            receiptFailures: 0,
          },
          providerQuotaReview: {
            providersTotal: 0,
            redProviders: [],
            yellowProviders: [],
            staleProviders: [],
            reviewRequired: false,
          },
          opsAdminAccessReview: {
            activeAdmins: 1,
            owners: 1,
            admins: 0,
            reviewRequired: true,
            adminsByUser: [
              {
                userId: 'user_owner',
                role: 'owner',
                grantedBy: null,
                createdAt: '2026-04-01T00:00:00.000Z',
              },
            ],
          },
        },
        reviewItems: [
          {
            id: 'ops_admin_monthly_access_review',
            severity: 'warning',
            title: 'Monthly ops admin access review required',
            detail: '1 active ops admin assignment(s) must be reviewed.',
          },
        ],
      },
    })

    const response = await exportEvidenceViaCron(
      new Request('http://localhost/api/ops/evidence/export', {
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_soc2_export',
        },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      exportId: 'export_123',
      pack: {
        type: 'monthly_soc2',
        status: 'needs_review',
      },
      request_id: 'req_soc2_export',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(generateSoc2EvidenceExportMock).toHaveBeenCalledWith({ trigger: 'cron' })
  })

  it('returns a sanitized problem response when evidence export fails', async () => {
    generateSoc2EvidenceExportMock.mockRejectedValue(new Error('raw sql detail'))

    const response = await exportEvidence(
      new Request('http://localhost/api/ops/evidence/export', {
        method: 'POST',
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_soc2_failed',
        },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(body).toMatchObject({
      status: 500,
      code: 'PRZM_INTERNAL_SOC2_EVIDENCE_EXPORT_FAILED',
      request_id: 'req_soc2_failed',
    })
    expect(JSON.stringify(body)).not.toContain('raw sql detail')
  })
})
