import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET as collectAllViaCron, POST as collectAll } from '@/app/api/ops/collect/route'
import { collectOpsSnapshots } from '@/lib/server/ops/collector'

vi.mock('@/lib/server/ops/collector', () => ({
  collectOpsSnapshots: vi.fn(),
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

const collectOpsSnapshotsMock = vi.mocked(collectOpsSnapshots)

describe('ops collector route', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects cron collection without the cron secret', async () => {
    const response = await collectAll(
      new Request('http://localhost/api/ops/collect', {
        method: 'POST',
        headers: { 'x-request-id': 'req_collect_denied' },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: 'PRZM_AUTH_CRON_UNAUTHORIZED',
      request_id: 'req_collect_denied',
    })
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(collectOpsSnapshotsMock).not.toHaveBeenCalled()
  })

  it('runs all provider collection for valid cron requests', async () => {
    collectOpsSnapshotsMock.mockResolvedValue({
      status: 'ok',
      providers: 8,
      metrics: 16,
      failures: [],
    })

    const response = await collectAll(
      new Request('http://localhost/api/ops/collect', {
        method: 'POST',
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_collect',
        },
      }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: 'ok',
      providers: 8,
      metrics: 16,
      request_id: 'req_collect',
    })
    expect(collectOpsSnapshotsMock).toHaveBeenCalledWith({ trigger: 'cron' })
  })

  it('supports Vercel Cron GET requests', async () => {
    collectOpsSnapshotsMock.mockResolvedValue({
      status: 'ok',
      providers: 8,
      metrics: 16,
      failures: [],
    })

    const response = await collectAllViaCron(
      new Request('http://localhost/api/ops/collect', {
        headers: {
          authorization: 'Bearer cron_test_secret',
          'x-request-id': 'req_collect_get',
        },
      }) as never,
    )

    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      request_id: 'req_collect_get',
    })
    expect(collectOpsSnapshotsMock).toHaveBeenCalledWith({ trigger: 'cron' })
  })
})
