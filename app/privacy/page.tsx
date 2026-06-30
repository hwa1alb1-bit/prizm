import Link from 'next/link'
import { TrustPage, TrustSection } from '@/components/trust/trust-page'
import { buildPageMetadata } from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'Privacy commitments and data rights | StatementStudio',
  description:
    'StatementStudio privacy: 24-hour document retention, no model training, encryption in transit and at rest, and how to exercise data-rights requests.',
  path: '/privacy',
})

export default function PrivacyPage() {
  return (
    <TrustPage
      title="Privacy"
      intro="StatementStudio limits bank statement handling to conversion workflows and keeps public privacy claims tied to implemented product behavior."
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
          {/* SECURITY-AUDIT: removed internal /api/v1 export and delete endpoint paths */}
          Workspace owners and admins can request account data export and account deletion from
          workspace settings. These requests are recorded, audited, and handled as workflows rather
          than silent background mutations.
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
