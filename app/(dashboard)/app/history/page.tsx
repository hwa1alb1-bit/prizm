import { redirect } from 'next/navigation'
import { DocumentHistoryList } from '@/components/app/document-history'
import { loadDocumentHistoryForCurrentUser } from '@/lib/server/document-history'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function HistoryPage() {
  const result = await loadDocumentHistoryForCurrentUser()

  if (!result.ok) {
    if (result.reason === 'unauthenticated') redirect(loginPath('/app/history'))
    return <HistoryProblem title={result.title} detail={result.detail} />
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="grid gap-4 border-b border-[var(--border-subtle)] pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
            Statement history
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review and evidence</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
            Every document row is loaded from PRIZM records with statement output, audit events,
            retention state, and deletion evidence.
          </p>
        </div>
      </header>

      <DocumentHistoryList documents={result.documents} />
    </div>
  )
}

function HistoryProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-6">
      <section className="border-y border-[var(--border-subtle)] py-6 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-foreground/60">{detail}</p>
      </section>
    </div>
  )
}

function loginPath(next: string): string {
  const params = new URLSearchParams({ next })
  return `/login?${params.toString()}`
}
