import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RouteContext } from './http'
import type { Database } from '../shared/db-types'

type CreatePendingDocumentUploadRpcArgs = {
  p_filename: string
  p_content_type: string
  p_size_bytes: number
  p_s3_bucket: string
  p_s3_key: string
  p_expires_at: string
  p_request_id: string
  p_trace_id: string
  p_actor_ip: string | null
  p_actor_user_agent: string | null
}

type CreatePendingDocumentUploadRpcRow = {
  document_id: string
  s3_key: string
}

type UploadRpcClient = {
  rpc: (
    fn: 'create_pending_document_upload',
    args: CreatePendingDocumentUploadRpcArgs,
  ) => Promise<{
    data: CreatePendingDocumentUploadRpcRow[] | null
    error: { message: string } | null
  }>
}

export type CreatePendingDocumentUploadInput = {
  supabase: SupabaseClient<Database>
  filename: string
  contentType: string
  sizeBytes: number
  s3Bucket: string
  s3Key: string
  expiresAt: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
}

export type CreatePendingDocumentUploadResult =
  | {
      ok: true
      document: {
        id: string
        s3Key: string
      }
    }
  | {
      ok: false
      reason: UploadFailureReason
    }

type UploadFailureReason = 'unauthorized' | 'no_workspace' | 'forbidden' | 'write_failed'

export async function createPendingDocumentUpload(
  input: CreatePendingDocumentUploadInput,
): Promise<CreatePendingDocumentUploadResult> {
  const rpcClient = input.supabase as unknown as UploadRpcClient
  const { data, error } = await rpcClient.rpc('create_pending_document_upload', {
    p_filename: input.filename,
    p_content_type: input.contentType,
    p_size_bytes: input.sizeBytes,
    p_s3_bucket: input.s3Bucket,
    p_s3_key: input.s3Key,
    p_expires_at: input.expiresAt,
    p_request_id: input.routeContext.requestId,
    p_trace_id: input.routeContext.traceId,
    p_actor_ip: input.actorIp,
    p_actor_user_agent: input.actorUserAgent,
  })

  if (error) return { ok: false, reason: classifyUploadRpcError(error.message) }

  const document = data?.[0]
  if (!document) return { ok: false, reason: 'write_failed' }

  return {
    ok: true,
    document: {
      id: document.document_id,
      s3Key: document.s3_key,
    },
  }
}

function classifyUploadRpcError(message: string): UploadFailureReason {
  if (message.includes('not_authenticated')) return 'unauthorized'
  if (message.includes('workspace_profile_not_found')) return 'no_workspace'
  if (message.includes('workspace_write_forbidden')) return 'forbidden'
  return 'write_failed'
}
