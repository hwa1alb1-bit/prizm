import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/server/supabase-middleware'
import { AppHeader } from '@/components/layout/app-header'
import { DashboardNav } from '@/components/layout/dashboard-nav'
import { getBillingSummaryForUser } from '@/lib/server/billing/summary'
import { FREE_DAILY_PAGE_LIMIT, getDailyUsage, todayInUtc } from '@/lib/server/billing/daily-usage'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let credits: { used: number; included: number; window?: 'monthly' | 'daily' } | undefined
  try {
    const billing = await getBillingSummaryForUser({ userId: user.id })
    if (billing.plan === 'free') {
      const usage = await getDailyUsage({
        supabase,
        userId: user.id,
        date: todayInUtc(),
      })
      credits = {
        used: usage.ok ? usage.pagesUsed : 0,
        included: FREE_DAILY_PAGE_LIMIT,
        window: 'daily',
      }
    } else {
      credits = {
        used: billing.usedCredits,
        included: billing.monthlyCredits,
        window: 'monthly',
      }
    }
  } catch {
    credits = undefined
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--accent-foreground)]"
      >
        Skip to main content
      </a>

      <AppHeader authed accountHref="/app/account" credits={credits} />

      <div className="flex flex-col md:min-h-0 md:flex-row">
        <DashboardNav />
        <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
