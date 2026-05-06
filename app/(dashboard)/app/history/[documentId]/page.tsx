import { notFound, redirect } from 'next/navigation'
import { DocumentReview } from '@/components/app/document-history'
import { loadDocumentReviewForCurrentUser } from '@/lib/server/document-history'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params
  const result = await loadDocumentReviewForCurrentUser(documentId)

  if (!result.ok) {
    if (result.reason === 'unauthenticated') redirect(loginPath(`/app/history/${documentId}`))
    if (result.reason === 'not_found') notFound()
    return <ReviewProblem title={result.title} detail={result.detail} />
  }

  return <DocumentReview document={result.document} />
}

function ReviewProblem({ title, detail }: { title: string; detail: string }) {
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
