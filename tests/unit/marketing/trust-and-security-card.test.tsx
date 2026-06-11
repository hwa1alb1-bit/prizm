import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrustAndSecurityCard } from '@/components/marketing/trust-and-security-card'

describe('TrustAndSecurityCard', () => {
  it('renders the four trust rows with mockup copy', () => {
    render(<TrustAndSecurityCard />)
    expect(screen.getByRole('heading', { level: 3, name: /Trust & security/i })).toBeInTheDocument()
    expect(screen.getByText(/Bank-level encryption \(TLS 1\.2\+\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Files are private and encrypted/i)).toBeInTheDocument()
    expect(screen.getByText(/Auto delete after 24 hours/i)).toBeInTheDocument()
    expect(screen.getByText(/No data used for training or shared/i)).toBeInTheDocument()
  })
})
