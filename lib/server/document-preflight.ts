import 'server-only'

import type { RouteContext } from './http'
import { getServiceRoleClient } from './supabase'

const PREFLIGHT_ROLES = new Set(['owner', 'admin', 'member'])
const CONVERSION_COST_CREDITS = 1

export type PreflightDuplicateStatus =
  | { isDuplicate: false }
  | { isDuplicate: true; existingDocumentId: string }

export type PreflightDocumentUploadInput = {
  actorUserId: string
  filename: string
  contentType: 'application/pdf'
  sizeBytes: number
  fileSha256: string
  routeContext: RouteContext
}

export type PreflightDocumentUploadSuccess = {
  ok: true
  quote: { costCredits: 1 }
  currentBalance: number
  canConvert: boolean
  duplicate: PreflightDuplicateStatus
  requestId: string
  traceId: string
}

export type PreflightDocumentUploadFailure = {
  ok: false
  reason: 'workspace_required' | 'forbidden' | 'read_failed'
  status: number
  code: string
  title: string
  detail: string
}

export type PreflightDocumentUploadResult =
  | PreflightDocumentUploadSuccess
  | PreflightDocumentUploadFailure

export type PreflightProfile = {
  workspaceId: string
  role: string
}

export type ActiveDuplicateDocument = {
  id: string
}

export type DocumentPreflightDependencies = {
  getUserProfile: (userId: string) => Promise<PreflightProfile | null>
  getCurrentCreditBalance: (workspaceId: string) => Promise<number>
  findActiveDuplicate: (input: {
    workspaceId: string
    fileSha256: string
    nowIso: string
  }) => Promise<ActiveDuplicateDocument | null>
  now: () => Date
}

type ProfileRow = {
  workspace_id: string
  role: string
}

type CreditRow = {
  balance_after: number
}

type DuplicateRow = {
  id: string
}

type DuplicateDocumentQuery = {
  eq: (column: string, value: string) => DuplicateDocumentQuery
  is: (column: 'deleted_at', value: null) => DuplicateDocumentQuery
  gt: (column: 'expires_at', value: string) => DuplicateDocumentQuery
  neq: (column: 'status', value: string) => DuplicateDocumentQuery
  order: (column: 'created_at', options: { ascending: boolean }) => DuplicateDocumentQuery
  limit: (count: number) => DuplicateDocumentQuery
  maybeSingle: <T>() => Promise<{ data: T | null; error: { message: string } | null }>
}

export async function preflightDocumentUpload(
  input: PreflightDocumentUploadInput,
  deps: DocumentPreflightDependencies = createDocumentPreflightDependencies(),
): Promise<PreflightDocumentUploadResult> {
  try {
    const profile = await deps.getUserProfile(input.actorUserId)
    if (!profile) return preflightProblem('workspace_required')
    if (!PREFLIGHT_ROLES.has(profile.role)) return preflightProblem('forbidden')

    const [currentBalance, duplicateDocument] = await Promise.all([
      deps.getCurrentCreditBalance(profile.workspaceId),
      deps.findActiveDuplicate({
        workspaceId: profile.workspaceId,
        fileSha256: input.fileSha256,
        nowIso: deps.now().toISOString(),
      }),
    ])

    const duplicate: PreflightDuplicateStatus = duplicateDocument
      ? { isDuplicate: true, existingDocumentId: duplicateDocument.id }
      : { isDuplicate: false }

    return {
      ok: true,
      quote: { costCredits: CONVERSION_COST_CREDITS },
      currentBalance,
      canConvert: !duplicateDocument && currentBalance >= CONVERSION_COST_CREDITS,
      duplicate,
      requestId: input.routeContext.requestId,
      traceId: input.routeContext.traceId,
    }
  } catch {
    return preflightProblem('read_failed')
  }
}

function createDocumentPreflightDependencies(): DocumentPreflightDependencies {
  return {
    getUserProfile: getUserProfileForPreflight,
    getCurrentCreditBalance,
    findActiveDuplicate,
    now: () => new Date(),
  }
}

async function getUserProfileForPreflight(userId: string): Promise<PreflightProfile | null> {
  const { data, error } = await getServiceRoleClient()
    .from('user_profile')
    .select('workspace_id, role')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()

  if (error) throw new Error('preflight_profile_read_failed')
  if (!data) return null
  return {
    workspaceId: data.workspace_id,
    role: data.role,
  }
}

async function getCurrentCreditBalance(workspaceId: string): Promise<number> {
  const { data, error } = await getServiceRoleClient()
    .from('credit_ledger')
    .select('balance_after')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CreditRow>()

  if (error) throw new Error('preflight_credit_balance_read_failed')
  return data?.balance_after ?? 0
}

async function findActiveDuplicate(input: {
  workspaceId: string
  fileSha256: string
  nowIso: string
}): Promise<ActiveDuplicateDocument | null> {
  const client = getServiceRoleClient() as unknown as {
    from: (table: 'document') => {
      select: (columns: string) => DuplicateDocumentQuery
    }
  }

  const { data, error } = await client
    .from('document')
    .select('id')
    .eq('workspace_id', input.workspaceId)
    .eq('file_sha256', input.fileSha256)
    .is('deleted_at', null)
    .gt('expires_at', input.nowIso)
    .neq('status', 'expired')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<DuplicateRow>()

  if (error) throw new Error('preflight_duplicate_read_failed')
  return data ? { id: data.id } : null
}

function preflightProblem(
  reason: PreflightDocumentUploadFailure['reason'],
): PreflightDocumentUploadFailure {
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
        detail: 'Owner, admin, or member access is required to preflight documents.',
      }
    case 'read_failed':
      return {
        ok: false,
        reason,
        status: 500,
        code: 'PRZM_INTERNAL_PREFLIGHT_FAILED',
        title: 'Preflight could not be prepared',
        detail: 'The document preflight could not be prepared. Try again later.',
      }
  }
}
