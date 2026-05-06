import { TrustPage, TrustSection } from '@/components/trust/trust-page'

export const metadata = {
  title: 'Error Responses',
  description: 'PRIZM API error response format.',
}

export default function ErrorDocsPage() {
  return (
    <TrustPage
      eyebrow="PRIZM Docs"
      title="Error Responses"
      intro="Public API errors use RFC 7807 problem documents so client integrations can handle failures predictably."
    >
      <TrustSection title="Format">
        <p>
          Error responses use <code>application/problem+json</code> and include <code>type</code>,{' '}
          <code>title</code>, <code>status</code>, <code>detail</code>, <code>instance</code>,{' '}
          <code>code</code>, <code>request_id</code>, and <code>trace_id</code>.
        </p>
      </TrustSection>

      <TrustSection title="Example Codes">
        <ul className="space-y-3">
          <li>
            <code>PRZM_AUTH_UNAUTHORIZED</code> for missing or invalid authentication.
          </li>
          <li>
            <code>PRZM_VALIDATION_UPLOAD_REQUEST</code> for invalid upload metadata.
          </li>
          <li>
            <code>PRZM_RATE_LIMITED</code> for rate-limited requests.
          </li>
          <li>
            <code>PRZM_INTERNAL_PRIVACY_REQUEST_FAILED</code> for a failed privacy workflow write.
          </li>
        </ul>
      </TrustSection>
    </TrustPage>
  )
}
