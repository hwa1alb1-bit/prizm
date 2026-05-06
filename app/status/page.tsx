import Link from 'next/link'
import { TrustPage, TrustSection } from '@/components/trust/trust-page'

export const metadata = {
  title: 'Status',
  description: 'PRIZM launch readiness and operational status.',
}

export default function StatusPage() {
  return (
    <TrustPage
      title="Status"
      intro="PRIZM is in alpha. This status page reports launch readiness until a production status integration is connected."
    >
      <TrustSection title="Launch readiness">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">Application</dt>
            <dd>Alpha, active development</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Conversion pipeline</dt>
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
