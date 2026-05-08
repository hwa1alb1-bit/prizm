import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as checkoutPost } from '@/app/api/v1/billing/checkout/route'
import { POST as portalPost } from '@/app/api/v1/billing/portal/route'
import { createCheckoutSession, createCustomerPortalSession } from '@/lib/server/billing/stripe'
import { rateLimit } from '@/lib/server/ratelimit'
import { requireOwnerOrAdminUser } from '@/lib/server/route-auth'

vi.mock('@/lib/server/route-auth', () => ({
  requireOwnerOrAdminUser: vi.fn(),
}))

vi.mock('@/lib/server/billing/stripe', () => ({
  createCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

const requireOwnerOrAdminUserMock = vi.mocked(requireOwnerOrAdminUser)
const createCheckoutSessionMock = vi.mocked(createCheckoutSession)
const createCustomerPortalSessionMock = vi.mocked(createCustomerPortalSession)
const rateLimitMock = vi.mocked(rateLimit)

describe('billing routes', () => {
  beforeEach(() => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: true,
      context: {
        supabase: {} as never,
        user: { id: 'user_123', email: 'owner@example.com' } as never,
        profile: { workspace_id: 'workspace_123', role: 'owner' },
      },
    })
    createCheckoutSessionMock.mockResolvedValue({
      url: 'https://checkout.stripe.com/c/session_123',
    })
    createCustomerPortalSessionMock.mockResolvedValue({
      url: 'https://billing.stripe.com/p/session_123',
    })
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      resetSeconds: 60,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires owner or admin access for Checkout', async () => {
    requireOwnerOrAdminUserMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_FORBIDDEN',
        title: 'Forbidden',
        detail: 'Owner or admin access is required for this route.',
      },
    })

    const response = await checkoutPost(checkoutRequest({ plan: 'starter' }) as never)

    await expect(response.json()).resolves.toMatchObject({
      status: 403,
      code: 'PRZM_AUTH_FORBIDDEN',
    })
    expect(createCheckoutSessionMock).not.toHaveBeenCalled()
  })

  it('rate-limits Checkout session creation before calling Stripe', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      resetSeconds: 20,
    })

    const response = await checkoutPost(checkoutRequest({ plan: 'starter' }) as never)

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMITED',
    })
    expect(response.headers.get('retry-after')).toBe('20')
    expect(rateLimitMock).toHaveBeenCalledWith('api:billing:user_123', 60, 60)
    expect(createCheckoutSessionMock).not.toHaveBeenCalled()
  })

  it('creates a Checkout session for a paid plan', async () => {
    const response = await checkoutPost(
      checkoutRequest(
        { plan: 'pro', billingCycle: 'annual' },
        { 'x-request-id': 'req_billing' },
      ) as never,
    )

    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body).toEqual({
      url: 'https://checkout.stripe.com/c/session_123',
      request_id: 'req_billing',
      trace_id: expect.any(String),
    })
    expect(createCheckoutSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
        userId: 'user_123',
        customerEmail: 'owner@example.com',
        plan: 'pro',
        billingCycle: 'annual',
      }),
    )
  })

  it('rejects free Checkout requests because free does not need Stripe', async () => {
    const response = await checkoutPost(checkoutRequest({ plan: 'free' }) as never)

    await expect(response.json()).resolves.toMatchObject({
      status: 400,
      code: 'PRZM_VALIDATION_BILLING_CHECKOUT',
    })
    expect(createCheckoutSessionMock).not.toHaveBeenCalled()
  })

  it('creates a Customer Portal session for the workspace customer', async () => {
    const response = await portalPost(portalRequest({ 'x-request-id': 'req_portal' }) as never)

    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body).toEqual({
      url: 'https://billing.stripe.com/p/session_123',
      request_id: 'req_portal',
      trace_id: expect.any(String),
    })
    expect(createCustomerPortalSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
        userId: 'user_123',
      }),
    )
  })

  it('rate-limits Customer Portal session creation before calling Stripe', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      resetSeconds: 25,
    })

    const response = await portalPost(portalRequest() as never)

    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      code: 'PRZM_RATE_LIMITED',
    })
    expect(response.headers.get('retry-after')).toBe('25')
    expect(rateLimitMock).toHaveBeenCalledWith('api:billing:user_123', 60, 60)
    expect(createCustomerPortalSessionMock).not.toHaveBeenCalled()
  })
})

function checkoutRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function portalRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/billing/portal', {
    method: 'POST',
    headers,
  })
}
