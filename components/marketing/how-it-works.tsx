const STEPS = [
  { title: 'Upload PDF', body: 'Securely upload your statement PDF.' },
  { title: 'We extract data', body: 'Our parser identifies and understands the data.' },
  { title: 'Review & verify', body: 'We validate and organize the rows into structured data.' },
  { title: 'Export', body: 'Download your data in CSV or Excel.' },
] as const

export function HowItWorks() {
  return (
    <section
      id="features"
      aria-labelledby="how-it-works-heading"
      className="border-t border-[var(--border-subtle)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <h2 id="how-it-works-heading" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] text-sm font-semibold text-[var(--accent)]"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-foreground/65">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
