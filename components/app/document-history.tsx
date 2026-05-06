import Link from 'next/link'
import {
  documentStateLabel,
  type AuditEventEvidenceView,
  type DocumentState,
  type HistoryDocumentView,
  type StatementEvidenceView,
} from '@/lib/server/document-history'

export type { HistoryDocumentView }

export function DocumentHistoryList({ documents }: { documents: HistoryDocumentView[] }) {
  if (documents.length === 0) return <EmptyHistory />

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] text-left text-sm">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-[0.08em] text-foreground/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Statement</th>
              <th className="px-4 py-3 font-semibold">State</th>
              <th className="px-4 py-3 font-semibold">Statement evidence</th>
              <th className="px-4 py-3 font-semibold">Audit event</th>
              <th className="px-4 py-3 font-semibold">Retention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {documents.map((document) => (
              <HistoryRow key={document.id} document={document} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function DocumentReview({ document }: { document: HistoryDocumentView }) {
  const primaryStatement = document.statements[0] ?? null
  const processingAudit = document.auditEvents.find(
    (event) => event.eventType === 'document.processing_started',
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="grid gap-4 border-b border-[var(--border-subtle)] pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Link
            href="/app/history"
            className="text-sm font-medium text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            History
          </Link>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">
            {document.filename}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
            Document evidence, extracted statement data, audit history, and deletion proof for this
            record.
          </p>
        </div>
        <DocumentStateBadge state={document.state} />
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <EvidenceSection title="Document">
            <EvidenceGrid>
              <EvidenceRow label="Document ID" value={document.id} />
              <EvidenceRow label="Uploaded" value={formatDateTime(document.createdAt)} />
              <EvidenceRow label="Expires" value={formatDateTime(document.expiresAt)} />
              <EvidenceRow label="Size" value={formatBytes(document.sizeBytes)} />
              <EvidenceRow label="Pages" value={document.pages?.toString() ?? 'Not counted'} />
              <EvidenceRow label="Content type" value={document.contentType} />
              <EvidenceRow label="S3 bucket" value={document.s3Bucket} />
              <EvidenceRow label="S3 key" value={document.s3Key} />
              <EvidenceRow label="Textract job" value={document.textractJobId ?? 'Not assigned'} />
              <EvidenceRow
                label="Failure reason"
                value={document.failureReason ?? 'No failure recorded'}
              />
            </EvidenceGrid>
          </EvidenceSection>

          {document.state === 'processing' && (
            <EvidenceSection title="Processing evidence">
              <EvidenceGrid>
                <EvidenceRow label="OCR state" value="Processing" />
                <EvidenceRow
                  label="Textract job"
                  value={document.textractJobId ?? 'Waiting for job id'}
                />
                <EvidenceRow
                  label="Processing audit"
                  value={processingAudit ? 'Recorded' : 'Audit event pending'}
                />
                <EvidenceRow
                  label="Trace"
                  value={processingAudit?.traceId ?? 'Trace not recorded'}
                />
              </EvidenceGrid>
            </EvidenceSection>
          )}

          <EvidenceSection title="Statement">
            {primaryStatement ? (
              <StatementEvidence statement={primaryStatement} />
            ) : (
              <p className="text-sm text-foreground/60">
                {document.state === 'processing'
                  ? 'OCR is running against the verified S3 object. Extracted rows will appear here when Textract finishes.'
                  : 'Statement extraction has not produced review data yet.'}
              </p>
            )}
          </EvidenceSection>

          <EvidenceSection title="Audit trail">
            {document.auditEvents.length === 0 ? (
              <p className="text-sm text-foreground/60">No audit events are attached yet.</p>
            ) : (
              <ol className="divide-y divide-[var(--border-subtle)]">
                {document.auditEvents.map((event) => (
                  <AuditEventItem key={event.id} event={event} />
                ))}
              </ol>
            )}
          </EvidenceSection>
        </div>

        <aside className="space-y-5">
          <EvidenceSection title="Deletion evidence">
            {document.deletionEvidence ? (
              <EvidenceGrid>
                <EvidenceRow
                  label="Receipt"
                  value={receiptLabel(document.deletionEvidence.receiptStatus)}
                />
                <EvidenceRow
                  label="Receipt sent"
                  value={
                    document.deletionEvidence.receiptSentAt
                      ? formatDateTime(document.deletionEvidence.receiptSentAt)
                      : 'Not sent'
                  }
                />
                <EvidenceRow
                  label="Receipt error"
                  value={document.deletionEvidence.receiptErrorCode ?? 'No error recorded'}
                />
                <EvidenceRow
                  label="Deletion audited"
                  value={
                    document.deletionEvidence.deletionAuditedAt
                      ? formatDateTime(document.deletionEvidence.deletionAuditedAt)
                      : 'Not audited'
                  }
                />
              </EvidenceGrid>
            ) : (
              <p className="text-sm text-foreground/60">
                No deletion receipt is attached to this document yet.
              </p>
            )}
          </EvidenceSection>

          <EvidenceSection title="Review position">
            <dl className="space-y-3 text-sm">
              <EvidenceRow label="State" value={documentStateLabel(document.state)} />
              <EvidenceRow
                label="Statement rows"
                value={formatCount(primaryStatement?.transactionCount ?? 0, 'transaction')}
              />
              <EvidenceRow
                label="Reconciliation"
                value={reconciliationLabel(primaryStatement?.reconciles ?? null)}
              />
            </dl>
          </EvidenceSection>
        </aside>
      </div>
    </div>
  )
}

export function DocumentStateBadge({ state }: { state: DocumentState }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${stateClass(
        state,
      )}`}
    >
      {documentStateLabel(state)}
    </span>
  )
}

function EmptyHistory() {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6">
      <div className="max-w-xl">
        <h2 className="text-xl font-semibold">No statements yet</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/65">
          Upload a PDF statement to create the first document record. PRIZM will show processing,
          review, failure, expiration, and deletion evidence as the workflow advances.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Upload statement
          </Link>
          <Link
            href="/app/settings"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Check workspace settings
          </Link>
        </div>
      </div>
    </section>
  )
}

function HistoryRow({ document }: { document: HistoryDocumentView }) {
  const statement = document.statements[0] ?? null
  const audit = document.auditEvents[0] ?? null
  const isProcessing = document.state === 'processing'

  return (
    <tr>
      <td className="px-4 py-4 align-top">
        <Link
          href={`/app/history/${document.id}`}
          className="font-semibold text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {document.filename}
        </Link>
        <p className="mt-1 text-xs text-foreground/55">
          Uploaded {formatDateTime(document.createdAt)}
        </p>
      </td>
      <td className="px-4 py-4 align-top">
        <DocumentStateBadge state={document.state} />
        {document.failureReason && (
          <p className="mt-2 max-w-44 text-xs leading-5 text-[var(--danger)]">
            {document.failureReason}
          </p>
        )}
      </td>
      <td className="px-4 py-4 align-top text-foreground/70">
        <p className="font-medium text-foreground">
          {statement?.bankName ?? (isProcessing ? 'OCR processing' : 'Statement not extracted')}
        </p>
        <p className="mt-1 text-xs">
          {statement
            ? `${formatCount(statement.transactionCount, 'transaction')} · ${reconciliationLabel(
                statement.reconciles,
              )}`
            : isProcessing && document.textractJobId
              ? `Textract ${document.textractJobId}`
              : `${document.pages ?? 'No'} pages recorded`}
        </p>
      </td>
      <td className="px-4 py-4 align-top text-foreground/70">
        <p className="font-medium text-foreground">{audit?.eventType ?? 'No audit event'}</p>
        <p className="mt-1 text-xs">
          {audit?.traceId
            ? `Trace ${audit.traceId}`
            : audit
              ? formatDateTime(audit.createdAt)
              : 'Waiting'}
        </p>
      </td>
      <td className="px-4 py-4 align-top text-foreground/70">
        <p className="font-medium text-foreground">
          {document.deletionEvidence?.receiptStatus
            ? receiptLabel(document.deletionEvidence.receiptStatus)
            : `Expires ${formatDateTime(document.expiresAt)}`}
        </p>
        <p className="mt-1 text-xs">
          {document.deletedAt
            ? `Deleted ${formatDateTime(document.deletedAt)}`
            : 'Within 24-hour retention window'}
        </p>
      </td>
    </tr>
  )
}

function EvidenceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EvidenceGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">{children}</dl>
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  )
}

function StatementEvidence({ statement }: { statement: StatementEvidenceView }) {
  return (
    <EvidenceGrid>
      <EvidenceRow label="Bank" value={statement.bankName ?? 'Unknown bank'} />
      <EvidenceRow
        label="Account"
        value={statement.accountLast4 ? `•••• ${statement.accountLast4}` : 'Unknown'}
      />
      <EvidenceRow label="Period start" value={formatDate(statement.periodStart)} />
      <EvidenceRow label="Period end" value={formatDate(statement.periodEnd)} />
      <EvidenceRow label="Opening balance" value={formatMoney(statement.openingBalance)} />
      <EvidenceRow label="Closing balance" value={formatMoney(statement.closingBalance)} />
      <EvidenceRow label="Reported total" value={formatMoney(statement.reportedTotal)} />
      <EvidenceRow label="Computed total" value={formatMoney(statement.computedTotal)} />
      <EvidenceRow
        label="Transactions"
        value={formatCount(statement.transactionCount, 'transaction')}
      />
      <EvidenceRow label="Reconciliation" value={reconciliationLabel(statement.reconciles)} />
    </EvidenceGrid>
  )
}

function AuditEventItem({ event }: { event: AuditEventEvidenceView }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">{event.eventType}</p>
        <p className="text-xs text-foreground/55">{formatDateTime(event.createdAt)}</p>
      </div>
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
        <EvidenceRow label="Request" value={event.requestId ?? 'Not recorded'} />
        <EvidenceRow label="Trace" value={event.traceId ?? 'Not recorded'} />
        <EvidenceRow label="Actor" value={event.actorUserId ?? 'System'} />
      </dl>
    </li>
  )
}

function stateClass(state: DocumentState): string {
  switch (state) {
    case 'pending':
      return 'bg-[var(--surface-strong)] text-foreground/70'
    case 'processing':
      return 'bg-[color-mix(in_oklch,var(--info)_16%,transparent)] text-[var(--info)]'
    case 'ready':
      return 'bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]'
    case 'failed':
      return 'bg-[color-mix(in_oklch,var(--danger)_16%,transparent)] text-[var(--danger)]'
    case 'expired':
      return 'bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[var(--warning)]'
  }
}

function receiptLabel(status: 'sent' | 'failed' | null): string {
  if (status === 'sent') return 'Receipt sent'
  if (status === 'failed') return 'Receipt failed'
  return 'No receipt'
}

function reconciliationLabel(value: boolean | null): string {
  if (value === true) return 'Reconciles'
  if (value === false) return 'Needs review'
  return 'Not checked'
}

function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatCount(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function formatMoney(value: number | string | null): string {
  if (value === null) return 'Not recorded'
  const numeric = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(numeric)) return String(value)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric)
}

function formatDate(value: string | null): string {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
