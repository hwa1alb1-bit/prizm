import { describe, expect, it, vi } from 'vitest'
import { collectConnectorHealthSnapshot, type ConnectorProbe } from '@/lib/server/connector-health'

describe('connector health module', () => {
  it('uses only config probes for shallow health', async () => {
    const auth = vi.fn().mockResolvedValue({ ok: true })
    const live = vi.fn().mockResolvedValue({ ok: true })

    const snapshot = await collectConnectorHealthSnapshot(
      [
        {
          name: 'textract',
          required: true,
          config: () => ({ ok: true }),
          auth,
          live,
        },
      ],
      { deep: false, includeErrorCodes: false },
    )

    expect(snapshot.status).toBe('ok')
    expect(auth).not.toHaveBeenCalled()
    expect(live).not.toHaveBeenCalled()
  })

  it('runs config, auth, and live probes for deep health', async () => {
    const probes: ConnectorProbe[] = [
      {
        name: 's3',
        required: true,
        config: () => ({ ok: true }),
        auth: vi.fn().mockResolvedValue({ ok: true }),
        live: vi.fn().mockResolvedValue({ ok: true }),
      },
    ]

    const snapshot = await collectConnectorHealthSnapshot(probes, {
      deep: true,
      includeErrorCodes: true,
    })

    expect(snapshot).toMatchObject({
      status: 'ok',
      httpStatus: 200,
      connectors: [{ name: 's3', ok: true, required: true }],
    })
    expect(probes[0]?.auth).toHaveBeenCalled()
    expect(probes[0]?.live).toHaveBeenCalled()
  })

  it('classifies required auth failures as degraded health', async () => {
    const snapshot = await collectConnectorHealthSnapshot(
      [
        {
          name: 'stripe',
          required: true,
          config: () => ({ ok: true }),
          auth: () => ({ ok: false, error: 'forbidden' }),
        },
      ],
      { deep: true, includeErrorCodes: true },
    )

    expect(snapshot).toMatchObject({
      status: 'degraded',
      httpStatus: 503,
      connectors: [
        {
          name: 'stripe',
          ok: false,
          required: true,
          errorCode: 'connector_auth_failed',
        },
      ],
    })
  })

  it('classifies AWS service subscription failures separately from generic connector failures', async () => {
    const snapshot = await collectConnectorHealthSnapshot(
      [
        {
          name: 'textract',
          required: true,
          config: () => ({ ok: true }),
          auth: () => ({
            ok: false,
            error: 'The AWS Access Key Id needs a subscription for the service.',
          }),
        },
      ],
      { deep: true, includeErrorCodes: true },
    )

    expect(snapshot).toMatchObject({
      status: 'degraded',
      httpStatus: 503,
      connectors: [
        {
          name: 'textract',
          ok: false,
          required: true,
          errorCode: 'connector_subscription_required',
        },
      ],
    })
  })
})
