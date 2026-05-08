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
          Limited routes return <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code>,{' '}
          <code>RateLimit-Reset</code>, and legacy <code>X-RateLimit-Limit</code> headers when a
          limiter result is available. A limited request returns HTTP <code>429</code>, a problem
          document, and a <code>Retry-After</code> header.
        </p>
      </TrustSection>

      <TrustSection title="Protected Workflows">
        <ul className="space-y-3">
          <li>Upload and conversion routes: 60 requests per minute per authenticated user.</li>
          <li>Document status polling: 1200 requests per minute per authenticated user.</li>
          <li>Billing portal and checkout session creation: 60 requests per minute per user.</li>
          <li>Export creation and streaming: 60 requests per minute per authenticated user.</li>
          <li>Export download URL creation: 600 requests per minute per authenticated user.</li>
          <li>Ops Dashboard manual provider refreshes: 3 requests per 5 minutes per admin.</li>
          <li>Privacy workflows: 2 accepted submissions per user per 24-hour window.</li>
        </ul>
      </TrustSection>
    </TrustPage>
  )
}
