import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/webhooks/stripe/route'
import { processStripeWebhookEvent } from '@/lib/server/billing/webhook-events'
import { getStripeClient } from '@/lib/server/stripe'
import { serverEnv } from '@/lib/shared/env'

vi.mock('@/lib/server/billing/webhook-events', () => ({
  processStripeWebhookEvent: vi.fn(),
}))

vi.mock('@/lib/server/stripe', () => ({
  getStripeClient: vi.fn(),
}))

const getStripeClientMock = vi.mocked(getStripeClient)
const processStripeWebhookEventMock = vi.mocked(processStripeWebhookEvent)
const constructEvent = vi.fn()

describe('Stripe webhook route', () => {
  const originalSecret = serverEnv.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    serverEnv.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    getStripeClientMock.mockReturnValue({
      webhooks: { constructEvent },
    } as never)
    constructEvent.mockReturnValue({
      id: 'evt_123',
      type: 'ping',
      livemode: false,
      data: { object: {} },
    })
    processStripeWebhookEventMock.mockResolvedValue({ processed: true, replayed: false })
  })

  afterEach(() => {
    serverEnv.STRIPE_WEBHOOK_SECRET = originalSecret
    vi.clearAllMocks()
  })

  it('requires webhook configuration', async () => {
    serverEnv.STRIPE_WEBHOOK_SECRET = undefined

    const response = await POST(stripeRequest('{}', 'sig') as never)

    await expect(response.json()).resolves.toMatchObject({
      status: 500,
      code: 'PRZM_INTERNAL_STRIPE_WEBHOOK_CONFIG',
    })
  })

  it('requires a Stripe signature', async () => {
    const response = await POST(stripeRequest('{}') as never)

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_AUTH_STRIPE_SIGNATURE_MISSING',
    })
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('sanitizes invalid signature failures', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('raw stripe parser detail')
    })

    const response = await POST(stripeRequest('{}', 'bad') as never)

    const body = await response.json()
    expect(body).toMatchObject({
      status: 400,
      code: 'PRZM_AUTH_STRIPE_SIGNATURE_INVALID',
    })
    expect(JSON.stringify(body)).not.toContain('raw stripe parser detail')
  })

  it('processes valid events and returns request identifiers', async () => {
    const response = await POST(
      stripeRequest('{}', 'sig', { 'x-request-id': 'req_stripe' }) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ received: true, request_id: 'req_stripe' })
    expect(processStripeWebhookEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt_123', type: 'ping' }),
      expect.objectContaining({ requestId: 'req_stripe' }),
    )
  })

  it('returns a sanitized problem response if webhook handling fails', async () => {
    processStripeWebhookEventMock.mockRejectedValue(new Error('audit table unavailable'))

    const response = await POST(stripeRequest('{}', 'sig') as never)

    const body = await response.json()
    expect(body).toMatchObject({
      status: 500,
      code: 'PRZM_INTERNAL_STRIPE_WEBHOOK_FAILED',
    })
    expect(JSON.stringify(body)).not.toContain('audit table unavailable')
  })
})

function stripeRequest(
  body: string,
  signature?: string,
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/api/v1/webhooks/stripe', {
    method: 'POST',
    headers: {
      ...(signature ? { 'stripe-signature': signature } : {}),
      ...headers,
    },
    body,
  })
}
