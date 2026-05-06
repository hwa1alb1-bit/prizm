import { TrustPage, TrustSection } from '@/components/trust/trust-page'

export const metadata = {
  title: 'Rate Limits',
  description: 'PRIZM rate-limit semantics.',
}

export default function RateLimitsPage() {
  return (
    <TrustPage
      eyebrow="PRIZM Docs"
      title="Rate Limits"
      intro="PRIZM applies rate limits to protect upload, billing, ops, and privacy workflows from accidental or abusive repetition."
    >
      <TrustSection title="Response Semantics">
        <p>
          A limited request returns HTTP <code>429</code>, a problem document, and a{' '}
          <code>Retry-After</code> header when the reset time is known. Clients should back off
          instead of retrying immediately.
        </p>
      </TrustSection>

      <TrustSection title="Protected Workflows">
        <ul className="space-y-3">
          <li>Document upload and conversion requests.</li>
          <li>Ops Dashboard manual provider refreshes.</li>
          <li>Billing portal and checkout session creation.</li>
          <li>
            Privacy data export and account deletion request workflows are limited to 2 accepted
            submissions per authenticated user per 24-hour window.
          </li>
        </ul>
      </TrustSection>
    </TrustPage>
  )
}
