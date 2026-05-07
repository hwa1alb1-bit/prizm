import { describe, expect, it, vi } from 'vitest'
import {
  consumeDocumentConversionCredit,
  releaseDocumentConversionCredit,
  reserveDocumentConversionCredit,
  type CreditReservationRpcClient,
} from '@/lib/server/credit-reservation'

describe('credit reservation lifecycle', () => {
  it('reserves a document conversion credit with actor and trace context', async () => {
    const client = rpcClient([{ charge_status: 'reserved' }])

    const result = await reserveDocumentConversionCredit(
      {
        documentId: 'doc_123',
        actorUserId: 'user_123',
        costCredits: 1,
        actorIp: '203.0.113.10',
        actorUserAgent: 'vitest',
        requestId: 'req_credit',
        traceId: '0123456789abcdef0123456789abcdef',
      },
      client,
    )

    expect(result).toEqual({ ok: true, chargeStatus: 'reserved' })
    expect(client.rpc).toHaveBeenCalledWith('reserve_document_conversion_credit', {
      p_document_id: 'doc_123',
      p_actor_user_id: 'user_123',
      p_cost_credits: 1,
      p_request_id: 'req_credit',
      p_trace_id: '0123456789abcdef0123456789abcdef',
      p_actor_ip: '203.0.113.10',
      p_actor_user_agent: 'vitest',
    })
  })

  it('maps insufficient reservation balance to a domain result', async () => {
    const client = rpcClient(null, { message: 'insufficient_balance' })

    await expect(
      reserveDocumentConversionCredit(
        {
          documentId: 'doc_123',
          actorUserId: 'user_123',
          costCredits: 1,
          actorIp: null,
          actorUserAgent: null,
          requestId: 'req_credit',
          traceId: '0123456789abcdef0123456789abcdef',
        },
        client,
      ),
    ).resolves.toEqual({ ok: false, reason: 'insufficient_balance' })
  })

  it('moves reserved credits to consumed or released charge states', async () => {
    const client = rpcClient([{ charge_status: 'consumed' }])

    await expect(
      consumeDocumentConversionCredit(
        {
          documentId: 'doc_123',
          consumedAt: '2026-05-07T15:00:00.000Z',
        },
        client,
      ),
    ).resolves.toEqual({ ok: true, chargeStatus: 'consumed' })
    expect(client.rpc).toHaveBeenCalledWith('consume_document_conversion_credit', {
      p_document_id: 'doc_123',
      p_consumed_at: '2026-05-07T15:00:00.000Z',
    })

    vi.mocked(client.rpc).mockResolvedValueOnce({
      data: [{ charge_status: 'released' }],
      error: null,
    })

    await expect(
      releaseDocumentConversionCredit(
        {
          documentId: 'doc_123',
          releasedAt: '2026-05-07T15:05:00.000Z',
        },
        client,
      ),
    ).resolves.toEqual({ ok: true, chargeStatus: 'released' })
    expect(client.rpc).toHaveBeenCalledWith('release_document_conversion_credit', {
      p_document_id: 'doc_123',
      p_released_at: '2026-05-07T15:05:00.000Z',
    })
  })
})

function rpcClient(
  data: { charge_status: string }[] | null,
  error: { message: string } | null = null,
): CreditReservationRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  }
}
