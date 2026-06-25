import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/server/supabase-middleware'
import { JsonLd } from '@/components/marketing/json-ld'
import { PricingSection } from '@/components/marketing/pricing-section'
import { SiteFooter } from '@/components/marketing/site-footer'
import { AppHeader } from '@/components/layout/app-header'
import { WorkflowStepsRail } from '@/components/marketing/workflow-steps-rail'
import { TrustCards } from '@/components/marketing/trust-cards'
import { UploadHero } from '@/components/marketing/upload-hero'
import { LandingHeroCopy } from '@/components/marketing/landing-hero-copy'
import { getBillingSummaryForUser } from '@/lib/server/billing/summary'
import { FREE_DAILY_PAGE_LIMIT, getDailyUsage, todayInUtc } from '@/lib/server/billing/daily-usage'
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildSoftwareApplicationJsonLd,
} from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'Bank Statement Converter: PDF to Excel, CSV, QuickBooks, Xero | StatementStudio',
  description:
    'Convert PDF bank and credit card statements into QuickBooks, Xero, Excel, and CSV files. Automatic mathematical reconciliation to the cent with 24-hour auto-deletion.',
  path: '/',
})

type Visitor = {
  authenticated: boolean
  credits?: { used: number; included: number; window?: 'monthly' | 'daily' }
}

async function detectVisitor(): Promise<Visitor> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { authenticated: false }
  }
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { authenticated: false }
    try {
      const billing = await getBillingSummaryForUser({ userId: user.id })
      if (billing.plan === 'free') {
        const usage = await getDailyUsage({ supabase, userId: user.id, date: todayInUtc() })
        return {
          authenticated: true,
          credits: {
            used: usage.ok ? usage.pagesUsed : 0,
            included: FREE_DAILY_PAGE_LIMIT,
            window: 'daily',
          },
        }
      }
      return {
        authenticated: true,
        credits: {
          used: billing.usedCredits,
          included: billing.monthlyCredits,
          window: 'monthly',
        },
      }
    } catch {
      return { authenticated: true }
    }
  } catch {
    return { authenticated: false }
  }
}

export default async function Home() {
  const visitor = await detectVisitor()

  return (
    <>
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildSoftwareApplicationJsonLd()} />
      <JsonLd data={buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }])} />

      <AppHeader authed={visitor.authenticated} credits={visitor.credits} />

      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-14 lg:gap-12 lg:px-8 lg:py-18">
          <LandingHeroCopy />
          <Suspense fallback={null}>
            <UploadHero
              isAuthenticated={visitor.authenticated}
              rightRailExtras={<WorkflowStepsRail />}
            />
          </Suspense>
        </section>
        <TrustCards />
        <PricingSection isAuthenticated={visitor.authenticated} />
      </main>

      <SiteFooter />
    </>
  )
}
