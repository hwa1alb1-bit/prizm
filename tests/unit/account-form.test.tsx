import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountForm } from '@/components/account/account-form'
import type { BillingSummary } from '@/lib/shared/billing'
import type { SettingsSummary } from '@/lib/shared/settings'

function buildSettings(overrides: Partial<SettingsSummary['account']> = {}): SettingsSummary {
  return {
    account: {
      email: 'owner@example.com',
      fullName: 'Hank Alberts',
      role: 'owner',
      ...overrides,
    },
    workspace: {
      id: 'workspace_123',
      name: 'Benchmark',
      defaultRegion: 'us',
      memberCount: 1,
      createdAt: '2026-01-01T00:00:00Z',
    },
    controls: {
      retentionHours: 24,
      maxPdfSizeMb: 20,
      exportFormats: ['xlsx', 'csv'],
      securityEmail: 'security@example.com',
    },
  }
}

function buildBilling(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    plan: 'starter',
    status: 'active',
    billingCycle: 'monthly',
    creditBalance: 143,
    monthlyCredits: 200,
    usedCredits: 57,
    overageAllowed: true,
    overageMeterConfigured: true,
    currentPeriodEnd: '2026-07-12T00:00:00Z',
    cancelAtPeriodEnd: false,
    hasStripeCustomer: true,
    ...overrides,
  }
}

describe('AccountForm — editable full name', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ full_name: 'New Name' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders the current full name in display mode', () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    expect(screen.getByText('Hank Alberts')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edit full name/i })).toBeInTheDocument()
  })

  it('switches to edit mode when Edit is clicked and shows the current value', async () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Edit full name/i }))
    expect(screen.getByLabelText(/Full name/i)).toHaveValue('Hank Alberts')
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
  })

  it('PATCHes /api/v1/account/profile on Save and shows the new value', async () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Edit full name/i }))
    const input = screen.getByLabelText(/Full name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/account/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ full_name: 'New Name' }),
        }),
      )
    })
    expect(await screen.findByText('New Name')).toBeInTheDocument()
  })

  it('reverts to the original value on Cancel', async () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Edit full name/i }))
    const input = screen.getByLabelText(/Full name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'Drafty')
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }))

    expect(screen.getByText('Hank Alberts')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Full name/i })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces an inline error when the API returns a problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 400,
            code: 'PRZM_VALIDATION_ACCOUNT_PROFILE',
            title: 'Invalid profile update',
            detail: 'Name is too long.',
          }),
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    )

    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Edit full name/i }))
    await userEvent.click(screen.getByRole('button', { name: /Save/i }))

    expect(await screen.findByText(/Name is too long/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument()
  })
})
