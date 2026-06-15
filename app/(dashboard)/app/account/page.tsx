import { AccountForm } from '@/components/account/account-form'
import { getBillingSummaryForUser } from '@/lib/server/billing/summary'
import { getSettingsSummaryForUser } from '@/lib/server/settings/summary'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) {
    return <AccountProblem title={auth.problem.title} detail={auth.problem.detail} />
  }

  let settings
  let billing
  try {
    ;[settings, billing] = await Promise.all([
      getSettingsSummaryForUser({ userId: auth.context.user.id }),
      getBillingSummaryForUser({ userId: auth.context.user.id }),
    ])
  } catch {
    return (
      <AccountProblem
        title="Account is unavailable"
        detail="Account and billing state could not be loaded."
      />
    )
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-foreground/10 pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-2 text-sm leading-6 text-foreground/65">
          Manage your profile, password, billing, and session.
        </p>
      </header>

      <AccountForm settings={settings} billing={billing} />
    </div>
  )
}

function AccountProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="max-w-lg border-y border-foreground/10 py-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-foreground/60">{detail}</p>
    </div>
  )
}
