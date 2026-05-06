// Placeholder marketing landing. Real /(marketing) routes replace this in Wave 2.
// Kept intentionally minimal so a deploy at this point shows a meaningful page
// rather than the create-next-app default.

import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-6 py-24">
      <section className="max-w-2xl text-center sm:text-left">
        <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">PRIZM</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-zinc-950 dark:text-zinc-50 sm:text-5xl">
          Bank statement conversion built for accountants who care about compliance.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Alpha workflows for upload, conversion, 24-hour deletion evidence, and SOC 2-oriented
          controls are being hardened for production launch.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Open alpha account
          </Link>
          <Link
            href="/security"
            className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-950 transition hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-50 dark:hover:border-zinc-500"
          >
            Read the security model
          </Link>
        </div>

        <p className="mt-12 text-xs text-zinc-500 dark:text-zinc-500">
          Status: alpha. Production launch tracked at{' '}
          <Link className="underline" href="/status">
            /status
          </Link>
        </p>
      </section>
    </main>
  )
}
