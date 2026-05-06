import Link from 'next/link'
import { ManualRefreshButton } from './manual-refresh-button'
import { PROVIDER_DEFINITIONS } from '@/lib/server/ops/providers'
import type { OpsStatus, OpsUsageSnapshot, ProviderId } from '@/lib/server/ops/types'

type ProviderSummary = {
  id: ProviderId
  displayName: string
  category: string
  status: OpsStatus
  freshness: string
  primaryMetric: OpsUsageSnapshot | null
  metrics: OpsUsageSnapshot[]
}

export function OpsDashboard({ snapshots }: { snapshots: OpsUsageSnapshot[] }) {
  const providers = buildProviderSummaries(snapshots)
  const redCount = providers.filter((provider) => provider.status === 'red').length
  const yellowCount = providers.filter((provider) => provider.status === 'yellow').length
  const staleCount = snapshots.filter((snapshot) => snapshot.freshness !== 'fresh').length
  const lastCollection = latestCollection(snapshots)
  const overallStatus = redCount > 0 ? 'Action required' : yellowCount > 0 ? 'Watch' : 'Operational'

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-foreground/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            Control plane
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ops Dashboard</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat
            label="Overall"
            value={overallStatus}
            tone={redCount > 0 ? 'red' : 'green'}
          />
          <SummaryStat
            label="Critical"
            value={`${redCount} red`}
            tone={redCount > 0 ? 'red' : 'green'}
          />
          <SummaryStat
            label="Warning"
            value={`${yellowCount} yellow`}
            tone={yellowCount > 0 ? 'yellow' : 'green'}
          />
          <SummaryStat
            label="Freshness"
            value={`${staleCount} stale`}
            tone={staleCount > 0 ? 'yellow' : 'green'}
          />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Provider status">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            Critical alerts
          </h2>
          <div className="mt-3 divide-y divide-foreground/10 border-y border-foreground/10">
            {snapshots.filter(isAlertSnapshot).length === 0 ? (
              <p className="py-3 text-sm text-foreground/60">No red or stale provider metrics.</p>
            ) : (
              snapshots.filter(isAlertSnapshot).map((snapshot) => (
                <div key={`${snapshot.provider}:${snapshot.metric}`} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {snapshot.provider} / {snapshot.displayName}
                    </span>
                    <StatusBadge status={snapshot.status} />
                  </div>
                  {snapshot.errorCode && (
                    <p className="mt-1 text-xs text-foreground/55">{snapshot.errorCode}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="border-l border-foreground/10 pl-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            Collection
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-foreground/50">Last snapshot</dt>
              <dd className="font-medium">{lastCollection ?? 'No snapshots yet'}</dd>
            </div>
            <div>
              <dt className="text-foreground/50">Admin audit</dt>
              <dd className="font-medium">Reads, refreshes, and quick links are audited</dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  )
}

function ProviderCard({ provider }: { provider: ProviderSummary }) {
  const metric = provider.primaryMetric
  const progress =
    metric !== null && metric.used !== null && metric.limit !== null && metric.limit > 0
      ? Math.min(100, Math.round((metric.used / metric.limit) * 100))
      : null

  return (
    <article className="rounded-lg border border-foreground/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{provider.displayName}</h2>
          <p className="text-xs uppercase tracking-wide text-foreground/45">{provider.category}</p>
        </div>
        <StatusBadge status={provider.status} />
      </div>

      <div className="mt-4 min-h-16">
        <p className="text-sm font-medium">{metric?.displayName ?? 'No snapshot collected'}</p>
        <p className="mt-1 text-xs text-foreground/55">
          {metric ? formatMetric(metric) : 'Run collector to populate this provider.'}
        </p>
        {progress !== null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className={`h-full ${barClass(provider.status)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/api/ops/links/${provider.id}?target=console`}
          className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          {provider.displayName} console
        </Link>
        <Link
          href={`/api/ops/links/${provider.id}?target=billing`}
          className="rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5"
        >
          Billing
        </Link>
        <ManualRefreshButton provider={provider.id} />
      </div>
    </article>
  )
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'yellow' | 'red'
}) {
  return (
    <div className="min-w-32 border-l border-foreground/10 pl-3">
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold ${textClass(tone)}`}>{value}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status: OpsStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass(status)}`}
    >
      {status}
    </span>
  )
}

function buildProviderSummaries(snapshots: OpsUsageSnapshot[]): ProviderSummary[] {
  return PROVIDER_DEFINITIONS.map((definition) => {
    const metrics = snapshots.filter((snapshot) => snapshot.provider === definition.id)
    const status = worstStatus(metrics.map((metric) => metric.status))
    return {
      id: definition.id,
      displayName: definition.displayName,
      category: definition.category,
      status,
      freshness: metrics.some((metric) => metric.freshness !== 'fresh') ? 'stale' : 'fresh',
      primaryMetric:
        metrics.find((metric) => metric.metric === 'credential_gap') ?? metrics[0] ?? null,
      metrics,
    }
  })
}

function worstStatus(statuses: OpsStatus[]): OpsStatus {
  if (statuses.includes('red')) return 'red'
  if (statuses.includes('yellow')) return 'yellow'
  if (statuses.includes('green')) return 'green'
  return 'gray'
}

function isAlertSnapshot(snapshot: OpsUsageSnapshot): boolean {
  return snapshot.status === 'red' || snapshot.freshness !== 'fresh'
}

function latestCollection(snapshots: OpsUsageSnapshot[]): string | null {
  const latest = snapshots
    .map((snapshot) => new Date(snapshot.collectedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0]

  return latest?.toISOString() ?? null
}

function formatMetric(metric: OpsUsageSnapshot): string {
  if (metric.used === null || metric.limit === null) return metric.freshness
  return `${metric.used} / ${metric.limit} ${metric.unit}`
}

function badgeClass(status: OpsStatus): string {
  switch (status) {
    case 'green':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
    case 'yellow':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
    case 'red':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
    case 'gray':
      return 'bg-foreground/10 text-foreground/60'
  }
}

function textClass(tone: 'green' | 'yellow' | 'red'): string {
  switch (tone) {
    case 'green':
      return 'text-emerald-700 dark:text-emerald-300'
    case 'yellow':
      return 'text-amber-700 dark:text-amber-300'
    case 'red':
      return 'text-red-700 dark:text-red-300'
  }
}

function barClass(status: OpsStatus): string {
  switch (status) {
    case 'green':
      return 'bg-emerald-500'
    case 'yellow':
      return 'bg-amber-500'
    case 'red':
      return 'bg-red-500'
    case 'gray':
      return 'bg-foreground/30'
  }
}
