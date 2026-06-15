import { render, screen, waitFor, within } from '@testing-library/react'
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

  it('does not show a pending-email banner on initial render', () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    expect(screen.queryByText(/Pending verification/i)).toBeNull()
  })

  it('shows the pending-email banner after a successful email change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ pending_email: 'new@example.com' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Edit email/i }))
    const input = screen.getByLabelText(/^Email$/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'new@example.com')
    await userEvent.click(screen.getByRole('button', { name: /Save/i }))

    expect(await screen.findByText(/Pending verification/i)).toBeInTheDocument()
    expect(screen.getByText('new@example.com')).toBeInTheDocument()
    // owner@example.com appears twice: the email row + the banner reference.
    expect(screen.getAllByText('owner@example.com').length).toBeGreaterThanOrEqual(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/account/email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com' }),
      }),
    )
  })

  it('renders three plan cards (Free, Starter, Pro) with the current plan marked', () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling({ plan: 'starter' })} />)
    const billing = screen.getByRole('region', { name: /Billing Details/i })
    expect(within(billing).getByRole('heading', { name: 'Free' })).toBeInTheDocument()
    expect(within(billing).getByRole('heading', { name: 'Starter' })).toBeInTheDocument()
    expect(within(billing).getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
    const current = within(billing).getByText(/^Current$/i)
    expect(current.closest('article')).toHaveTextContent('Starter')
  })

  it('renders an Open portal button when hasStripeCustomer is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    })

    render(
      <AccountForm
        settings={buildSettings()}
        billing={buildBilling({ hasStripeCustomer: true })}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Open portal/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/billing/portal',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/p/1')
    })
  })

  it('omits the Open portal button when hasStripeCustomer is false', () => {
    render(
      <AccountForm
        settings={buildSettings()}
        billing={buildBilling({ hasStripeCustomer: false })}
      />,
    )
    expect(screen.queryByRole('button', { name: /Open portal/i })).toBeNull()
  })

  it('starts a Stripe checkout when switching to Starter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: 'https://checkout.stripe.com/s/1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    })

    render(<AccountForm settings={buildSettings()} billing={buildBilling({ plan: 'free' })} />)
    await userEvent.click(screen.getByRole('button', { name: /Switch to Starter/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/billing/checkout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ plan: 'starter', billingCycle: 'monthly' }),
        }),
      )
    })
  })

  it('renders a Sign out button inside the Account section', () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    const account = screen.getByRole('region', { name: /^Account$/i })
    expect(within(account).getByRole('button', { name: /Sign out/i })).toBeInTheDocument()
  })

  it('POSTs to /api/v1/auth/signout on click and navigates to /', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Sign out/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/auth/signout',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('/')
    })
  })

  it('renders an Edit workspace button for owner and admin roles', () => {
    render(<AccountForm settings={buildSettings({ role: 'owner' })} billing={buildBilling()} />)
    expect(screen.getByRole('button', { name: /Edit workspace name/i })).toBeInTheDocument()
  })

  it('does not render an Edit workspace button for member or viewer roles', () => {
    render(<AccountForm settings={buildSettings({ role: 'member' })} billing={buildBilling()} />)
    expect(screen.queryByRole('button', { name: /Edit workspace name/i })).toBeNull()
    expect(screen.getByText('Benchmark')).toBeInTheDocument()
  })

  it('PATCHes /api/v1/account/workspace on save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: 'New Workspace' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(<AccountForm settings={buildSettings({ role: 'admin' })} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Edit workspace name/i }))
    const input = screen.getByLabelText(/Workspace name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'New Workspace')
    await userEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/account/workspace',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'New Workspace' }),
        }),
      )
    })
    expect(await screen.findByText('New Workspace')).toBeInTheDocument()
  })

  it('expands a password change form when Change password is clicked', async () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Change password/i }))
    expect(screen.getByLabelText(/Current password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/New password/i)).toBeInTheDocument()
    expect(screen.getByText(/10\+ characters/i)).toBeInTheDocument()
  })

  it('blocks the password change when the new password fails the policy', async () => {
    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Change password/i }))
    await userEvent.type(screen.getByLabelText(/Current password/i), 'Hunter12345')
    await userEvent.type(screen.getByLabelText(/New password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /Update password/i }))

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('POSTs the password change and closes the form on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Change password/i }))
    await userEvent.type(screen.getByLabelText(/Current password/i), 'Hunter12345')
    await userEvent.type(screen.getByLabelText(/New password/i), 'BrandNewPass1')
    await userEvent.click(screen.getByRole('button', { name: /Update password/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/account/password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'Hunter12345',
            newPassword: 'BrandNewPass1',
          }),
        }),
      )
    })

    await waitFor(() => {
      expect(screen.queryByLabelText(/Current password/i)).toBeNull()
    })
    expect(await screen.findByText(/Password updated/i)).toBeInTheDocument()
  })

  it('shows the server error for an invalid current password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 401,
            code: 'PRZM_AUTH_INVALID_CURRENT_PASSWORD',
            title: 'Current password is incorrect',
            detail: 'Enter the current password before choosing a new one.',
          }),
          { status: 401, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    )

    render(<AccountForm settings={buildSettings()} billing={buildBilling()} />)
    await userEvent.click(screen.getByRole('button', { name: /Change password/i }))
    await userEvent.type(screen.getByLabelText(/Current password/i), 'WrongPass1')
    await userEvent.type(screen.getByLabelText(/New password/i), 'BrandNewPass1')
    await userEvent.click(screen.getByRole('button', { name: /Update password/i }))

    expect(await screen.findByText(/Enter the current password before/i)).toBeInTheDocument()
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
