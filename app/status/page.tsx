import Link from 'next/link'
import { TrustPage, TrustSection } from '@/components/trust/trust-page'
import { buildPageMetadata } from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'Launch readiness and operational status | StatementStudio',
  description:
    'StatementStudio launch readiness: operational status, incident posture, change-management practice, and remaining items on the path to general availability.',
  path: '/status',
})

export default function StatusPage() {
  return (
    <TrustPage
      title="Status"
      intro="StatementStudio is in alpha. This status page reports launch readiness until a production status integration is connected."
    >
      <TrustSection title="Launch readiness">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">Application</dt>
            <dd>Alpha, active development</dd>
          </div>
          <div>
            {/* SECURITY-AUDIT: renamed Conversion pipeline to Conversion status */}
            <dt className="font-medium text-foreground">Conversion status</dt>
            <dd>Implementation in progress</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Deletion runtime</dt>
            <dd>Cron sweep, monitor, and evidence tables implemented</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Ops Dashboard</dt>
            <dd>Protected provider snapshots and deletion health available to ops admins</dd>
          </div>
        </dl>
      </TrustSection>

      <TrustSection title="Operator View">
        <p>
          Protected live provider health is available from the{' '}
          <Link className="font-medium underline" href="/ops">
            Ops Dashboard
          </Link>
          . The public page does not expose provider details, raw errors, credentials, or customer
          data.
        </p>
      </TrustSection>
    </TrustPage>
  )
}
