import 'server-only'

import { processExtractionDocuments } from './document-processing'
import type { RouteContext } from './http'
import { getServiceRoleClient } from './supabase'

const STATUS_ROLES = new Set(['owner', 'admin', 'member', 'viewer'])

export type DocumentStatusInput = {
  documentId: string
  actorUserId: string
  routeContext: RouteContext
}

export type DocumentStatusDuplicate =
  | { isDuplicate: false }
  | { isDuplicate: true; existingDocumentId: string }

export type DocumentRetentionStatus = {
  expiresAt: string
  deletedAt: string | null
  deletionStatus: 'retained' | 'deleted' | 'expired'
}

export type DocumentStatusSuccess = {
  ok: true
  documentId: string
  state: string
  extractionEngine: string | null
  extractionJobId: string | null
  textractJobId: string | null
  chargeStatus: string | null
  duplicate: DocumentStatusDuplicate
  retention: DocumentRetentionStatus
  requestId: string
  traceId: string
}

export type DocumentStatusFailure = {
  ok: false
  reason: 'workspace_required' | 'forbidden' | 'not_found' | 'read_failed'
  status: number
  code: string
  title: string
  detail: string
}

export type DocumentStatusResult = DocumentStatusSuccess | DocumentStatusFailure

export type StatusProfile = {
  workspaceId: string
  role: string
}

export type StatusDocument = {
  id: string
  workspaceId: string
  status: string
  extractionEngine: string | null
  extractionJobId: string | null
  textractJobId: string | null
  chargeStatus: string | null
  duplicateOfDocumentId: string | null
  expiresAt: string
  deletedAt: string | null
}

export type DocumentStatusDependencies = {
  getUserProfile: (userId: string) => Promise<StatusProfile | null>
  getDocument: (documentId: string) => Promise<StatusDocument | null>
  finalizeProcessingDocument: (input: {
    documentId: string
    routeContext: RouteContext
  }) => Promise<void>
  now: () => Date
}

type ProfileRow = {
  workspace_id: string
  role: string
}

type DocumentRow = {
  id: string
  workspace_id: string
  status: string
  extraction_engine: string | null
  extraction_job_id: string | null
  textract_job_id: string | null
  charge_status: string | null
  duplicate_of_document_id: string | null
  expires_at: string
  deleted_at: string | null
}

export async function getDocumentStatus(
  input: DocumentStatusInput,
  deps: DocumentStatusDependencies = createDocumentStatusDependencies(),
): Promise<DocumentStatusResult> {
  try {
    const profile = await deps.getUserProfile(input.actorUserId)
    if (!profile) return statusProblem('workspace_required')
    if (!STATUS_ROLES.has(profile.role)) return statusProblem('forbidden')

    let document = await deps.getDocument(input.documentId)
    if (!document) return statusProblem('not_found')
    if (document.workspaceId !== profile.workspaceId) return statusProblem('forbidden')

    if (document.status === 'processing') {
      await deps.finalizeProcessingDocument({
        documentId: document.id,
        routeContext: input.routeContext,
      })
      document = await deps.getDocument(input.documentId)
      if (!document) return statusProblem('not_found')
      if (document.workspaceId !== profile.workspaceId) return statusProblem('forbidden')
    }

    return {
      ok: true,
      documentId: document.id,
      state: document.status,
      extractionEngine: document.extractionEngine,
      extractionJobId: document.extractionJobId,
      textractJobId:
        document.textractJobId ??
        (document.extractionEngine === 'textract' ? document.extractionJobId : null),
      chargeStatus: document.chargeStatus,
      duplicate: document.duplicateOfDocumentId
        ? { isDuplicate: true, existingDocumentId: document.duplicateOfDocumentId }
        : { isDuplicate: false },
      retention: retentionStatus(document, deps.now()),
      requestId: input.routeContext.requestId,
      traceId: input.routeContext.traceId,
    }
  } catch {
    return statusProblem('read_failed')
  }
}

function createDocumentStatusDependencies(): DocumentStatusDependencies {
  return {
    getUserProfile: getUserProfileForStatus,
    getDocument: getDocumentForStatus,
    finalizeProcessingDocument,
    now: () => new Date(),
  }
}

async function finalizeProcessingDocument(input: {
  documentId: string
  routeContext: RouteContext
}): Promise<void> {
  await processExtractionDocuments({
    trigger: 'status',
    limit: 1,
    documentId: input.documentId,
    routeContext: input.routeContext,
  })
}

async function getUserProfileForStatus(userId: string): Promise<StatusProfile | null> {
  const { data, error } = await getServiceRoleClient()
    .from('user_profile')
    .select('workspace_id, role')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()

  if (error) throw new Error('status_profile_read_failed')
  if (!data) return null
  return {
    workspaceId: data.workspace_id,
    role: data.role,
  }
}

async function getDocumentForStatus(documentId: string): Promise<StatusDocument | null> {
  const { data, error } = await getServiceRoleClient()
    .from('document')
    .select(
      [
        'id',
        'workspace_id',
        'status',
        'extraction_engine',
        'extraction_job_id',
        'textract_job_id',
        'charge_status',
        'duplicate_of_document_id',
        'expires_at',
        'deleted_at',
      ].join(', '),
    )
    .eq('id', documentId)
    .maybeSingle<DocumentRow>()

  if (error) throw new Error('status_document_read_failed')
  return data
    ? {
        id: data.id,
        workspaceId: data.workspace_id,
        status: data.status,
        extractionEngine: data.extraction_engine,
        extractionJobId: data.extraction_job_id,
        textractJobId: data.textract_job_id,
        chargeStatus: data.charge_status,
        duplicateOfDocumentId: data.duplicate_of_document_id,
        expiresAt: data.expires_at,
        deletedAt: data.deleted_at,
      }
    : null
}

function retentionStatus(document: StatusDocument, now: Date): DocumentRetentionStatus {
  const expired = new Date(document.expiresAt).getTime() <= now.getTime()
  return {
    expiresAt: document.expiresAt,
    deletedAt: document.deletedAt,
    deletionStatus: document.deletedAt ? 'deleted' : expired ? 'expired' : 'retained',
  }
}

function statusProblem(reason: DocumentStatusFailure['reason']): DocumentStatusFailure {
  switch (reason) {
    case 'workspace_required':
      return {
        ok: false,
        reason,
        status: 403,
        code: 'PRZM_AUTH_WORKSPACE_REQUIRED',
        title: 'Workspace access required',
        detail: 'The signed-in user is not attached to a workspace.',
      }
    case 'forbidden':
      return {
        ok: false,
        reason,
        status: 403,
        code: 'PRZM_AUTH_FORBIDDEN',
        title: 'Forbidden',
        detail: 'This document is not available in the current workspace.',
      }
    case 'not_found':
      return {
        ok: false,
        reason,
        status: 404,
        code: 'PRZM_DOCUMENT_NOT_FOUND',
        title: 'Document not found',
        detail: 'The requested document does not exist.',
      }
    case 'read_failed':
      return {
        ok: false,
        reason,
        status: 500,
        code: 'PRZM_INTERNAL_DOCUMENT_STATUS_FAILED',
        title: 'Document status could not be read',
        detail: 'The document status could not be read. Try again later.',
      }
  }
}
