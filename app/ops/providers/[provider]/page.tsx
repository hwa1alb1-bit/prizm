import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { recordAuditEvent } from '@/lib/server/audit'
import { listLatestOpsSnapshots } from '@/lib/server/ops/store'
import { isProviderId, PROVIDER_DEFINITIONS } from '@/lib/server/ops/providers'
import { requireOpsAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ProviderOpsPage({
  params,
}: {
  params: Promise<{ provider: string }>
}) {
  const { provider } = await params
  if (!isProviderId(provider)) notFound()

  const auth = await requireOpsAdminUser()
  if (!auth.ok) {
    if (auth.problem.status === 401) redirect('/ops/login')
    return <ProviderProblem title={auth.problem.title} detail={auth.problem.detail} />
  }

  const definition = PROVIDER_DEFINITIONS.find((candidate) => candidate.id === provider)
  if (!definition) notFound()

  const audit = await recordAuditEvent({
    eventType: 'ops.provider_drilldown_read',
    actorUserId: auth.context.user.id,
    targetType: 'ops_provider',
    metadata: { provider, route: `/ops/providers/${provider}` },
  })

  if (!audit.ok) {
    return (
      <ProviderProblem
        title="Provider read could not be audited"
        detail="Provider data is unavailable until the read can be recorded."
      />
    )
  }

  const snapshots = (await listLatestOpsSnapshots()).filter(
    (snapshot) => snapshot.provider === provider,
  )

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-foreground/10 pb-4">
        <div>
          <Link href="/ops" className="text-sm text-foreground/60 hover:text-foreground">
            Ops Dashboard
          </Link>
          <h1 className="mt-1 text-3xl font-semibold">{definition.displayName}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/api/ops/links/${provider}?target=console`}
            className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Console
          </Link>
          <Link
            href={`/api/ops/links/${provider}?target=billing`}
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            Billing
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/5 text-xs uppercase tracking-wide text-foreground/50">
            <tr>
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Freshness</th>
              <th className="px-4 py-3">Collected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {snapshots.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-foreground/60">
                  No provider snapshots collected yet.
                </td>
              </tr>
            ) : (
              snapshots.map((snapshot) => (
                <tr key={`${snapshot.provider}:${snapshot.metric}`}>
                  <td className="px-4 py-3 font-medium">{snapshot.displayName}</td>
                  <td className="px-4 py-3">
                    {formatUsage(snapshot.used, snapshot.limit, snapshot.unit)}
                  </td>
                  <td className="px-4 py-3">{snapshot.status}</td>
                  <td className="px-4 py-3">{snapshot.freshness}</td>
                  <td className="px-4 py-3">{snapshot.collectedAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function formatUsage(used: number | null, limit: number | null, unit: string): string {
  if (used === null || limit === null) return unit
  return `${used} / ${limit} ${unit}`
}

function ProviderProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md border-y border-foreground/10 py-6 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-foreground/60">{detail}</p>
      </div>
    </main>
  )
}
