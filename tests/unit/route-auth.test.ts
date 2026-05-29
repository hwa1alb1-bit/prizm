import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServerClient } from '@supabase/ssr'
import { requireOpsAdminUser } from '@/lib/server/route-auth'
import { getServiceRoleClient } from '@/lib/server/supabase'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/shared/env', () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  },
  serverEnv: {
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  },
  assertServerEnv: vi.fn(),
  isProduction: false,
}))

vi.mock('@/lib/server/supabase', () => ({
  getServiceRoleClient: vi.fn(),
}))

const createServerClientMock = vi.mocked(createServerClient)
const getServiceRoleClientMock = vi.mocked(getServiceRoleClient)
const getUser = vi.fn()
const maybeSingle = vi.fn()

describe('route auth', () => {
  beforeEach(() => {
    process.env.OPS_ADMIN_EMAIL_ALLOWLIST = 'oneoddbob@gmail.com,heinrich.willem@gmail.com'
    getUser.mockResolvedValue({
      data: { user: { id: 'user_other', email: 'somebody@example.com' } },
      error: null,
    })
    maybeSingle.mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    })
    createServerClientMock.mockReturnValue({
      auth: { getUser },
    } as never)
    getServiceRoleClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      })),
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.OPS_ADMIN_EMAIL_ALLOWLIST
  })

  it('denies an active ops admin whose authenticated email is not allowlisted', async () => {
    const result = await requireOpsAdminUser()

    expect(result).toMatchObject({
      ok: false,
      problem: {
        status: 403,
        code: 'PRZM_AUTH_OPS_FORBIDDEN',
      },
    })
    expect(getServiceRoleClientMock).not.toHaveBeenCalled()
  })

  it('allows an active ops admin whose authenticated email is allowlisted', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user_owner', email: 'OneOddBob@Gmail.com' } },
      error: null,
    })

    const result = await requireOpsAdminUser()

    expect(result).toMatchObject({
      ok: true,
      context: {
        user: { id: 'user_owner' },
        opsAdmin: { role: 'admin' },
      },
    })
    expect(getServiceRoleClientMock).toHaveBeenCalled()
  })
})
