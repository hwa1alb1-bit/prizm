const STEPS = [
  { title: 'Upload PDF', body: 'Securely upload your statement PDF.' },
  { title: 'We extract data', body: 'Our parser identifies and understands the data.' },
  { title: 'Review & verify', body: 'We validate and organize the rows into structured data.' },
  { title: 'Export', body: 'Download your data in CSV or Excel.' },
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
        <h2
          id="how-it-works-heading"
          className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]"
        >
          How it works
        </h2>
        <ol className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-1 items-start gap-4 lg:contents lg:gap-0">
              <div className="flex flex-1 items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--elevation-card)] lg:flex-col lg:gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]"
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
