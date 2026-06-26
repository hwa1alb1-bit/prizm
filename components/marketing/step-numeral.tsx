// Numeric badge for the marketing workflow steps band.
//
// Flat Audit Teal per DESIGN.md: the Rare Accent Rule forbids gradient washes
// or large brand fields; numerals are the smallest possible accent surface,
// solid color, no shadow. Number is decorative — the ordered list semantics
// carry order to assistive tech.

export function StepNumeral({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--accent-foreground)]"
    >
      {n}
    </span>
  )
}
