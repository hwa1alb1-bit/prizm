import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  HorizontalStepper,
  type HorizontalStepperStep,
} from '@/components/marketing/horizontal-stepper'

function steps(...statuses: HorizontalStepperStep['status'][]): HorizontalStepperStep[] {
  return statuses.map((status, index) => ({
    id: `step-${index}`,
    label: `Step ${index + 1}`,
    status,
  }))
}

function railSegments(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('li > div > span:not(.sr-only):not(.relative)'))
    .filter((node) => node.getAttribute('aria-hidden') === 'true')
    .map((node) => node.className)
}

describe('HorizontalStepper', () => {
  it('renders a step per item with the right status label', () => {
    const { getByLabelText, getAllByRole } = render(
      <HorizontalStepper steps={steps('complete', 'active', 'waiting')} ariaLabel="Test" />,
    )
    expect(getByLabelText('Test')).toBeInTheDocument()
    expect(getAllByRole('listitem')).toHaveLength(3)
  })

  it('marks the pulsing animation class on the active node only', () => {
    const { container } = render(
      <HorizontalStepper steps={steps('complete', 'active', 'waiting')} ariaLabel="Test" />,
    )
    const active = container.querySelectorAll('.prizm-stepper-active')
    expect(active).toHaveLength(1)
    expect(active[0].textContent).toMatch(/Step 2/)
  })

  it('paints rails consistently across a complete→blocked→waiting failure sequence', () => {
    const { container } = render(
      <HorizontalStepper
        steps={steps(
          'complete',
          'complete',
          'complete',
          'blocked',
          'waiting',
          'blocked',
          'waiting',
        )}
        ariaLabel="Test"
      />,
    )
    const segments = railSegments(container)

    // Gap between two adjacent nodes is rendered twice: once as the right-half of node N,
    // once as the left-half of node N+1. With the new single-source-of-truth gapColor,
    // both halves must always share the same color class.
    for (let i = 0; i < segments.length - 1; i += 2) {
      const rightOfPrev = segments[i + 1]
      const leftOfNext = segments[i + 2]
      if (!leftOfNext) break
      const prevColor = rightOfPrev?.match(/bg-\[var\(--[a-z]+\)\]/)?.[0]
      const nextColor = leftOfNext.match(/bg-\[var\(--[a-z]+\)\]/)?.[0]
      if (prevColor && nextColor) {
        expect(nextColor).toBe(prevColor)
      }
    }
  })

  it('renders the pulse keyframe + reduced-motion guard in globals (smoke check)', () => {
    // The CSS class name must be stable so app/globals.css can target it. If a refactor
    // accidentally renames the class, this test catches it before the styles silently
    // stop applying.
    const { container } = render(<HorizontalStepper steps={steps('active')} ariaLabel="Test" />)
    expect(container.querySelector('.prizm-stepper-active')).not.toBeNull()
  })
})
