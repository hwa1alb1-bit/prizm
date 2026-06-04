import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/ops/login/route'
import { recordAuditEvent } from '@/lib/server/audit'
import { rateLimit } from '@/lib/server/ratelimit'
import { getServiceRoleClient } from '@/lib/server/supabase'

vi.mock('@/lib/server/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

vi.mock('@/lib/server/ratelimit', () => ({
  rateLimit: vi.fn(),
}))

vi.mock('@/lib/server/supabase', () => ({
  getServiceRoleClient: vi.fn(),
}))

const recordAuditEventMock = vi.mocked(recordAuditEvent)
const rateLimitMock = vi.mocked(rateLimit)
const getServiceRoleClientMock = vi.mocked(getServiceRoleClient)
const signInWithOtp = vi.fn()
const userProfileMaybeSingle = vi.fn()
const opsAdminMaybeSingle = vi.fn()
const from = vi.fn((table: string) => {
  if (table === 'user_profile') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: userProfileMaybeSingle,
        })),
      })),
    }
  }

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        is: vi.fn(() => ({
          maybeSingle: opsAdminMaybeSingle,
        })),
      })),
    })),
  }
})

describe('ops login route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://pdftoexcelstatementconverter.com'
    process.env.OPS_ADMIN_EMAIL_ALLOWLIST = 'oneoddbob@gmail.com,heinrich.willem@gmail.com'
    rateLimitMock.mockResolvedValue({ success: true, limit: 5, remaining: 4, resetSeconds: 60 })
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_ops_login' })
    signInWithOtp.mockResolvedValue({ error: null })
    userProfileMaybeSingle.mockResolvedValue({ data: null, error: null })
    opsAdminMaybeSingle.mockResolvedValue({ data: null, error: null })
    getServiceRoleClientMock.mockReturnValue({
      auth: { signInWithOtp },
      from,
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.OPS_ADMIN_EMAIL_ALLOWLIST
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('returns the generic success response without sending mail for a non-allowlisted email', async () => {
    const response = await POST(
      new Request('http://localhost/api/ops/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.9',
          'user-agent': 'vitest',
        },
        body: JSON.stringify({ email: 'intruder@example.com' }),
      }) as never,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(response.status).toBe(200)
    expect(signInWithOtp).not.toHaveBeenCalled()
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ops.login_link_denied',
        targetType: 'ops_login',
        actorIp: '203.0.113.9',
        actorUserAgent: 'vitest',
      }),
    )
  })

  it('sends an ops magic link for an allowlisted active ops owner', async () => {
    userProfileMaybeSingle.mockResolvedValue({
      data: { id: 'user_owner' },
      error: null,
    })
    opsAdminMaybeSingle.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    })

    const response = await POST(
      new Request('http://localhost/api/ops/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ' OneOddBob@Gmail.com ' }),
      }) as never,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'oneoddbob@gmail.com',
      options: {
        emailRedirectTo: 'https://pdftoexcelstatementconverter.com/auth/callback?next=%2Fops',
        shouldCreateUser: false,
      },
    })
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ops.login_link_sent',
        actorUserId: 'user_owner',
        targetType: 'ops_login',
      }),
    )
  })

  it('does not send mail when the ops login request is rate limited', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      resetSeconds: 300,
    })
    userProfileMaybeSingle.mockResolvedValue({
      data: { id: 'user_owner' },
      error: null,
    })
    opsAdminMaybeSingle.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    })

    const response = await POST(
      new Request('http://localhost/api/ops/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'oneoddbob@gmail.com' }),
      }) as never,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(signInWithOtp).not.toHaveBeenCalled()
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ops.login_link_rate_limited',
        targetType: 'ops_login',
      }),
    )
  })

  it('fails closed when the server email allowlist is missing', async () => {
    delete process.env.OPS_ADMIN_EMAIL_ALLOWLIST

    const response = await POST(
      new Request('http://localhost/api/ops/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'oneoddbob@gmail.com' }),
      }) as never,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(signInWithOtp).not.toHaveBeenCalled()
    expect(getServiceRoleClientMock).not.toHaveBeenCalled()
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ops.login_link_denied',
        targetType: 'ops_login',
      }),
    )
  })

  it('does not send mail for an allowlisted email without an active ops admin row', async () => {
    userProfileMaybeSingle.mockResolvedValue({
      data: { id: 'user_backup' },
      error: null,
    })
    opsAdminMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })

    const response = await POST(
      new Request('http://localhost/api/ops/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'heinrich.willem@gmail.com' }),
      }) as never,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(signInWithOtp).not.toHaveBeenCalled()
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ops.login_link_denied',
        actorUserId: 'user_backup',
        targetType: 'ops_login',
      }),
    )
  })

  it('keeps the response generic when ops authorization lookup is unavailable', async () => {
    getServiceRoleClientMock.mockImplementation(() => {
      throw new Error('service role missing')
    })

    const response = await POST(
      new Request('http://localhost/api/ops/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'oneoddbob@gmail.com' }),
      }) as never,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(response.status).toBe(200)
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
})
