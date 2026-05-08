import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsDashboard } from '@/components/settings/settings-dashboard'

describe('SettingsDashboard', () => {
  it('renders real account, workspace, retention, and support settings', () => {
    render(
      <SettingsDashboard
        summary={{
          account: {
            email: 'owner@example.com',
            fullName: 'Owner Example',
            role: 'owner',
          },
          workspace: {
            id: 'workspace_123',
            name: 'Example Books',
            defaultRegion: 'us-east-1',
            memberCount: 3,
            createdAt: '2026-05-01T12:00:00.000Z',
          },
          controls: {
            retentionHours: 24,
            maxPdfSizeMb: 50,
            exportFormats: ['CSV', 'XLSX'],
            securityEmail: 'security@prizmview.app',
          },
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
    expect(screen.getByText('Owner Example')).toBeInTheDocument()
    expect(screen.getByText('Example Books')).toBeInTheDocument()
    expect(screen.getByText('us-east-1')).toBeInTheDocument()
    expect(screen.getByText('3 members')).toBeInTheDocument()
    expect(screen.getByText('24-hour auto-delete')).toBeInTheDocument()
    expect(screen.getByText('50 MB PDF limit')).toBeInTheDocument()
    expect(screen.getByText('CSV, XLSX')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Security policy' })).toHaveAttribute(
      'href',
      '/security/policy',
    )
  })
})
