const STEPS = [
  {
    title: 'Securely upload your PDF',
    body: 'Upload bank statements, credit card statements, transaction reports, or other financial PDFs through an encrypted TLS 1.2+ connection.',
  },
  {
    title: 'We extract the data',
    body: 'Our parser identifies transaction dates, descriptions, debits, credits, balances, fees, deposits, withdrawals, and other key statement details.',
  },
  {
    title: 'Review and verify',
    body: 'Check your extracted rows before export, make adjustments where needed, and stay in control of the final spreadsheet output.',
  },
  {
    title: 'Export clean files',
    body: 'Download structured CSV or Excel files ready for bookkeeping, reconciliation, reporting, tax prep, or financial analysis.',
  },
] as const

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="hidden h-5 w-5 self-center text-[var(--border-strong)] lg:block"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="border-t border-[var(--border)] bg-[var(--surface-soft)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          The workflow
        </p>
        <h2
          id="how-it-works-heading"
          className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-4xl"
        >
          From PDF to clean spreadsheet in four steps.
        </h2>
        <ol className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-1 items-start gap-4 lg:contents lg:gap-0">
              <div className="flex flex-1 items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--elevation-card)] lg:flex-col lg:items-center lg:gap-3 lg:text-center">
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-[0_3px_8px_rgba(79,70,229,0.24)]"
                  style={{
                    background:
                      'radial-gradient(circle at 28% 26%, #2DD4BF 0%, #4F46E5 55%, #3730A3 100%)',
                  }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{step.body}</p>
                </div>
              </div>
              {index < STEPS.length - 1 ? <Chevron /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
