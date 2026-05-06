import 'server-only'

import { getProviderStaleAfterMinutes, isProviderMetricRequired } from './providers'
import { computeFreshness, computeMetricStatus } from './status'
import { getServiceRoleClient } from '../supabase'
import type { OpsFreshness, OpsMetricUnit, OpsStatus, OpsUsageSnapshot, ProviderId } from './types'

export type OpsUsageSnapshotRow = {
  provider_id: ProviderId
  metric_key: string
  display_name: string | null
  used: number | null
  limit_value: number | null
  unit: OpsMetricUnit
  period_start: string | null
  period_end: string | null
  status: OpsStatus
  freshness: OpsFreshness
  source_url: string | null
  collected_at: string
  error_code: string | null
}

type OpsSnapshotClient = {
  from: (table: 'ops_usage_snapshot') => {
    select: (columns: string) => {
      order: (
        column: 'collected_at',
        options: { ascending: boolean },
      ) => {
        limit: (count: number) => Promise<{
          data: OpsUsageSnapshotRow[] | null
          error: { message: string } | null
        }>
      }
    }
  }
}

type OpsWriteClient = {
  from: (table: string) => {
    insert: (payload: unknown) => Promise<{
      error: { message: string } | null
    }>
  }
}

export async function listLatestOpsSnapshots(): Promise<OpsUsageSnapshot[]> {
  const client = getServiceRoleClient() as unknown as OpsSnapshotClient
  const { data, error } = await client
    .from('ops_usage_snapshot')
    .select(
      'provider_id, metric_key, display_name, used, limit_value, unit, period_start, period_end, status, freshness, source_url, collected_at, error_code',
    )
    .order('collected_at', { ascending: false })
    .limit(200)

  if (error) {
    throw new Error('ops_snapshot_read_failed')
  }

  return normalizeOpsSnapshotRows(data ?? [])
}

export function normalizeOpsSnapshotRows(
  rows: OpsUsageSnapshotRow[],
  options: { now?: Date } = {},
): OpsUsageSnapshot[] {
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      const key = `${row.provider_id}:${row.metric_key}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((row) => {
      const freshness =
        row.freshness === 'failed'
          ? 'failed'
          : computeFreshness({
              collectedAt: row.collected_at,
              now: options.now,
              staleAfterMinutes: getProviderStaleAfterMinutes(row.provider_id),
            })
      const required = isProviderMetricRequired(row.metric_key)
      return {
        provider: row.provider_id,
        metric: row.metric_key,
        displayName: row.display_name ?? row.metric_key,
        used: row.used,
        limit: row.limit_value,
        unit: row.unit,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        status: computeMetricStatus({
          used: row.used,
          limit: row.limit_value,
          required,
          freshness,
          errorCode: row.error_code,
        }),
        freshness,
        sourceUrl: row.source_url ?? '',
        collectedAt: row.collected_at,
        errorCode: row.error_code,
      }
    })
}

export async function writeOpsCollectionResult(input: {
  providerId: ProviderId
  trigger: 'cron' | 'manual' | 'deploy' | 'test'
  status: 'ok' | 'partial' | 'failed'
  metrics: OpsUsageSnapshot[]
  errorDetail?: string
}): Promise<void> {
  const client = getServiceRoleClient() as unknown as OpsWriteClient
  const run = await client.from('ops_collection_run').insert({
    provider_id: input.providerId,
    trigger: input.trigger,
    finished_at: new Date().toISOString(),
    status: input.status,
    metrics_count: input.metrics.length,
    error_detail: input.errorDetail ?? null,
  })

  if (run.error) throw new Error('ops_collection_run_write_failed')

  if (input.metrics.length === 0) return

  const snapshots = await client.from('ops_usage_snapshot').insert(
    input.metrics.map((metric) => ({
      provider_id: metric.provider,
      metric_key: metric.metric,
      display_name: metric.displayName,
      used: metric.used,
      limit_value: metric.limit,
      unit: metric.unit,
      period_start: metric.periodStart,
      period_end: metric.periodEnd,
      status: metric.status,
      freshness: metric.freshness,
      source_url: metric.sourceUrl,
      collected_at: metric.collectedAt,
      error_code: metric.errorCode ?? null,
      error_detail: metric.errorCode ?? null,
      raw_ref: null,
    })),
  )

  if (snapshots.error) throw new Error('ops_snapshot_write_failed')
}
