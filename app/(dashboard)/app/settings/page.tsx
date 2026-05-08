import { SettingsDashboard } from '@/components/settings/settings-dashboard'
import { getSettingsSummaryForUser } from '@/lib/server/settings/summary'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) {
    return <SettingsProblem title={auth.problem.title} detail={auth.problem.detail} />
  }

  let summary
  try {
    summary = await getSettingsSummaryForUser({
      userId: auth.context.user.id,
    })
  } catch {
    return (
      <SettingsProblem
        title="Settings are unavailable"
        detail="Workspace settings could not be loaded."
      />
    )
  }

  return <SettingsDashboard summary={summary} />
}

function SettingsProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="max-w-lg border-y border-foreground/10 py-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-foreground/60">{detail}</p>
    </div>
  )
}
