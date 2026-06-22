import Link from 'next/link'

type Claim = {
  headline: string
  href: string
  cta: string
}

const CLAIMS: ReadonlyArray<Claim> = [
  {
    headline: 'Every export reconciles to the cent, or we tell you why it didn’t.',
    href: '/how-we-verify',
    cta: 'How we verify',
  },
  {
    headline: 'Hundreds of statements ready in under two seconds.',
    href: '/throughput',
    cta: 'See the numbers',
  },
  {
    headline: 'Direct to QuickBooks, Xero, Excel, or CSV.',
    href: '/sample-output',
    cta: 'See the output',
  },
]

export function HeroClaimRow() {
  return (
    <section
      aria-label="What StatementStudio guarantees"
      className="border-t border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-8 px-6 py-10 sm:py-12 md:grid-cols-3 lg:px-8">
        {CLAIMS.map((claim) => (
          <div key={claim.href} className="flex flex-col gap-3">
            <p className="text-[15px] font-medium leading-snug text-[var(--text-primary)]">
              {claim.headline}
            </p>
            <Link
              href={claim.href}
              className="self-start text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {claim.cta} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
