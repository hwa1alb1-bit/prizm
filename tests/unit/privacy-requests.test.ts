import { describe, expect, it, vi } from 'vitest'
import { createPrivacyRequest } from '@/lib/server/privacy-requests'

describe('createPrivacyRequest', () => {
  it('writes privacy requests through the atomic RPC that also records audit evidence', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          privacy_request_id: 'privacy_req_123',
          request_type: 'data_export',
          status: 'received',
          due_at: '2026-06-05T00:00:00.000Z',
        },
      ],
      error: null,
    })

    const result = await createPrivacyRequest({
      supabase: { rpc } as never,
      requestType: 'data_export',
      auditEventType: 'privacy.data_export.requested',
      workspaceId: 'workspace_123',
      requestedBy: 'user_123',
      actorIp: '203.0.113.25',
      actorUserAgent: 'vitest',
      routeContext: {
        requestId: 'req_privacy',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/account/data-export',
      },
    })

    expect(result).toEqual({
      ok: true,
      request: {
        id: 'privacy_req_123',
        requestType: 'data_export',
        status: 'received',
        dueAt: '2026-06-05T00:00:00.000Z',
      },
    })
    expect(rpc).toHaveBeenCalledWith('create_privacy_request', {
      p_request_type: 'data_export',
      p_audit_event_type: 'privacy.data_export.requested',
      p_due_at: expect.any(String),
      p_request_id: 'req_privacy',
      p_trace_id: '0123456789abcdef0123456789abcdef',
      p_actor_ip: '203.0.113.25',
      p_actor_user_agent: 'vitest',
    })
  })

  it('maps rejected privacy request writes without leaking database details', async () => {
    const result = await createPrivacyRequest({
      supabase: {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'workspace_write_forbidden' },
        }),
      } as never,
      requestType: 'account_deletion',
      auditEventType: 'privacy.account_deletion.requested',
      workspaceId: 'workspace_123',
      requestedBy: 'user_123',
      actorIp: null,
      actorUserAgent: null,
      routeContext: {
        requestId: 'req_privacy',
        traceId: '0123456789abcdef0123456789abcdef',
        pathname: '/api/v1/account/delete',
      },
      dueDays: 10,
    })

    expect(result).toEqual({ ok: false, reason: 'forbidden' })
  })
})
