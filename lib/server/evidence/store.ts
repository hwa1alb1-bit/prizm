import 'server-only'

import { getServiceRoleClient } from '../supabase'
import type { Json } from '../../shared/db-types'
import type { Soc2EvidenceAuditEventCount, Soc2EvidenceOpsAdmin, Soc2EvidencePack } from './soc2'

type DbError = { message: string }
type QueryResult<T> = { data: T | null; error: DbError | null }

type AuditEventCountRow = {
  event_type: string
  event_count: number | string
}

type OpsAdminRow = {
  user_id: string
  role: 'owner' | 'admin' | 'viewer'
  granted_by: string | null
  created_at: string
}

type OpsAdminAccessReviewAttestationRow = {
  review_id: string
  status: 'approved' | 'changes_required'
  reviewed_at: string
}

type Soc2EvidenceExportRow = {
  export_id: string
  access_review_id: string
}

type OpsAdminSelectBuilder = {
  is: (
    column: 'revoked_at',
    value: null,
  ) => {
    order: (
      column: 'created_at',
      options: { ascending: boolean },
    ) => Promise<QueryResult<OpsAdminRow[]>>
  }
}

type InsertBuilder = {
  select: (columns: 'id') => {
    single: () => Promise<QueryResult<{ id: string }>>
  }
}

type EvidenceStoreClient = {
  from: (table: string) => {
    select: <T = unknown>(columns: string) => T
    insert: (payload: unknown) => InsertBuilder
  }
  rpc: <T = unknown>(fn: string, args: Record<string, unknown>) => Promise<QueryResult<T>>
}

export async function listAuditEventCounts(input: {
  periodStart: string
  periodEnd: string
}): Promise<Soc2EvidenceAuditEventCount[]> {
  const { data, error } = await getEvidenceStoreClient().rpc<AuditEventCountRow[]>(
    'get_soc2_audit_event_counts',
    {
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
    },
  )

  if (error) throw new Error('soc2_audit_event_read_failed')

  return (data ?? [])
    .map((row) => ({ eventType: row.event_type, count: Number(row.event_count) }))
    .sort((a, b) => a.eventType.localeCompare(b.eventType))
}

export async function listActiveOpsAdmins(): Promise<Soc2EvidenceOpsAdmin[]> {
  const { data, error } = await getEvidenceStoreClient()
    .from('ops_admin')
    .select<OpsAdminSelectBuilder>('user_id, role, granted_by, created_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new Error('soc2_ops_admin_read_failed')

  return (data ?? []).flatMap((row): Soc2EvidenceOpsAdmin[] => {
    if (row.role !== 'owner' && row.role !== 'admin') return []

    return [
      {
        userId: row.user_id,
        role: row.role,
        grantedBy: row.granted_by,
        createdAt: row.created_at,
      },
    ]
  })
}

export async function recordSoc2EvidenceExport(input: {
  periodStart: string
  periodEnd: string
  generatedAt: string
  status: Soc2EvidencePack['status']
  pack: Soc2EvidencePack
  activeOpsAdmins: Soc2EvidenceOpsAdmin[]
  trigger: 'cron' | 'manual' | 'test'
}): Promise<{ exportId: string; accessReviewId: string }> {
  const owners = input.activeOpsAdmins.filter((admin) => admin.role === 'owner').length
  const admins = input.activeOpsAdmins.filter((admin) => admin.role === 'admin').length
  const { data, error } = await getEvidenceStoreClient().rpc<Soc2EvidenceExportRow[]>(
    'create_soc2_evidence_export',
    {
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_generated_at: input.generatedAt,
      p_status: input.status,
      p_evidence_pack: input.pack as unknown as Json,
      p_review_item_count: input.pack.reviewItems.length,
      p_provider_quota_red_count: input.pack.controls.providerQuotaReview.redProviders.length,
      p_active_admins: input.activeOpsAdmins as unknown as Json,
      p_active_admin_count: input.activeOpsAdmins.length,
      p_owner_count: owners,
      p_admin_count: admins,
      p_trigger: input.trigger,
    },
  )

  const row = data?.[0] ?? null
  if (error || !row) throw new Error('soc2_evidence_export_write_failed')

  return { exportId: row.export_id, accessReviewId: row.access_review_id }
}

export async function recordOpsAdminAccessReviewAttestation(input: {
  reviewId: string
  status: 'approved' | 'changes_required'
  note: string | null
  reviewedBy: string
  requestId: string
  traceId: string
  actorIp: string | null
  actorUserAgent: string | null
}): Promise<{ reviewId: string; status: 'approved' | 'changes_required'; reviewedAt: string }> {
  const { data, error } = await getEvidenceStoreClient().rpc<OpsAdminAccessReviewAttestationRow[]>(
    'attest_ops_admin_access_review',
    {
      p_review_id: input.reviewId,
      p_reviewer_user_id: input.reviewedBy,
      p_status: input.status,
      p_review_note: input.note,
      p_request_id: input.requestId,
      p_trace_id: input.traceId,
      p_actor_ip: input.actorIp,
      p_actor_user_agent: input.actorUserAgent,
    },
  )

  const row = data?.[0] ?? null
  if (error || !row) throw new Error('ops_admin_access_review_attestation_failed')

  return {
    reviewId: row.review_id,
    status: row.status,
    reviewedAt: row.reviewed_at,
  }
}

function getEvidenceStoreClient(): EvidenceStoreClient {
  return getServiceRoleClient() as unknown as EvidenceStoreClient
}
