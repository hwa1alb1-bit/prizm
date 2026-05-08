import { BillingDashboard } from '@/components/billing/billing-dashboard'
import { getBillingSummaryForUser } from '@/lib/server/billing/summary'
import { requireAuthenticatedUser } from '@/lib/server/route-auth'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const auth = await requireAuthenticatedUser()
  if (!auth.ok) {
    return <BillingProblem title={auth.problem.title} detail={auth.problem.detail} />
  }

  let summary
  try {
    summary = await getBillingSummaryForUser({
      userId: auth.context.user.id,
    })
  } catch {
    return (
      <BillingProblem
        title="Billing is unavailable"
        detail="Plan and credit state could not be loaded."
      />
    )
  }

  return <BillingDashboard summary={summary} />
}

function BillingProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="max-w-lg border-y border-foreground/10 py-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-foreground/60">{detail}</p>
    </div>
  )
}
