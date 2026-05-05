import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/server/supabase-middleware'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-foreground/10 bg-background p-4 md:block">
        <div className="mb-6">
          <span className="text-sm font-semibold tracking-tight">PRIZM</span>
        </div>
        <nav className="space-y-1">
          <Link
            href="/app"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            Upload
          </Link>
          <Link
            href="/app/history"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            History
          </Link>
          <Link
            href="/app/billing"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            Billing
          </Link>
          <Link
            href="/app/settings"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            Settings
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
