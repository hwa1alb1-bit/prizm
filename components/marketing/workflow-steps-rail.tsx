import { StepNumeral } from './step-numeral'
import { STEPS } from './workflow-steps'

// Full-width horizontal workflow band rendered on the landing page between
// the hero and the trust cards. Replaces the previous nested-card right-rail
// treatment per DESIGN.md (No Floating Card Rule + Flat Evidence Rule).

export function WorkflowStepsRail() {
  return (
    <section
      aria-label="The workflow"
      className="border-y border-[var(--border-subtle)] bg-[var(--background)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          The workflow
        </p>
        <h3
          id="workflow-steps-rail-heading"
          className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl"
        >
          From PDF to clean spreadsheet in four steps.
        </h3>

        <ol className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-0">
          {STEPS.map((step, index) => {
            const isFirst = index === 0
            const isLast = index === STEPS.length - 1
            return (
              <li
                key={step.title}
                className="flex flex-row items-start gap-4 sm:flex-1 sm:flex-col sm:items-stretch sm:gap-0"
              >
                <div className="flex items-center sm:w-full sm:justify-center">
                  <span
                    aria-hidden="true"
                    className={`hidden sm:block sm:h-px sm:flex-1 ${isFirst ? 'sm:invisible' : 'sm:bg-[var(--border-subtle)]'}`}
                  />
                  <StepNumeral n={index + 1} />
                  <span
                    aria-hidden="true"
                    className={`hidden sm:block sm:h-px sm:flex-1 ${isLast ? 'sm:invisible' : 'sm:bg-[var(--border-subtle)]'}`}
                  />
                </div>
                <div className="min-w-0 sm:mt-4 sm:px-4 sm:text-center">
                  <h4 className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
                    {step.title}
                  </h4>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{step.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
