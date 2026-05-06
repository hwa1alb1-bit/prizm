import 'server-only'

import type { DeletionHealth } from '../deletion/store'
import { listDeletionHealth } from '../deletion/store'
import type { RouteContext } from '../http'
import { listLatestOpsSnapshots } from '../ops/store'
import type { OpsUsageSnapshot } from '../ops/types'
import {
  listActiveOpsAdmins,
  listAuditEventCounts,
  recordSoc2EvidenceExport,
  recordOpsAdminAccessReviewAttestation,
} from './store'

export type Soc2EvidenceAuditEventCount = {
  eventType: string
  count: number
}

export type Soc2EvidenceOpsAdmin = {
  userId: string
  role: 'owner' | 'admin'
  grantedBy: string | null
  createdAt: string
}

export type Soc2EvidenceReviewItem = {
  id: string
  severity: 'warning' | 'critical'
  title: string
  detail: string
}

export type Soc2EvidencePack = {
  type: 'monthly_soc2'
  status: 'complete' | 'needs_review'
  generatedAt: string
  period: {
    start: string
    end: string
  }
  controls: {
    auditLog: {
      eventCount: number
      eventTypes: number
      events: Soc2EvidenceAuditEventCount[]
    }
    deletionEvidence: DeletionHealth
    providerQuotaReview: {
      providersTotal: number
      redProviders: string[]
      yellowProviders: string[]
      staleProviders: string[]
      reviewRequired: boolean
    }
    opsAdminAccessReview: {
      activeAdmins: number
      owners: number
      admins: number
      reviewRequired: boolean
      adminsByUser: Soc2EvidenceOpsAdmin[]
    }
  }
  reviewItems: Soc2EvidenceReviewItem[]
}

export type Soc2EvidenceExportTrigger = 'cron' | 'manual' | 'test'

export type Soc2EvidenceExportResult = {
  exportId: string
  accessReviewId: string
  pack: Soc2EvidencePack
}

export type OpsAdminAccessReviewAttestationResult = {
  reviewId: string
  status: 'approved' | 'changes_required'
  reviewedAt: string
}

export async function attestOpsAdminAccessReview(input: {
  reviewId: string
  status: OpsAdminAccessReviewAttestationResult['status']
  note?: string | null
  reviewedBy: string
  routeContext: RouteContext
  actorIp?: string | null
  actorUserAgent?: string | null
}): Promise<OpsAdminAccessReviewAttestationResult> {
  return recordOpsAdminAccessReviewAttestation({
    reviewId: input.reviewId,
    status: input.status,
    note: input.note ?? null,
    reviewedBy: input.reviewedBy,
    requestId: input.routeContext.requestId,
    traceId: input.routeContext.traceId,
    actorIp: input.actorIp ?? null,
    actorUserAgent: input.actorUserAgent ?? null,
  })
}

export async function generateSoc2EvidenceExport(input: {
  trigger: Soc2EvidenceExportTrigger
  now?: Date
  periodStart?: string
  periodEnd?: string
}): Promise<Soc2EvidenceExportResult> {
  const now = input.now ?? new Date()
  const period = resolveEvidencePeriod(now, input)
  const generatedAt = now.toISOString()

  const [auditEvents, deletionHealth, providerSnapshots, activeOpsAdmins] = await Promise.all([
    listAuditEventCounts(period),
    listDeletionHealth({ now }),
    listLatestOpsSnapshots(),
    listActiveOpsAdmins(),
  ])

  const pack = buildSoc2EvidencePack({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    generatedAt,
    auditEvents,
    deletionHealth,
    providerSnapshots,
    activeOpsAdmins,
  })

  const exportRecord = await recordSoc2EvidenceExport({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    generatedAt,
    status: pack.status,
    pack,
    activeOpsAdmins,
    trigger: input.trigger,
  })

  return {
    exportId: exportRecord.exportId,
    accessReviewId: exportRecord.accessReviewId,
    pack,
  }
}

export function buildSoc2EvidencePack(input: {
  periodStart: string
  periodEnd: string
  generatedAt: string
  auditEvents: Soc2EvidenceAuditEventCount[]
  deletionHealth: DeletionHealth
  providerSnapshots: OpsUsageSnapshot[]
  activeOpsAdmins: Soc2EvidenceOpsAdmin[]
}): Soc2EvidencePack {
  const redProviders = uniqueProviders(
    input.providerSnapshots.filter((snapshot) => snapshot.status === 'red'),
  )
  const yellowProviders = uniqueProviders(
    input.providerSnapshots.filter((snapshot) => snapshot.status === 'yellow'),
  )
  const staleProviders = uniqueProviders(
    input.providerSnapshots.filter((snapshot) => snapshot.freshness !== 'fresh'),
  )
  const providerReviewRequired =
    redProviders.length > 0 || yellowProviders.length > 0 || staleProviders.length > 0
  const owners = input.activeOpsAdmins.filter((admin) => admin.role === 'owner').length
  const admins = input.activeOpsAdmins.filter((admin) => admin.role === 'admin').length

  const reviewItems: Soc2EvidenceReviewItem[] = [
    ...providerReviewItems({ redProviders, yellowProviders, staleProviders }),
    {
      id: 'ops_admin_monthly_access_review',
      severity: input.activeOpsAdmins.length === 0 || owners === 0 ? 'critical' : 'warning',
      title: 'Monthly ops admin access review required',
      detail: `${input.activeOpsAdmins.length} active ops admin assignment(s) must be reviewed for the monthly SOC 2 access-control evidence pack.`,
    },
  ]

  return {
    type: 'monthly_soc2',
    status: reviewItems.some((item) => item.severity === 'critical' || item.severity === 'warning')
      ? 'needs_review'
      : 'complete',
    generatedAt: input.generatedAt,
    period: {
      start: input.periodStart,
      end: input.periodEnd,
    },
    controls: {
      auditLog: {
        eventCount: input.auditEvents.reduce((total, event) => total + event.count, 0),
        eventTypes: input.auditEvents.length,
        events: input.auditEvents,
      },
      deletionEvidence: input.deletionHealth,
      providerQuotaReview: {
        providersTotal: new Set(input.providerSnapshots.map((snapshot) => snapshot.provider)).size,
        redProviders,
        yellowProviders,
        staleProviders,
        reviewRequired: providerReviewRequired,
      },
      opsAdminAccessReview: {
        activeAdmins: input.activeOpsAdmins.length,
        owners,
        admins,
        reviewRequired: true,
        adminsByUser: input.activeOpsAdmins,
      },
    },
    reviewItems,
  }
}

function resolveEvidencePeriod(
  now: Date,
  explicit: { periodStart?: string; periodEnd?: string },
): { periodStart: string; periodEnd: string } {
  if (explicit.periodStart && explicit.periodEnd) {
    return { periodStart: explicit.periodStart, periodEnd: explicit.periodEnd }
  }

  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const previousMonthStart = new Date(
    Date.UTC(thisMonthStart.getUTCFullYear(), thisMonthStart.getUTCMonth() - 1, 1),
  )

  return {
    periodStart: previousMonthStart.toISOString(),
    periodEnd: thisMonthStart.toISOString(),
  }
}

function uniqueProviders(snapshots: OpsUsageSnapshot[]): string[] {
  return [...new Set(snapshots.map((snapshot) => snapshot.provider))].sort()
}

function providerReviewItems(input: {
  redProviders: string[]
  yellowProviders: string[]
  staleProviders: string[]
}): Soc2EvidenceReviewItem[] {
  const items: Soc2EvidenceReviewItem[] = []

  if (input.redProviders.length > 0) {
    items.push({
      id: 'provider_quota_red',
      severity: 'critical',
      title: 'Provider quota review has red providers',
      detail: `Red provider quota state requires review: ${input.redProviders.join(', ')}.`,
    })
  }

  if (input.yellowProviders.length > 0) {
    items.push({
      id: 'provider_quota_yellow',
      severity: 'warning',
      title: 'Provider quota review has yellow providers',
      detail: `Yellow provider quota state should be reviewed before it becomes an incident: ${input.yellowProviders.join(', ')}.`,
    })
  }

  if (input.staleProviders.length > 0) {
    items.push({
      id: 'provider_quota_stale',
      severity: 'critical',
      title: 'Provider quota evidence is stale',
      detail: `Stale provider quota data requires a collection fix: ${input.staleProviders.join(', ')}.`,
    })
  }

  return items
}
