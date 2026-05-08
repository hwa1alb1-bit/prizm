import { describe, expect, it, vi } from 'vitest'
import { getSettingsSummaryForUser } from '@/lib/server/settings/summary'
import { getServiceRoleClient } from '@/lib/server/supabase'

vi.mock('@/lib/server/supabase', () => ({
  getServiceRoleClient: vi.fn(),
}))

describe('getSettingsSummaryForUser', () => {
  it('loads account, workspace, and member count through the trusted server client', async () => {
    const serviceRole = settingsSupabase()
    vi.mocked(getServiceRoleClient).mockReturnValue(serviceRole as never)

    const summary = await getSettingsSummaryForUser({
      userId: 'user_123',
    })

    expect(summary).toEqual({
      account: {
        email: 'owner@example.com',
        fullName: 'Owner Example',
        role: 'owner',
      },
      workspace: {
        id: 'workspace_123',
        name: 'Example Books',
        defaultRegion: 'us-east-1',
        memberCount: 2,
        createdAt: '2026-05-01T12:00:00.000Z',
      },
      controls: {
        retentionHours: 24,
        maxPdfSizeMb: 50,
        exportFormats: ['CSV', 'XLSX'],
        securityEmail: 'security@prizmview.app',
      },
    })
    expect(getServiceRoleClient).toHaveBeenCalled()
    expect(serviceRole.from).toHaveBeenCalledWith('user_profile')
    expect(serviceRole.from).toHaveBeenCalledWith('workspace')
    expect(serviceRole.selectCalls).toContainEqual([
      'user_profile',
      '*',
      { count: 'exact', head: true },
    ])
  })

  it('fails closed when the workspace member count cannot be loaded', async () => {
    const serviceRole = settingsSupabase({ memberError: 'timeout' })
    vi.mocked(getServiceRoleClient).mockReturnValue(serviceRole as never)

    await expect(getSettingsSummaryForUser({ userId: 'user_123' })).rejects.toThrow(
      'settings_members_not_found',
    )
  })
})

function settingsSupabase(options: { memberError?: string } = {}) {
  const selectCalls: Array<[string, string, unknown?]> = []
  return {
    selectCalls,
    from: vi.fn((table: 'user_profile' | 'workspace') => ({
      select: vi.fn((columns: string, optionsArg?: unknown) => {
        selectCalls.push([table, columns, optionsArg])
        if (table === 'user_profile' && columns === 'workspace_id, email, full_name, role') {
          return eqBuilder({
            singleResult: {
              workspace_id: 'workspace_123',
              email: 'owner@example.com',
              full_name: 'Owner Example',
              role: 'owner',
            },
          })
        }

        if (table === 'workspace') {
          return eqBuilder({
            singleResult: {
              id: 'workspace_123',
              name: 'Example Books',
              default_region: 'us-east-1',
              created_at: '2026-05-01T12:00:00.000Z',
            },
          })
        }

        return eqBuilder({
          countResult: options.memberError
            ? { count: null, error: { message: options.memberError } }
            : { count: 2, error: null },
        })
      }),
    })),
  }
}

function eqBuilder(input: {
  singleResult?: unknown
  countResult?: { count: number | null; error: { message: string } | null }
}) {
  const result = {
    eq: vi.fn(() => result),
    single: vi.fn().mockResolvedValue({
      data: input.singleResult ?? null,
      error: null,
    }),
    then: (
      resolve: (value: {
        data: null
        count: number | null
        error: { message: string } | null
      }) => unknown,
      reject: (reason: unknown) => unknown,
    ) =>
      Promise.resolve({
        data: null,
        count: input.countResult?.count ?? null,
        error: input.countResult?.error ?? null,
      }).then(resolve, reject),
  }
  return result
}
