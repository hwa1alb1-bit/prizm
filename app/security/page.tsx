import Link from 'next/link'

export const metadata = {
  title: 'Security',
  description: 'Current PRIZM security controls, disclosure contacts, and planned controls.',
}

export default function SecurityPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-foreground/50">
        PRIZM Trust
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Security</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/70">
        PRIZM is in alpha. This page describes controls that are active in the product today and
        controls that must be verified before a production launch.
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold">Active Controls</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-foreground/70">
            <li>Authenticated application routes use Supabase-backed server checks.</li>
            <li>Public API errors use RFC 7807 problem responses with request and trace IDs.</li>
            <li>Uploads are presigned server-side and configured for S3 KMS encryption.</li>
            <li>Provider and Ops Dashboard data is fetched server-side, not from the browser.</li>
            <li>Security headers and CSP are configured in the Next.js deployment.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Planned Controls</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-foreground/70">
            <li>Formal SOC 2 evidence export and monthly access review.</li>
            <li>Step-up authentication before showing sensitive provider dashboard data.</li>
            <li>Production incident response drills and provider outage rehearsals.</li>
            <li>Published vulnerability acknowledgments after disclosure handling is staffed.</li>
          </ul>
        </section>
      </div>

      <section className="mt-12 border-t border-foreground/10 pt-8">
        <h2 className="text-xl font-semibold">Disclosure</h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-foreground/70">
          Report vulnerabilities to{' '}
          <a className="font-medium underline" href="mailto:security@prizmview.app">
            security@prizmview.app
          </a>
          . Do not include live bank statements, credentials, or regulated customer data in the
          initial report.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium">
          <Link className="underline" href="/security/policy">
            Security policy
          </Link>
          <Link className="underline" href="/security/subprocessors">
            Subprocessors
          </Link>
          <Link className="underline" href="/privacy">
            Privacy
          </Link>
        </div>
      </section>
    </main>
  )
}
