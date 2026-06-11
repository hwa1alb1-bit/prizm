import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/server/supabase-middleware'
import { JsonLd } from '@/components/marketing/json-ld'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { PricingSection } from '@/components/marketing/pricing-section'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'
import { SupportedOutputs } from '@/components/marketing/supported-outputs'
import { TrustCards } from '@/components/marketing/trust-cards'
import { UploadHero } from '@/components/marketing/upload-hero'
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
        <Suspense fallback={null}>
          <UploadHero isAuthenticated={isAuthenticated} rightRailExtras={<SupportedOutputs />} />
        </Suspense>
        <HowItWorks />
        <TrustCards />
        <PricingSection isAuthenticated={isAuthenticated} />
      </main>

      <SiteFooter />
    </>
  )
}
