import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RouteContext } from './http'
import { getServiceRoleClient } from './supabase'
import type { Database } from '../shared/db-types'

export type PendingDocumentForCompletion = {
  id: string
  s3Bucket: string
  s3Key: string
  sizeBytes: number
  contentType: string
  status: string
}

type PendingDocumentRow = {
  id: string
  s3_bucket: string
  s3_key: string
  size_bytes: number
  content_type: string
  status: string
  textract_job_id: string | null
  deleted_at: string | null
  expires_at: string
}

type PendingDocumentClient = {
  from: (table: 'document') => {
    select: (columns: string) => {
      eq: (
        column: 'id',
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: PendingDocumentRow | null
          error: { message: string } | null
        }>
      }
    }
  }
}

type ClaimCompletionRpcArgs = {
  p_document_id: string
  p_actor_user_id: string
  p_textract_client_token: string
  p_request_id: string
  p_trace_id: string
  p_actor_ip: string | null
  p_actor_user_agent: string | null
}

type AttachTextractJobRpcArgs = {
  p_document_id: string
  p_actor_user_id: string
  p_textract_job_id: string
  p_request_id: string
  p_trace_id: string
}

type MarkProcessingFailedRpcArgs = {
  p_document_id: string
  p_actor_user_id: string
  p_failure_reason: string
  p_textract_job_id: string | null
  p_request_id: string
  p_trace_id: string
}

type DocumentProcessingRpcClient = {
  rpc: (
    fn:
      | 'claim_pending_document_upload_completion'
      | 'attach_document_textract_job'
      | 'mark_document_processing_failed',
    args: ClaimCompletionRpcArgs | AttachTextractJobRpcArgs | MarkProcessingFailedRpcArgs,
  ) => Promise<{
    data: unknown
    error: { message: string } | null
  }>
}

type DocumentStatusRow = {
  id: string
  status: string
  textract_job_id: string | null
  pages: number | null
  failure_reason: string | null
  deleted_at: string | null
  expires_at: string
}

type DocumentStatusClient = {
  from: (table: 'document') => {
    select: (columns: string) => {
      eq: (
        column: 'id',
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: DocumentStatusRow | null
          error: { message: string } | null
        }>
      }
    }
  }
}

export type GetPendingDocumentForCompletionResult =
  | {
      ok: true
      document: PendingDocumentForCompletion
    }
  | {
      ok: false
      reason: 'not_found' | 'not_pending' | 'read_failed'
      status?: string
      textractJobId?: string | null
    }

export type ClaimPendingDocumentUploadCompletionInput = {
  documentId: string
  actorUserId: string
  textractClientToken: string
  actorIp: string | null
  actorUserAgent: string | null
  routeContext: RouteContext
}

export type AttachTextractJobToDocumentInput = {
  documentId: string
  actorUserId: string
  textractJobId: string
  routeContext: RouteContext
}

export type MarkDocumentProcessingFailedInput = {
  documentId: string
  actorUserId: string
  failureReason: string
  textractJobId: string | null
  routeContext: RouteContext
}

export type DocumentProcessingWriteResult =
  | {
      ok: true
    }
  | {
      ok: false
      reason: 'not_found' | 'not_pending' | 'write_failed'
    }

export type GetDocumentProcessingStatusResult =
  | {
      ok: true
      document: {
        id: string
        status: string
        textractJobId: string | null
        pages: number | null
        failureReason: string | null
      }
    }
  | {
      ok: false
      reason: 'not_found' | 'read_failed'
    }

export async function getPendingDocumentForCompletion(input: {
  supabase: SupabaseClient<Database>
  documentId: string
}): Promise<GetPendingDocumentForCompletionResult> {
  const client = input.supabase as unknown as PendingDocumentClient
  const { data, error } = await client
    .from('document')
    .select(
      'id, s3_bucket, s3_key, size_bytes, content_type, status, textract_job_id, deleted_at, expires_at',
    )
    .eq('id', input.documentId)
    .maybeSingle()

  if (error) return { ok: false, reason: 'read_failed' }
  if (!data) return { ok: false, reason: 'not_found' }
  if (data.deleted_at || Date.parse(data.expires_at) <= Date.now()) {
    return { ok: false, reason: 'not_found' }
  }
  if (data.status === 'processing' && !data.textract_job_id) {
    return {
      ok: true,
      document: {
        id: data.id,
        s3Bucket: data.s3_bucket,
        s3Key: data.s3_key,
        sizeBytes: data.size_bytes,
        contentType: data.content_type,
        status: data.status,
      },
    }
  }
  if (data.status !== 'pending') {
    return {
      ok: false,
      reason: 'not_pending',
      status: data.status,
      textractJobId: data.textract_job_id,
    }
  }

  return {
    ok: true,
    document: {
      id: data.id,
      s3Bucket: data.s3_bucket,
      s3Key: data.s3_key,
      sizeBytes: data.size_bytes,
      contentType: data.content_type,
      status: data.status,
    },
  }
}

export async function claimPendingDocumentUploadCompletion(
  input: ClaimPendingDocumentUploadCompletionInput,
): Promise<DocumentProcessingWriteResult> {
  const rpcClient = getServiceRoleClient() as unknown as DocumentProcessingRpcClient
  const { error } = await rpcClient.rpc('claim_pending_document_upload_completion', {
    p_document_id: input.documentId,
    p_actor_user_id: input.actorUserId,
    p_textract_client_token: input.textractClientToken,
    p_request_id: input.routeContext.requestId,
    p_trace_id: input.routeContext.traceId,
    p_actor_ip: input.actorIp,
    p_actor_user_agent: input.actorUserAgent,
  })

  if (!error) return { ok: true }

  return classifyProcessingWriteError(error.message)
}

export async function attachTextractJobToDocument(
  input: AttachTextractJobToDocumentInput,
): Promise<DocumentProcessingWriteResult> {
  const rpcClient = getServiceRoleClient() as unknown as DocumentProcessingRpcClient
  const { error } = await rpcClient.rpc('attach_document_textract_job', {
    p_document_id: input.documentId,
    p_actor_user_id: input.actorUserId,
    p_textract_job_id: input.textractJobId,
    p_request_id: input.routeContext.requestId,
    p_trace_id: input.routeContext.traceId,
  })

  if (!error) return { ok: true }

  return classifyProcessingWriteError(error.message)
}

export async function markDocumentProcessingFailed(
  input: MarkDocumentProcessingFailedInput,
): Promise<DocumentProcessingWriteResult> {
  const rpcClient = getServiceRoleClient() as unknown as DocumentProcessingRpcClient
  const { error } = await rpcClient.rpc('mark_document_processing_failed', {
    p_document_id: input.documentId,
    p_actor_user_id: input.actorUserId,
    p_failure_reason: input.failureReason,
    p_textract_job_id: input.textractJobId,
    p_request_id: input.routeContext.requestId,
    p_trace_id: input.routeContext.traceId,
  })

  if (!error) return { ok: true }

  return classifyProcessingWriteError(error.message)
}

export async function getDocumentProcessingStatus(input: {
  supabase: SupabaseClient<Database>
  documentId: string
}): Promise<GetDocumentProcessingStatusResult> {
  const client = input.supabase as unknown as DocumentStatusClient
  const { data, error } = await client
    .from('document')
    .select('id, status, textract_job_id, pages, failure_reason, deleted_at, expires_at')
    .eq('id', input.documentId)
    .maybeSingle()

  if (error) return { ok: false, reason: 'read_failed' }
  if (!data) return { ok: false, reason: 'not_found' }
  if (data.deleted_at || Date.parse(data.expires_at) <= Date.now()) {
    return { ok: false, reason: 'not_found' }
  }

  return {
    ok: true,
    document: {
      id: data.id,
      status: data.status,
      textractJobId: data.textract_job_id,
      pages: data.pages,
      failureReason: data.failure_reason,
    },
  }
}

function classifyProcessingWriteError(
  message: string,
): Exclude<DocumentProcessingWriteResult, { ok: true }> {
  if (message.includes('document_not_found')) return { ok: false, reason: 'not_found' }
  if (message.includes('document_not_pending')) return { ok: false, reason: 'not_pending' }
  return { ok: false, reason: 'write_failed' }
}
