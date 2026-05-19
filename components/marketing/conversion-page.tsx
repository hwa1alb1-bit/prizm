import Link from 'next/link'
import type { ConversionPageData } from '@/lib/seo/conversion-pages'
import { relatedConversionLinks } from '@/lib/seo/conversion-pages'
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildSoftwareApplicationJsonLd,
} from '@/lib/seo/site'
import { JsonLd } from './json-ld'

export function ConversionPage({ page }: { page: ConversionPageData }) {
  return (
    <main className="flex-1 bg-background text-foreground">
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildSoftwareApplicationJsonLd()} />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: page.h1, path: page.path },
        ])}
      />
      {page.faq.length > 0 ? <JsonLd data={buildFaqJsonLd(page.faq)} /> : null}

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.75fr)] lg:px-8 lg:py-18">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/50">
            {page.eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl">
            {page.h1}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/70">{page.intro}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {page.primaryCta}
            </Link>
            <Link
              href="/security"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border-subtle)] px-5 text-sm font-medium transition hover:bg-[var(--surface-muted)] active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Review security evidence
            </Link>
          </div>
        </div>

        <aside
          className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5"
          aria-label="Conversion evidence"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
            Evidence ledger
          </p>
          <dl className="mt-4 divide-y divide-[var(--border-subtle)] text-sm">
            {page.evidence.map((item) => (
              <div key={item.label} className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr]">
                <dt className="text-foreground/55">{item.label}</dt>
                <dd className="font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-3 lg:px-8">
          {page.sections.map((section) => (
            <section key={section.title} className="border-t border-[var(--border-subtle)] pt-4">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-foreground/70">{section.body}</p>
              {section.facts ? (
                <dl className="mt-4 space-y-3 text-sm">
                  {section.facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/45">
                        {fact.label}
                      </dt>
                      <dd className="mt-1 font-medium">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          ))}
        </div>
      </section>

      {page.faq.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-normal">
            Questions answered before export
          </h2>
          <div className="mt-6 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {page.faq.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none text-base font-semibold marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                  {item.question}
                </summary>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/70">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <h2 className="text-lg font-semibold">Related conversion pages</h2>
          <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Related conversion pages">
            {relatedConversionLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-subtle)] px-3 font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  )
}
