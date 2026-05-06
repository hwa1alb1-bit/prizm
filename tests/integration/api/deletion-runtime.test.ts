import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET as monitorViaCron } from '@/app/api/ops/deletion/monitor/route'
import { GET as sweepViaCron, POST as sweep } from '@/app/api/ops/deletion/sweep/route'
import { checkDeletionSurvivors, runDeletionSweep } from '@/lib/server/deletion/runtime'

vi.mock('@/lib/server/deletion/runtime', () => ({
  checkDeletionSurvivors: vi.fn(),
  runDeletionSweep: vi.fn(),
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

const checkDeletionSurvivorsMock = vi.mocked(checkDeletionSurvivors)
const runDeletionSweepMock = vi.mocked(runDeletionSweep)

describe('deletion runtime cron routes', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects deletion sweep without the cron secret', async () => {
    const response = await sweep(
      new Request('http://localhost/api/ops/deletion/sweep', {
        method: 'POST',
        headers: { 'x-request-id': 'req_delete_denied' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      request_id: 'req_delete_denied',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(runDeletionSweepMock).not.toHaveBeenCalled()
  })

  it('runs the deletion sweep for valid Vercel Cron requests', async () => {
    runDeletionSweepMock.mockResolvedValue({
      status: 'ok',
      expiredDocuments: 1,
      expiredStatements: 1,
      deletedDocuments: 1,
      deletedStatements: 2,
      s3Deleted: 1,
      s3Absent: 0,
      receiptsSent: 1,
      receiptFailures: 0,
      failures: [],
    })

    const response = await sweepViaCron(
      new Request('http://localhost/api/ops/deletion/sweep', {
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_delete_sweep',
        },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: 'ok',
      deletedDocuments: 1,
      deletedStatements: 2,
      request_id: 'req_delete_sweep',
    })
    expect(runDeletionSweepMock).toHaveBeenCalledWith({ trigger: 'cron' })
  })

  it('runs the stale survivor monitor for valid cron requests', async () => {
    checkDeletionSurvivorsMock.mockResolvedValue({
      status: 'red',
      documentSurvivors: 1,
      statementSurvivors: 0,
      totalSurvivors: 1,
    })

    const response = await monitorViaCron(
      new Request('http://localhost/api/ops/deletion/monitor', {
        headers: {
          'x-cron-secret': 'cron_test_secret',
          'x-request-id': 'req_delete_monitor',
        },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 'red',
      totalSurvivors: 1,
      request_id: 'req_delete_monitor',
    })
    expect(response.status).toBe(500)
    expect(checkDeletionSurvivorsMock).toHaveBeenCalledWith({})
  })
})
