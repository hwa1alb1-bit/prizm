import 'server-only'

import { recordAuditEvent } from '../audit'
import { getProviderAdapters, isProviderId } from './providers'
import { computeMetricStatus } from './status'
import { writeOpsCollectionResult } from './store'
import type { OpsUsageSnapshot } from './types'
import type { ProviderId } from './types'

export type OpsCollectionResult = {
  status: 'ok' | 'partial' | 'failed'
  providers: number
  metrics: number
  failures: Array<{ provider: string; errorCode: string }>
}

export async function collectOpsSnapshots(input: {
  trigger: 'cron' | 'manual' | 'deploy' | 'test'
}): Promise<OpsCollectionResult> {
  const adapters = getProviderAdapters()
  return collectAdapters(adapters, input.trigger)
}

export async function collectOpsProviderSnapshots(input: {
  provider: ProviderId | string
  trigger: 'manual' | 'test'
}): Promise<OpsCollectionResult> {
  if (!isProviderId(input.provider)) {
    return {
      status: 'failed',
      providers: 0,
      metrics: 0,
      failures: [{ provider: input.provider, errorCode: 'provider_not_found' }],
    }
  }

  const adapter = getProviderAdapters().find((candidate) => candidate.id === input.provider)
  if (!adapter) {
    return {
      status: 'failed',
      providers: 0,
      metrics: 0,
      failures: [{ provider: input.provider, errorCode: 'provider_not_found' }],
    }
  }

  return collectAdapters([adapter], input.trigger)
}

async function collectAdapters(
  adapters: ReturnType<typeof getProviderAdapters>,
  trigger: 'cron' | 'manual' | 'deploy' | 'test',
): Promise<OpsCollectionResult> {
  const failures: OpsCollectionResult['failures'] = []
  let metrics = 0

  await Promise.all(
    adapters.map(async (adapter) => {
      try {
        const providerMetrics = await adapter.collect()
        const collectedAt = new Date().toISOString()
        const snapshots = providerMetrics.map((metric): OpsUsageSnapshot => {
          const freshness = metric.errorCode ? 'failed' : 'fresh'
          return {
            provider: adapter.id,
            metric: metric.metricKey,
            displayName: metric.displayName,
            used: metric.used,
            limit: metric.limit,
            unit: metric.unit,
            periodStart: metric.periodStart ?? null,
            periodEnd: metric.periodEnd ?? null,
            freshness,
            status: computeMetricStatus({
              used: metric.used,
              limit: metric.limit,
              required: metric.required ?? true,
              freshness,
              errorCode: metric.errorCode,
            }),
            sourceUrl: metric.sourceUrl,
            collectedAt,
            errorCode: metric.errorCode ?? null,
          }
        })

        metrics += snapshots.length
        await writeOpsCollectionResult({
          providerId: adapter.id,
          trigger,
          status: snapshots.some((snapshot) => snapshot.status === 'red') ? 'partial' : 'ok',
          metrics: snapshots,
        })
        await recordAuditEvent({
          eventType: 'ops.provider_collection_completed',
          targetType: 'ops_provider',
          metadata: {
            provider: adapter.id,
            trigger,
            status: snapshots.some((snapshot) => snapshot.status === 'red') ? 'partial' : 'ok',
            metrics_count: snapshots.length,
          },
        })
      } catch {
        const snapshot: OpsUsageSnapshot = {
          provider: adapter.id,
          metric: 'collector_status',
          displayName: `${adapter.displayName} collector status`,
          used: null,
          limit: null,
          unit: 'status',
          periodStart: null,
          periodEnd: null,
          freshness: 'failed',
          status: 'red',
          sourceUrl: adapter.sourceUrl,
          collectedAt: new Date().toISOString(),
          errorCode: 'provider_collection_failed',
        }
        metrics += 1
        failures.push({ provider: adapter.id, errorCode: 'provider_collection_failed' })
        await writeOpsCollectionResult({
          providerId: adapter.id,
          trigger,
          status: 'failed',
          errorDetail: 'provider_collection_failed',
          metrics: [snapshot],
        })
        await recordAuditEvent({
          eventType: 'ops.provider_collection_failed',
          targetType: 'ops_provider',
          metadata: {
            provider: adapter.id,
            trigger,
            error_code: 'provider_collection_failed',
          },
        })
      }
    }),
  )

  const status =
    failures.length === 0 ? 'ok' : failures.length === adapters.length ? 'failed' : 'partial'

  return {
    status,
    providers: adapters.length,
    metrics,
    failures,
  }
}
