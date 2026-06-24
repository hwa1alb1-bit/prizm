import { StepNumeral } from './step-numeral'
import { STEPS } from './workflow-steps'

export function WorkflowStepsRail() {
  return (
    <section
      aria-labelledby="workflow-steps-rail-heading"
      className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elevation-card)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
        The workflow
      </p>
      <h3
        id="workflow-steps-rail-heading"
        className="mt-2 text-base font-semibold tracking-tight text-[var(--text-primary)]"
      >
        From PDF to clean spreadsheet in four steps.
      </h3>
      <ol className="mt-5 flex-1 space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <StepNumeral n={index + 1} />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h4>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
