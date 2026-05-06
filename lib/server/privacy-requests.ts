import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RouteContext } from './http'
import type { Database } from '../shared/db-types'

export type PrivacyRequestType = 'data_export' | 'account_deletion'
export type PrivacyRequestStatus = 'received' | 'processing' | 'completed' | 'rejected'

export type PrivacyRequestRecord = {
  id: string
  requestType: PrivacyRequestType
  status: PrivacyRequestStatus
  dueAt: string
}

export type CreatePrivacyRequestInput = {
  supabase: SupabaseClient<Database>
  requestType: PrivacyRequestType
  auditEventType: string
  workspaceId: string
  requestedBy: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
  dueDays?: number
}

type PrivacyRequestRow = {
  privacy_request_id: string
  request_type: PrivacyRequestType
  status: PrivacyRequestStatus
  due_at: string
}

type CreatePrivacyRequestRpcArgs = {
  p_request_type: PrivacyRequestType
  p_audit_event_type: string
  p_due_at: string
  p_request_id: string
  p_trace_id: string
  p_actor_ip: string | null
  p_actor_user_agent: string | null
}

type PrivacyRequestClient = {
  rpc: (
    fn: 'create_privacy_request',
    args: CreatePrivacyRequestRpcArgs,
  ) => Promise<{
    data: PrivacyRequestRow[] | null
    error: { message: string } | null
  }>
}

export async function createPrivacyRequest(
  input: CreatePrivacyRequestInput,
): Promise<{ ok: true; request: PrivacyRequestRecord } | { ok: false; reason: string }> {
  const now = new Date()
  const dueAt = new Date(now.getTime() + (input.dueDays ?? 30) * 24 * 60 * 60 * 1000)
  const client = input.supabase as unknown as PrivacyRequestClient

  try {
    const { data, error } = await client.rpc('create_privacy_request', {
      p_request_type: input.requestType,
      p_audit_event_type: input.auditEventType,
      p_due_at: dueAt.toISOString(),
      p_request_id: input.routeContext.requestId,
      p_trace_id: input.routeContext.traceId,
      p_actor_ip: input.actorIp,
      p_actor_user_agent: input.actorUserAgent,
    })

    if (error) return { ok: false, reason: classifyPrivacyRequestRpcError(error.message) }

    const request = data?.[0]
    if (!request) return { ok: false, reason: 'privacy_request_write_failed' }

    return {
      ok: true,
      request: {
        id: request.privacy_request_id,
        requestType: request.request_type,
        status: request.status,
        dueAt: request.due_at,
      },
    }
  } catch {
    return { ok: false, reason: 'privacy_request_write_failed' }
  }
}

function classifyPrivacyRequestRpcError(message: string): string {
  if (message.includes('not_authenticated')) return 'unauthorized'
  if (message.includes('workspace_profile_not_found')) return 'no_workspace'
  if (message.includes('workspace_write_forbidden')) return 'forbidden'
  if (message.includes('invalid_privacy_request_type')) return 'invalid_request_type'
  return 'privacy_request_write_failed'
}
