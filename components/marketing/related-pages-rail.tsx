import Link from 'next/link'
import { MARKETING_BANKS, type MarketingBank } from '@/lib/marketing/marketing-banks'
import {
  MARKETING_INTEGRATIONS,
  type MarketingIntegration,
} from '@/lib/marketing/marketing-integrations'

type RelatedLink = { href: string; label: string; hint?: string }

export type RelatedRailKind = 'bank' | 'integration' | 'convert'

type RelatedRailProps = {
  kind: RelatedRailKind
  currentSlug: string
}

/**
 * Renders 4–6 sibling links on every programmatic landing page (/bank/[slug],
 * /integrate/[slug], /convert/[slug]). Resolves the "only one dofollow incoming
 * internal link" Ahrefs flag for the programmatic SEO surface by giving each
 * page 4+ additional inbound links from its siblings.
 */
export function RelatedPagesRail({ kind, currentSlug }: RelatedRailProps) {
  const links = buildRelatedLinks(kind, currentSlug)
  if (links.length === 0) return null

  return (
    <nav
      aria-label="Related pages"
      className="mx-auto mt-12 w-full max-w-7xl border-t border-[var(--border)] px-6 pb-12 pt-8 lg:px-8"
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Related conversions
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <span className="block">{link.label}</span>
              {link.hint ? (
                <span className="mt-1 block text-xs text-[var(--text-secondary)]">{link.hint}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function buildRelatedLinks(kind: RelatedRailKind, currentSlug: string): RelatedLink[] {
  const links: RelatedLink[] = []

  // Hub links — always relevant, link to index pages.
  links.push({ href: '/bank', label: 'All supported banks', hint: 'Index of every bank' })
  links.push({ href: '/integrate', label: 'Accounting integrations', hint: 'QuickBooks + Xero' })
  links.push({ href: '/issuers', label: 'Issuers × formats matrix', hint: 'Every supported pair' })

  if (kind === 'bank') {
    // Show 3 sibling banks so the orphan bank gets cross-linked.
    const siblings = MARKETING_BANKS.filter((bank) => bank.slug !== currentSlug).slice(0, 3)
    for (const bank of siblings) {
      links.push({ href: `/bank/${bank.slug}`, label: `${bank.name} PDF converter` })
    }
  } else if (kind === 'integration') {
    const siblings = MARKETING_INTEGRATIONS.filter((i) => i.slug !== currentSlug)
    for (const integration of siblings) {
      links.push({
        href: `/integrate/${integration.slug}`,
        label: `PDF statement to ${integration.name}`,
      })
    }
    // Also cross-link a couple of bank pages so integrations don't dead-end.
    for (const bank of MARKETING_BANKS.slice(0, 2)) {
      links.push({ href: `/bank/${bank.slug}`, label: `${bank.name} PDF converter` })
    }
  } else if (kind === 'convert') {
    // Convert slugs already cross-link via the bank pages; surface integrations
    // and a couple of bank-level pages so each convert page has 4+ inbound paths.
    for (const integration of MARKETING_INTEGRATIONS) {
      links.push({
        href: `/integrate/${integration.slug}`,
        label: `PDF statement to ${integration.name}`,
      })
    }
    for (const bank of MARKETING_BANKS.slice(0, 2)) {
      links.push({ href: `/bank/${bank.slug}`, label: `${bank.name} PDF converter` })
    }
  }

  return links
}

export function relatedBankSiblings(currentSlug: string): MarketingBank[] {
  return MARKETING_BANKS.filter((bank) => bank.slug !== currentSlug)
}

export function relatedIntegrationSiblings(currentSlug: string): MarketingIntegration[] {
  return MARKETING_INTEGRATIONS.filter((integration) => integration.slug !== currentSlug)
}
