'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/app', label: 'Upload' },
  { href: '/app/account', label: 'Account' },
]

export function DashboardNav() {
  const pathname = usePathname()
  if (pathname === '/app/account') return null

  return (
    <>
      <nav
        className="border-b border-[var(--border-subtle)] bg-[var(--background)] px-4 py-3 md:hidden"
        aria-label="Primary"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-foreground/70">
            Workspace
          </span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-h-10 shrink-0 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <aside className="hidden w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-5 md:block">
        <p className="mb-6 text-xs leading-5 text-foreground/55">
          Bank statement conversion with deletion evidence.
        </p>
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
    </>
  )
}
