import { TrustPage, TrustSection } from '@/components/trust/trust-page'

const subprocessors = [
  {
    vendor: 'AWS',
    purpose: 'S3, KMS, Textract, and SES for storage, encryption, extraction, and email paths.',
    dpaUrl: 'https://aws.amazon.com/service-terms/',
  },
  {
    vendor: 'Supabase',
    purpose: 'Authentication, Postgres, RLS-backed application data, and audit tables.',
    dpaUrl: 'https://supabase.com/legal/dpa',
  },
  {
    vendor: 'Stripe',
    purpose: 'Subscription billing, invoices, payment state, and customer portal sessions.',
    dpaUrl: 'https://stripe.com/legal/dpa',
  },
  {
    vendor: 'Vercel',
    purpose: 'Application hosting, deployment, and serverless route execution.',
    dpaUrl: 'https://vercel.com/legal/dpa',
  },
  {
    vendor: 'Resend',
    purpose: 'Transactional email delivery and deletion receipts.',
    dpaUrl: 'https://resend.com/legal/dpa',
  },
  {
    vendor: 'Sentry',
    purpose: 'Error monitoring with PII-scrubbed event context.',
    dpaUrl: 'https://sentry.io/legal/dpa/',
  },
  {
    vendor: 'Upstash',
    purpose: 'Redis-backed rate limiting and operational coordination.',
    dpaUrl: 'https://upstash.com/trust/dpa.pdf',
  },
  {
    vendor: 'Cloudflare',
    purpose: 'DNS, edge controls, and provider telemetry for operations.',
    dpaUrl: 'https://www.cloudflare.com/cloudflare-customer-dpa/',
  },
]

export const metadata = {
  title: 'Subprocessors',
  description: 'PRIZM vendor and subprocessor inventory.',
}

export default function SubprocessorsPage() {
  return (
    <TrustPage
      title="Subprocessors"
      intro="This inventory lists vendors that may process customer data or operational metadata for PRIZM."
    >
      <TrustSection title="Inventory">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="py-2 pr-6 font-medium text-foreground">Vendor</th>
                <th className="py-2 pr-6 font-medium text-foreground">Purpose</th>
                <th className="py-2 font-medium text-foreground">DPA</th>
              </tr>
            </thead>
            <tbody>
              {subprocessors.map((subprocessor) => (
                <tr className="border-b border-foreground/10" key={subprocessor.vendor}>
                  <td className="py-3 pr-6 font-medium text-foreground">{subprocessor.vendor}</td>
                  <td className="py-3 pr-6">{subprocessor.purpose}</td>
                  <td className="py-3">
                    <a className="font-medium underline" href={subprocessor.dpaUrl}>
                      DPA
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TrustSection>
    </TrustPage>
  )
}
