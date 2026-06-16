import type { Metadata } from 'next'
import { AppHeader } from '@/components/layout/app-header'

export const metadata: Metadata = {
  title: 'FAQ — StatementStudio',
  description: 'Common questions about StatementStudio billing, page quotas, and cancellations.',
}

const faqs = [
  {
    question: 'What counts as a "page"?',
    answer:
      'A page is any PDF page from which we extracted at least one transaction row. Account-summary, fee-disclosure, and marketing pages do not count toward your quota.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. There is no commitment. You keep access through the end of your current billing period and any pages already credited remain usable until then.',
  },
  {
    question: 'What if I exceed my quota?',
    answer:
      'On the free plan you are blocked from new conversions until the next UTC midnight reset. On a paid plan you are prompted to add credits or upgrade before the next conversion starts.',
  },
  {
    question: 'Do unused pages roll over?',
    answer:
      'No. Free-plan pages reset each UTC midnight. Paid-plan credits expire at the end of their billing period.',
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader authed={false} />
      <main className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-5xl">
          Frequently asked questions
        </h1>
        <p className="mt-4 text-base text-foreground/70">
          Quick answers about pages, quotas, billing, and what we keep after a conversion.
        </p>
        <dl className="mt-12 space-y-10">
          {faqs.map((item) => (
            <div key={item.question}>
              <dt>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {item.question}
                </h2>
              </dt>
              <dd className="mt-3 text-base leading-7 text-foreground/75">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  )
}
