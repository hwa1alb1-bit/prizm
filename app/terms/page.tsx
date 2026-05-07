import { TrustPage, TrustSection } from '@/components/trust/trust-page'

export const metadata = {
  title: 'Terms',
  description: 'PRIZM alpha service terms.',
}

export default function TermsPage() {
  return (
    <TrustPage
      title="Terms"
      intro="These alpha service terms describe acceptable use and operational limits while PRIZM moves toward production launch."
    >
      <TrustSection title="Alpha service terms">
        <p>
          PRIZM is available for controlled alpha testing. Do not upload production bank statements
          unless your workspace has been explicitly approved for that use. The service may change as
          conversion, deletion, billing, and audit controls are hardened.
        </p>
      </TrustSection>

      <TrustSection title="Customer Responsibilities">
        <ul className="space-y-3">
          <li>Upload only documents you are authorized to process.</li>
          <li>Keep account access limited to authorized workspace members.</li>
          <li>Review converted output before relying on it for bookkeeping or reporting.</li>
          <li>Report security issues through the published security disclosure channel.</li>
        </ul>
      </TrustSection>
    </TrustPage>
  )
}
