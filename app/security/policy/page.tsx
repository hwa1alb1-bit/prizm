import Link from 'next/link'
import { TrustPage, TrustSection } from '@/components/trust/trust-page'

export const metadata = {
  title: 'Security Policy',
  description: 'PRIZM vulnerability disclosure and security reporting policy.',
}

export default function SecurityPolicyPage() {
  return (
    <TrustPage
      title="Security Policy"
      intro="Use this policy for vulnerability reports, suspected data exposure, and security control concerns."
    >
      <TrustSection title="Reporting">
        <p>
          Email <a href="mailto:security@prizmview.app">security@prizmview.app</a> with a concise
          description, affected route or asset, reproduction steps, and any non-sensitive evidence.
          Do not attach customer bank statements, secrets, access tokens, or regulated data.
        </p>
      </TrustSection>

      <TrustSection title="Handling">
        <ul className="space-y-3">
          <li>PRIZM triages security reports before normal support requests.</li>
          <li>
            Reports that indicate active abuse, credential exposure, or data access risk become
            incidents.
          </li>
          <li>
            Validated findings are tracked through remediation, verification, and post-incident
            evidence.
          </li>
          <li>Acknowledgments are not published until a staffed disclosure process is in place.</li>
        </ul>
      </TrustSection>

      <TrustSection title="Scope">
        <p>
          In-scope assets are PRIZM application routes, API routes, dashboard controls, public trust
          pages, and documented provider integrations. See{' '}
          <Link className="font-medium underline" href="/security">
            Security
          </Link>{' '}
          for the current control posture.
        </p>
      </TrustSection>
    </TrustPage>
  )
}
