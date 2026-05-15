import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

describe('pingSupabase', () => {
  beforeEach(() => {
    vi.resetModules()
    createClientMock.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  it('checks the upload-critical document schema and audited upload RPC signature', async () => {
    const client = supabaseClient({
      tableResults: [{ error: null }, { error: null }],
      rpcResult: { error: { code: '22023', message: 'invalid_storage_provider' } },
    })
    createClientMock.mockReturnValue(client)

    const { pingSupabase } = await import('@/lib/server/supabase')

    await expect(pingSupabase()).resolves.toEqual({ ok: true })
    expect(client.from).toHaveBeenNthCalledWith(1, 'workspace')
    expect(client.from).toHaveBeenNthCalledWith(2, 'document')
    expect(client.select).toHaveBeenNthCalledWith(
      2,
      'id, storage_provider, storage_bucket, storage_key',
    )
    expect(client.rpc).toHaveBeenCalledWith(
      'create_pending_document_upload_for_actor',
      expect.objectContaining({
        p_actor_user_id: '00000000-0000-0000-0000-000000000000',
        p_storage_provider: '__schema_probe__',
        p_storage_bucket: 'schema-probe',
        p_storage_key: 'schema-probe.pdf',
      }),
    )
  })

  it('fails health when the production document table is missing storage columns', async () => {
    const client = supabaseClient({
      tableResults: [
        { error: null },
        { error: { code: '42703', message: 'column document.storage_provider does not exist' } },
      ],
      rpcResult: { error: null },
    })
    createClientMock.mockReturnValue(client)

    const { pingSupabase } = await import('@/lib/server/supabase')

    await expect(pingSupabase()).resolves.toEqual({
      ok: false,
      error: 'document upload schema not ready: column document.storage_provider does not exist',
    })
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('fails health when the audited upload RPC has the stale pre-storage signature', async () => {
    const client = supabaseClient({
      tableResults: [{ error: null }, { error: null }],
      rpcResult: {
        error: {
          code: 'PGRST202',
          message: 'Could not find the function public.create_pending_document_upload_for_actor',
        },
      },
    })
    createClientMock.mockReturnValue(client)

    const { pingSupabase } = await import('@/lib/server/supabase')

    await expect(pingSupabase()).resolves.toEqual({
      ok: false,
      error:
        'document upload RPC not ready: Could not find the function public.create_pending_document_upload_for_actor',
    })
  })

  it('fails health if the guarded upload RPC probe unexpectedly succeeds', async () => {
    const client = supabaseClient({
      tableResults: [{ error: null }, { error: null }],
      rpcResult: { error: null },
    })
    createClientMock.mockReturnValue(client)

    const { pingSupabase } = await import('@/lib/server/supabase')

    await expect(pingSupabase()).resolves.toEqual({
      ok: false,
      error: 'document upload RPC probe unexpectedly succeeded',
    })
  })
})

function supabaseClient(input: {
  tableResults: Array<{ error: { code?: string; message: string } | null }>
  rpcResult: { error: { code?: string; message: string } | null }
}) {
  const tableResults = [...input.tableResults]
  const client = {
    from: vi.fn(() => client),
    select: vi.fn(() => client),
    limit: vi.fn(() => Promise.resolve(tableResults.shift() ?? { error: null })),
    rpc: vi.fn(() => Promise.resolve(input.rpcResult)),
  }

  return client
}
