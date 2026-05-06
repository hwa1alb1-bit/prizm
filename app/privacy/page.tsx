import Link from 'next/link'
import { TrustPage, TrustSection } from '@/components/trust/trust-page'

export const metadata = {
  title: 'Privacy',
  description: 'PRIZM privacy commitments, retention, and data rights workflows.',
}

export default function PrivacyPage() {
  return (
    <TrustPage
      title="Privacy"
      intro="PRIZM limits bank statement handling to conversion workflows and keeps public privacy claims tied to implemented product behavior."
    >
      <TrustSection title="Data We Process">
        <ul className="space-y-3">
          <li>Account profile data for authentication, workspace access, and support.</li>
          <li>Uploaded PDFs and extracted statement rows for conversion delivery.</li>
          <li>Billing state synchronized from Stripe for subscriptions and credit controls.</li>
          <li>Security logs, request IDs, and audit events for abuse prevention and evidence.</li>
        </ul>
      </TrustSection>

      <TrustSection title="Retention">
        <p>
          Uploaded documents and extracted statement rows use 24-hour document retention. The
          deletion runtime records sweep activity, receipts, and audit evidence. Account, billing,
          and audit records follow the retention periods in the public privacy manifest.
        </p>
      </TrustSection>

      <TrustSection title="User Rights">
        <p>
          Workspace owners and admins can request account data export through{' '}
          <code>/api/v1/account/data-export</code> and account deletion through{' '}
          <code>/api/v1/account/delete</code>. These requests are recorded, audited, and handled as
          workflows rather than silent background mutations.
        </p>
        <p className="mt-4">
          See the machine-readable manifest at{' '}
          <Link className="font-medium underline" href="/.well-known/privacy-manifest.json">
            /.well-known/privacy-manifest.json
          </Link>
          .
        </p>
      </TrustSection>
    </TrustPage>
  )
}
