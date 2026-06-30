import Link from 'next/link'
import { TrustPage, TrustSection } from '@/components/trust/trust-page'
import { buildPageMetadata } from '@/lib/seo/site'

export const metadata = buildPageMetadata({
  title: 'Security policy and disclosure | StatementStudio',
  description:
    'StatementStudio vulnerability disclosure policy, safe harbor commitments, security reporting contacts, and response timelines for researchers and customers.',
  path: '/security/policy',
})

export default function SecurityPolicyPage() {
  return (
    <TrustPage
      title="Security Policy"
      intro="Use this policy for vulnerability reports, suspected data exposure, and security control concerns."
    >
      <TrustSection title="Reporting">
        <p>
          Email{' '}
          <a href="mailto:security@pdftoexcelstatementconverter.com">
            security@pdftoexcelstatementconverter.com
          </a>{' '}
          with a concise description, affected route or asset, reproduction steps, and any
          non-sensitive evidence. Do not attach customer bank statements, secrets, access tokens, or
          regulated data.
        </p>
      </TrustSection>

      <TrustSection title="Handling">
        <ul className="space-y-3">
          <li>StatementStudio triages security reports before normal support requests.</li>
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
          In-scope assets are StatementStudio application routes, API routes, dashboard controls,
          public trust pages, and documented provider integrations. See{' '}
          <Link className="font-medium underline" href="/security">
            Security
          </Link>{' '}
          for the current control posture.
        </p>
      </TrustSection>
    </TrustPage>
  )
}
