import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OpsDashboard } from '@/components/ops/ops-dashboard'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

describe('OpsDashboard', () => {
  it('summarizes provider status, quota pressure, freshness, and quick links', () => {
    render(
      <OpsDashboard
        deletionHealth={{
          status: 'red',
          lastSweepAt: '2026-05-05T23:10:00.000Z',
          lastSweepStatus: 'failed',
          expiredSurvivors: 3,
          receiptFailures: 1,
        }}
        snapshots={[
          {
            provider: 'stripe',
            metric: 'credential_gap',
            displayName: 'Missing credential count',
            used: 0,
            limit: 1,
            unit: 'count',
            periodStart: null,
            periodEnd: null,
            status: 'green',
            freshness: 'fresh',
            sourceUrl: 'https://dashboard.stripe.com',
            collectedAt: '2026-05-05T23:00:00.000Z',
            errorCode: null,
          },
          {
            provider: 'vercel',
            metric: 'credential_gap',
            displayName: 'Missing credential count',
            used: 1,
            limit: 1,
            unit: 'count',
            periodStart: null,
            periodEnd: null,
            status: 'red',
            freshness: 'failed',
            sourceUrl: 'https://vercel.com/dashboard',
            collectedAt: '2026-05-05T23:00:00.000Z',
            errorCode: 'configuration_missing',
          },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Ops Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Action required')).toBeInTheDocument()
    expect(screen.getByText('1 red')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stripe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vercel' })).toBeInTheDocument()
    expect(screen.getByText('Deletion health')).toBeInTheDocument()
    expect(screen.getByText('red deletion runtime')).toBeInTheDocument()
    expect(screen.getByText('3 expired survivors')).toBeInTheDocument()
    expect(screen.getByText('1 receipt failure')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stripe console' })).toHaveAttribute(
      'href',
      '/api/ops/links/stripe?target=console',
    )
    expect(screen.getByText('configuration_missing')).toBeInTheDocument()
  })

  it('refreshes the server-rendered dashboard after manual provider collection', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never

    render(<OpsDashboard snapshots={[]} />)

    await userEvent.click(screen.getAllByRole('button', { name: 'Refresh' })[0])

    expect(global.fetch).toHaveBeenCalledWith('/api/ops/collect/cloudflare', { method: 'POST' })
    expect(refresh).toHaveBeenCalled()
  })
})
