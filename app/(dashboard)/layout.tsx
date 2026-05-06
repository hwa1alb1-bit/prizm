import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/server/supabase-middleware'
import Link from 'next/link'

const navItems = [
  { href: '/app', label: 'Upload' },
  { href: '/app/history', label: 'History' },
  { href: '/app/billing', label: 'Billing' },
  { href: '/app/settings', label: 'Settings' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--accent-foreground)]"
      >
        Skip to main content
      </a>
      <header className="border-b border-[var(--border-subtle)] bg-[var(--background)] px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link href="/app" className="text-sm font-semibold tracking-tight">
            PRIZM
          </Link>
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-foreground/70">
            Workspace
          </span>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-h-10 shrink-0 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex min-h-screen md:min-h-0">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-5 md:block">
          <div className="mb-8">
            <Link href="/app" className="text-base font-semibold tracking-tight">
              PRIZM
            </Link>
            <p className="mt-1 text-xs leading-5 text-foreground/55">
              Bank statement conversion with deletion evidence.
            </p>
          </div>
          <nav className="space-y-1" aria-label="Primary">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block min-h-10 rounded-md px-3 py-2 text-sm font-medium text-foreground/75 hover:bg-background hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 border-t border-[var(--border-subtle)] pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-foreground/45">
              Trust controls
            </p>
            <dl className="mt-3 space-y-3 text-xs leading-5">
              <div>
                <dt className="text-foreground/50">Retention</dt>
                <dd className="font-medium">24-hour auto-delete</dd>
              </div>
              <div>
                <dt className="text-foreground/50">Evidence</dt>
                <dd className="font-medium">Audit event on server writes</dd>
              </div>
              <div>
                <dt className="text-foreground/50">Isolation</dt>
                <dd className="font-medium">Workspace-scoped access</dd>
              </div>
            </dl>
          </div>
        </aside>
        <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
