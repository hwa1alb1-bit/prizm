import { createServerSupabaseClient } from '@/lib/server/supabase-middleware'
import { JsonLd } from '@/components/marketing/json-ld'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { PricingSection } from '@/components/marketing/pricing-section'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'
import { TrustCards } from '@/components/marketing/trust-cards'
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildSoftwareApplicationJsonLd,
} from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'Bank Statement Converter to Excel and CSV | StatementStudio',
  description:
    'Fast, accurate, and secure conversion of bank and credit card statements. Get clean data you can trust in seconds.',
  path: '/',
})

async function detectIsAuthenticated(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return false
  }
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return Boolean(user)
  } catch {
    return false
  }
}

export default async function Home() {
  const isAuthenticated = await detectIsAuthenticated()

  return (
    <>
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildSoftwareApplicationJsonLd()} />
      <JsonLd data={buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }])} />

      <SiteHeader />

      <main className="flex-1 bg-[var(--background)] text-[var(--text-primary)]">
        <section aria-labelledby="hero-heading" className="border-b border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Bank statement converter
            </p>
            <h1
              id="hero-heading"
              className="mt-3 max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-[var(--text-primary)] sm:text-5xl"
            >
              Turn PDF bank statements into clean spreadsheets.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
              Built for accountants and bookkeepers. Upload one PDF after sign-up, review the
              extracted rows, export to Excel or CSV.
            </p>
          </div>
        </section>
        <HowItWorks />
        <TrustCards />
        <PricingSection isAuthenticated={isAuthenticated} />
      </main>

      <SiteFooter />
    </>
  )
}
