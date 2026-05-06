import { redirect } from 'next/navigation'
import { OpsDashboard } from '@/components/ops/ops-dashboard'
import { recordAuditEvent } from '@/lib/server/audit'
import { listLatestOpsSnapshots } from '@/lib/server/ops/store'
import { requireOpsAdminUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function OpsPage() {
  const auth = await requireOpsAdminUser()

  if (!auth.ok) {
    if (auth.problem.status === 401) redirect('/ops/login')
    return <OpsProblem title={auth.problem.title} detail={auth.problem.detail} />
  }

  const audit = await recordAuditEvent({
    eventType: 'ops.dashboard_read',
    actorUserId: auth.context.user.id,
    targetType: 'ops_dashboard',
    metadata: { route: '/ops' },
  })

  if (!audit.ok) {
    return (
      <OpsProblem
        title="Dashboard read could not be audited"
        detail="Provider data is unavailable until the dashboard read can be recorded."
      />
    )
  }

  const snapshots = await listLatestOpsSnapshots()

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <OpsDashboard snapshots={snapshots} />
    </main>
  )
}

function OpsProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md border-y border-foreground/10 py-6 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-foreground/60">{detail}</p>
      </div>
    </main>
  )
}
