import Link from 'next/link'
import {
  documentStateLabel,
  type AuditEventEvidenceView,
  type DocumentState,
  type HistoryDocumentView,
  type StatementEvidenceView,
  type StatementTransactionView,
} from '@/lib/server/document-history'

export type { HistoryDocumentView }

type StatementType = 'bank' | 'credit_card' | string
type StatementMetadata = Record<string, unknown>
type StatementWithOptionalCardFields = StatementEvidenceView & {
  statementType?: StatementType | null
  statement_type?: StatementType | null
  reviewStatus?: string | null
  review_status?: string | null
  statementMetadata?: StatementMetadata | null
  statement_metadata?: StatementMetadata | null
}

export const HISTORY_QUEUE_FILTERS = [
  'all',
  'processing',
  'ready',
  'failed',
  'expiring-soon',
] as const

export type HistoryQueueFilter = (typeof HISTORY_QUEUE_FILTERS)[number]

const EXPIRING_SOON_WINDOW_MS = 6 * 60 * 60 * 1000

const queueFilterLabels: Record<HistoryQueueFilter, string> = {
  all: 'All',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
  'expiring-soon': 'Expiring soon',
}

export function historyQueueFilterFromParam(
  value: string | string[] | undefined,
): HistoryQueueFilter {
  const raw = Array.isArray(value) ? value[0] : value
  return HISTORY_QUEUE_FILTERS.includes(raw as HistoryQueueFilter)
    ? (raw as HistoryQueueFilter)
    : 'all'
}

export function DocumentHistoryList({
  documents,
  activeFilter = 'all',
}: {
  documents: HistoryDocumentView[]
  activeFilter?: HistoryQueueFilter
}) {
  if (documents.length === 0) return <EmptyHistory />

  const now = new Date()
  const filteredDocuments = documents.filter((document) =>
    matchesQueueFilter(document, activeFilter, now),
  )
  const filterCounts = getFilterCounts(documents, now)

  return (
    <div className="space-y-3">
      <HistoryQueueFilters activeFilter={activeFilter} counts={filterCounts} />

      {filteredDocuments.length === 0 ? (
        <FilteredHistoryEmpty activeFilter={activeFilter} />
      ) : (
        <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-[0.08em] text-foreground/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">Statement</th>
                  <th className="px-4 py-3 font-semibold">Queue state</th>
                  <th className="px-4 py-3 font-semibold">Evidence timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredDocuments.map((document) => (
                  <HistoryRow key={document.id} document={document} now={now} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export function DocumentReview({ document }: { document: HistoryDocumentView }) {
  const primaryStatement = document.statements[0] ?? null
  const processingAudit = findAuditEvent(document.auditEvents, 'document.processing_started')
  const exceptions = reviewExceptionsFor(primaryStatement)
  const recoveryCards = recoveryCardsFor(document, primaryStatement, exceptions)
  const exportReadiness = exportReadinessFor(document, primaryStatement, exceptions)
  const timeline = evidenceTimelineFor(document, primaryStatement, exportReadiness)

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
            Statement summary, extracted rows, exception work, reconciliation, and export readiness
            for this record.
          </p>
        </div>
        <DocumentStateBadge state={document.state} />
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-5">
          {recoveryCards.length > 0 && <FailureRecoveryStack cards={recoveryCards} />}

          <EvidenceSection title="Evidence timeline">
            <EvidenceTimeline steps={timeline} />
          </EvidenceSection>

          <EvidenceSection title="Statement summary">
            <StatementSummary
              document={document}
              statement={primaryStatement}
              processingAudit={processingAudit}
            />
          </EvidenceSection>

          <EvidenceSection title="Transaction table">
            <TransactionTable document={document} statement={primaryStatement} />
          </EvidenceSection>

          <EvidenceSection title="Exceptions">
            <ExceptionsPanel exceptions={exceptions} statement={primaryStatement} />
          </EvidenceSection>

          <EvidenceSection title="Reconciliation result">
            <ReconciliationResult statement={primaryStatement} />
          </EvidenceSection>

          <EvidenceSection title="Export readiness">
            <ExportReadinessPanel document={document} readiness={exportReadiness} />
          </EvidenceSection>

          <EvidenceSection title="Audit trail">
            <AuditTrail events={document.auditEvents} />
          </EvidenceSection>
        </div>

        <aside className="space-y-5">
          <EvidenceSection title="Document record">
            <DocumentEvidence document={document} />
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
              <EvidenceRow label="Export state" value={exportReadiness.label} />
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

function HistoryQueueFilters({
  activeFilter,
  counts,
}: {
  activeFilter: HistoryQueueFilter
  counts: Record<HistoryQueueFilter, number>
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="History queue filters">
      {HISTORY_QUEUE_FILTERS.map((filter) => {
        const active = filter === activeFilter
        return (
          <Link
            key={filter}
            href={historyQueueFilterHref(filter)}
            aria-current={active ? 'page' : undefined}
            aria-label={`${queueFilterLabels[filter]}, ${formatCount(counts[filter], 'document')}`}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              active
                ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] text-foreground'
                : 'border-[var(--border-subtle)] bg-background text-foreground/65 hover:bg-[var(--surface-muted)]'
            }`}
          >
            <span>{queueFilterLabels[filter]}</span>
            <span className="font-mono text-xs text-foreground/50">{counts[filter]}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function FilteredHistoryEmpty({ activeFilter }: { activeFilter: HistoryQueueFilter }) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6">
      <h2 className="text-lg font-semibold">
        No {queueFilterLabels[activeFilter].toLowerCase()} work
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
        The latest loaded history has no document records in this queue state.
      </p>
    </section>
  )
}

function HistoryRow({ document, now }: { document: HistoryDocumentView; now: Date }) {
  const statement = document.statements[0] ?? null
  const exceptions = reviewExceptionsFor(statement)
  const exportReadiness = exportReadinessFor(document, statement, exceptions)
  const timeline = evidenceTimelineFor(document, statement, exportReadiness)
  const isExpiringSoon = documentIsExpiringSoon(document, now)

  return (
    <tr className={historyRowClass(document.state)}>
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
        <p className={`mt-2 text-xs font-medium ${queueSignalClass(document.state)}`}>
          {queueSignal(document, statement, isExpiringSoon)}
        </p>
        {document.failureReason && (
          <p className="mt-2 max-w-44 text-xs leading-5 text-[var(--danger)]">
            {document.failureReason}
          </p>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <EvidenceTimeline
          steps={timeline}
          variant="compact"
          ariaLabel={`Evidence timeline for ${document.filename}`}
        />
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

function QuietStatusPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 leading-6 text-foreground/65">{detail}</p>
    </div>
  )
}

function QuietSkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-md border border-[var(--border-subtle)] p-3 sm:grid-cols-[7rem_minmax(0,1fr)_5rem]"
        >
          <div className="h-3 rounded-full bg-[var(--surface-strong)]" />
          <div className="h-3 rounded-full bg-[var(--surface-muted)]" />
          <div className="h-3 rounded-full bg-[var(--surface-strong)]" />
        </div>
      ))}
    </div>
  )
}

function StatementSummary({
  document,
  statement,
  processingAudit,
}: {
  document: HistoryDocumentView
  statement: StatementEvidenceView | null
  processingAudit: AuditEventEvidenceView | undefined
}) {
  if (statement) {
    const isCreditCard = statementType(statement) === 'credit_card'
    const metadata = statementMetadata(statement)
    const cardRows = isCreditCard ? creditCardSummaryRows(metadata) : []

    return (
      <EvidenceGrid>
        <EvidenceRow
          label={isCreditCard ? 'Issuer' : 'Bank'}
          value={statement.bankName ?? (isCreditCard ? 'Unknown issuer' : 'Unknown bank')}
        />
        <EvidenceRow
          label={isCreditCard ? 'Card' : 'Account'}
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
        {cardRows.map((row) => (
          <EvidenceRow key={row.label} label={row.label} value={row.value} />
        ))}
      </EvidenceGrid>
    )
  }

  if (document.state !== 'processing') {
    return (
      <p className="text-sm text-foreground/60">
        Statement extraction has not produced review data for this document.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Statement pending OCR</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-foreground/60">
          PRIZM has proven the upload request, S3 object verification, and OCR start. It is waiting
          on Textract job{' '}
          <span className="font-mono text-foreground">
            {document.textractJobId ?? 'not assigned'}
          </span>{' '}
          before showing balances, transactions, and reconciliation evidence.
        </p>
      </div>
      <EvidenceGrid>
        <EvidenceRow label="Current state" value="Processing" />
        <EvidenceRow label="Expected next event" value="document.ready" />
        <EvidenceRow
          label="Elapsed time"
          value={formatElapsedSince(processingAudit?.createdAt ?? document.createdAt)}
        />
        <EvidenceRow label="Retention deadline" value={formatDateTime(document.expiresAt)} />
      </EvidenceGrid>
      <QuietSkeletonRows rows={3} />
    </div>
  )
}

type EvidenceTimelineStepId =
  | 'upload_requested'
  | 's3_verified'
  | 'ocr_started'
  | 'ocr_completed'
  | 'statement_extracted'
  | 'export_generated'
  | 'deletion_completed'

type EvidenceTimelineStatus = 'complete' | 'active' | 'waiting' | 'blocked'

type EvidenceTimelineStep = {
  id: EvidenceTimelineStepId
  label: string
  status: EvidenceTimelineStatus
  detail: string
  timestamp: string | null
  evidence: ReviewEvidence[]
}

type EvidenceTimelineVariant = 'full' | 'compact'

function EvidenceTimeline({
  steps,
  variant = 'full',
  ariaLabel = 'Evidence timeline',
}: {
  steps: EvidenceTimelineStep[]
  variant?: EvidenceTimelineVariant
  ariaLabel?: string
}) {
  return (
    <ol aria-label={ariaLabel} className={variant === 'compact' ? 'space-y-2' : 'grid gap-3'}>
      {steps.map((step) => (
        <EvidenceTimelineItem key={step.id} step={step} variant={variant} />
      ))}
    </ol>
  )
}

function EvidenceTimelineItem({
  step,
  variant,
}: {
  step: EvidenceTimelineStep
  variant: EvidenceTimelineVariant
}) {
  if (variant === 'compact') {
    return (
      <li className="grid grid-cols-[0.75rem_minmax(0,8.5rem)_minmax(0,1fr)] gap-2 text-xs">
        <span
          aria-hidden="true"
          className={`mt-1 h-2.5 w-2.5 rounded-full ${timelineDotClass(step.status)}`}
        />
        <span className="font-medium text-foreground">{step.label}</span>
        <span className="min-w-0 text-foreground/60">
          <span className={`font-semibold ${timelineTextClass(step.status)}`}>
            {timelineStatusLabel(step.status)}
          </span>
          {step.timestamp ? (
            <span className="text-foreground/50"> at {formatDateTime(step.timestamp)}</span>
          ) : (
            <span className="text-foreground/50">: {step.detail}</span>
          )}
        </span>
      </li>
    )
  }

  return (
    <li className="rounded-lg border border-[var(--border-subtle)] bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${timelineDotClass(step.status)}`}
          />
          <p className="text-sm font-semibold">{step.label}</p>
        </div>
        <p className="text-sm leading-6 text-foreground/70">{step.detail}</p>
        <ReviewToneBadge tone={timelineStatusTone(step.status)}>
          {timelineStatusLabel(step.status)}
        </ReviewToneBadge>
      </div>

      {(step.timestamp || step.evidence.length > 0) && (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          {step.timestamp && (
            <EvidenceRow label="Recorded" value={formatDateTime(step.timestamp)} />
          )}
          {step.evidence.map((item) => (
            <EvidenceRow key={`${step.id}:${item.label}:${item.value}`} {...item} />
          ))}
        </dl>
      )}
    </li>
  )
}

function evidenceTimelineFor(
  document: HistoryDocumentView,
  statement: StatementEvidenceView | null,
  exportReadiness: ExportReadiness,
): EvidenceTimelineStep[] {
  const uploadRequestedAudit = findFirstAuditEvent(document.auditEvents, [
    'document.upload_requested',
  ])
  const uploadCompletedAudit = findFirstAuditEvent(document.auditEvents, [
    'document.upload_completed',
  ])
  const processingStartedAudit = findFirstAuditEvent(document.auditEvents, [
    'document.processing_started',
  ])
  const ocrCompletedAudit = findFirstAuditEvent(document.auditEvents, [
    'document.ocr_completed',
    'document.processing_completed',
    'document.ready',
  ])
  const exportGeneratedAudit = findFirstAuditEvent(document.auditEvents, [
    'document.export_generated',
    'statement.export_generated',
    'export.generated',
  ])
  const deletionAudit = findFirstAuditEvent(document.auditEvents, ['document.deleted'])
  const recoveryKind = document.state === 'failed' ? recoveryKindFromDocument(document) : null
  const hasVerifiedS3 =
    Boolean(uploadCompletedAudit) ||
    Boolean(processingStartedAudit) ||
    Boolean(document.textractJobId) ||
    document.state === 'verified' ||
    document.state === 'ready' ||
    Boolean(statement)
  const hasOcrStarted = Boolean(processingStartedAudit) || Boolean(document.textractJobId)
  const hasOcrCompleted =
    Boolean(ocrCompletedAudit) || document.state === 'ready' || Boolean(statement)
  const deletionTimestamp =
    document.deletedAt ??
    deletionAudit?.createdAt ??
    document.deletionEvidence?.deletionAuditedAt ??
    document.deletionEvidence?.receiptSentAt ??
    null

  return [
    {
      id: 'upload_requested',
      label: 'Upload requested',
      status: 'complete',
      detail: 'PRIZM created a pending document record for secure browser upload.',
      timestamp: uploadRequestedAudit?.createdAt ?? document.createdAt,
      evidence: [
        { label: 'Document ID', value: document.id },
        { label: 'Request', value: uploadRequestedAudit?.requestId ?? 'Not recorded' },
      ],
    },
    {
      id: 's3_verified',
      label: 'S3 object verified',
      status:
        recoveryKind === 's3_verification_failed'
          ? 'blocked'
          : hasVerifiedS3
            ? 'complete'
            : document.state === 'pending'
              ? 'active'
              : 'waiting',
      detail:
        recoveryKind === 's3_verification_failed'
          ? (document.failureReason ?? 'S3 object verification failed.')
          : hasVerifiedS3
            ? 'PRIZM verified the uploaded S3 object against the pending document record.'
            : 'PRIZM is waiting for the browser upload to finish and for S3 metadata verification.',
      timestamp: uploadCompletedAudit?.createdAt ?? null,
      evidence: [
        { label: 'Bucket', value: document.s3Bucket },
        { label: 'S3 key', value: document.s3Key },
      ],
    },
    {
      id: 'ocr_started',
      label: 'OCR started',
      status:
        recoveryKind === 'ocr_start_failed'
          ? 'blocked'
          : hasOcrStarted
            ? 'complete'
            : hasVerifiedS3
              ? 'active'
              : 'waiting',
      detail:
        recoveryKind === 'ocr_start_failed'
          ? (document.failureReason ?? 'Textract could not start analysis for this document.')
          : hasOcrStarted
            ? `Textract job ${document.textractJobId ?? 'not recorded'} is attached to this document.`
            : hasVerifiedS3
              ? 'PRIZM has proven storage and is waiting to start OCR analysis.'
              : 'OCR waits until the S3 object is verified.',
      timestamp: processingStartedAudit?.createdAt ?? null,
      evidence: [
        { label: 'Textract job ID', value: document.textractJobId ?? 'Not assigned' },
        { label: 'Trace ID', value: processingStartedAudit?.traceId ?? 'Not recorded' },
      ],
    },
    {
      id: 'ocr_completed',
      label: 'OCR completed',
      status:
        recoveryKind === 'ocr_processing_failed'
          ? 'blocked'
          : hasOcrCompleted
            ? 'complete'
            : document.state === 'processing'
              ? 'active'
              : 'waiting',
      detail:
        recoveryKind === 'ocr_processing_failed'
          ? (document.failureReason ?? 'OCR started, but processing did not complete.')
          : hasOcrCompleted
            ? 'OCR has produced reviewable output for this document.'
            : document.state === 'processing'
              ? `PRIZM has proven upload, S3 verification, and OCR start. It is waiting for Textract job ${
                  document.textractJobId ?? 'not assigned'
                } to complete.`
              : 'OCR completion waits on a running Textract job.',
      timestamp: ocrCompletedAudit?.createdAt ?? statement?.createdAt ?? null,
      evidence: [{ label: 'Pages', value: document.pages?.toString() ?? 'Not counted' }],
    },
    {
      id: 'statement_extracted',
      label: 'Statement extracted',
      status: statement ? 'complete' : document.state === 'ready' ? 'blocked' : 'waiting',
      detail: statement
        ? `${statement.bankName ?? 'Statement'} data is attached with ${formatCount(
            statement.transactionCount,
            'transaction',
          )}.`
        : document.state === 'ready'
          ? 'The document is ready, but no statement record is attached.'
          : 'PRIZM is waiting for OCR output to create statement fields and transaction rows.',
      timestamp: statement?.createdAt ?? null,
      evidence: [
        { label: 'Statement ID', value: statement?.id ?? 'Not created' },
        {
          label: 'Reconciliation',
          value: statement ? reconciliationLabel(statement.reconciles) : 'Waiting',
        },
      ],
    },
    {
      id: 'export_generated',
      label: 'Export generated',
      status: exportGeneratedAudit
        ? 'complete'
        : exportReadiness.label === 'Ready to export'
          ? 'waiting'
          : exportReadiness.tone === 'danger' || exportReadiness.tone === 'warning'
            ? 'blocked'
            : 'waiting',
      detail: exportGeneratedAudit
        ? 'A ledger-ready export event is recorded for this document.'
        : exportReadiness.label === 'Ready to export'
          ? 'Statement evidence is ready. PRIZM is waiting for a generated export event.'
          : exportReadiness.cause,
      timestamp: exportGeneratedAudit?.createdAt ?? null,
      evidence: exportGeneratedAudit
        ? [
            { label: 'Audit event', value: exportGeneratedAudit.id },
            { label: 'Request', value: exportGeneratedAudit.requestId ?? 'Not recorded' },
          ]
        : [{ label: 'Export state', value: exportReadiness.label }],
    },
    {
      id: 'deletion_completed',
      label: 'Deletion completed',
      status: deletionTimestamp
        ? 'complete'
        : document.deletionEvidence?.receiptStatus === 'failed'
          ? 'blocked'
          : document.state === 'expired'
            ? 'active'
            : 'waiting',
      detail: deletionTimestamp
        ? deletionDetail(document)
        : document.deletionEvidence?.receiptStatus === 'failed'
          ? `Deletion receipt failed with ${
              document.deletionEvidence.receiptErrorCode ?? 'no error code'
            }.`
          : document.state === 'expired'
            ? 'Retention has expired. PRIZM is waiting for the deletion sweep and receipt evidence.'
            : `Retention is open until ${formatDateTime(document.expiresAt)}.`,
      timestamp: deletionTimestamp,
      evidence: [
        {
          label: 'Receipt',
          value: document.deletionEvidence?.receiptStatus
            ? receiptLabel(document.deletionEvidence.receiptStatus)
            : 'Not sent',
        },
        { label: 'Retention deadline', value: formatDateTime(document.expiresAt) },
      ],
    },
  ]
}

function deletionDetail(document: HistoryDocumentView): string {
  if (document.deletionEvidence?.receiptStatus === 'sent') {
    return 'Document deletion is complete and the deletion receipt was sent.'
  }
  if (document.deletedAt) return 'Document deletion is complete.'
  return 'Deletion evidence is recorded for this document.'
}

function timelineStatusLabel(status: EvidenceTimelineStatus): string {
  switch (status) {
    case 'complete':
      return 'Proven'
    case 'active':
      return 'Now'
    case 'waiting':
      return 'Waiting'
    case 'blocked':
      return 'Blocked'
  }
}

function timelineStatusTone(status: EvidenceTimelineStatus): ReviewTone {
  switch (status) {
    case 'complete':
      return 'success'
    case 'active':
      return 'info'
    case 'waiting':
      return 'neutral'
    case 'blocked':
      return 'danger'
  }
}

function timelineDotClass(status: EvidenceTimelineStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-[var(--success)]'
    case 'active':
      return 'bg-[var(--info)]'
    case 'waiting':
      return 'bg-[var(--surface-strong)] ring-1 ring-[var(--border-subtle)]'
    case 'blocked':
      return 'bg-[var(--danger)]'
  }
}

function timelineTextClass(status: EvidenceTimelineStatus): string {
  switch (status) {
    case 'complete':
      return 'text-[var(--success)]'
    case 'active':
      return 'text-[var(--info)]'
    case 'waiting':
      return 'text-foreground/60'
    case 'blocked':
      return 'text-[var(--danger)]'
  }
}

type ReviewTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

type RecoveryKind =
  | 'upload_failed'
  | 's3_verification_failed'
  | 'ocr_start_failed'
  | 'ocr_processing_failed'
  | 'extraction_incomplete'
  | 'reconciliation_mismatch'

type ReviewEvidence = {
  label: string
  value: string
}

type RecoveryCardData = {
  kind: RecoveryKind
  title: string
  cause: string
  evidence: ReviewEvidence[]
  nextAction: string
  tone: ReviewTone
}

type ReviewException = {
  id: string
  title: string
  cause: string
  evidence: string
  nextAction: string
  tone: ReviewTone
}

type ExportReadiness = {
  label: string
  tone: ReviewTone
  cause: string
  nextAction: string
  evidence: ReviewEvidence[]
  actions: ExportAction[]
}

type ExportAction = {
  format: 'csv' | 'xlsx' | 'quickbooks_csv' | 'xero_csv'
  label: string
}

function FailureRecoveryStack({ cards }: { cards: RecoveryCardData[] }) {
  return (
    <section className="space-y-3" aria-label="Failure recovery">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/45">
          Recovery needed
        </p>
        <h2 className="mt-1 text-base font-semibold">Failure recovery</h2>
      </div>
      {cards.map((card) => (
        <div
          key={card.kind}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">{card.title}</h3>
              <p className="mt-1 text-sm leading-6 text-foreground/70">Cause: {card.cause}</p>
            </div>
            <ReviewToneBadge tone={card.tone}>{recoveryKindLabel(card.kind)}</ReviewToneBadge>
          </div>

          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {card.evidence.map((item) => (
              <div key={`${card.kind}:${item.label}:${item.value}`}>
                <dt className="text-foreground/50">{item.label}</dt>
                <dd className="mt-0.5 break-all font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 text-sm leading-6 text-foreground/75">
            <span className="font-medium text-foreground">Next action:</span> {card.nextAction}
          </p>
        </div>
      ))}
    </section>
  )
}

function TransactionTable({
  document,
  statement,
}: {
  document: HistoryDocumentView
  statement: StatementEvidenceView | null
}) {
  if (!statement) {
    if (document.state === 'processing') {
      return (
        <div className="space-y-3">
          <QuietStatusPanel
            title="Transaction rows pending OCR"
            detail="PRIZM has a verified upload and a running OCR job. It is waiting for statement rows before review can start."
          />
          <QuietSkeletonRows rows={4} />
        </div>
      )
    }

    return (
      <p className="text-sm text-foreground/60">
        Transaction rows will appear after OCR produces a statement record.
      </p>
    )
  }

  if (statement.transactions.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        No transaction rows were extracted. Treat this statement as incomplete until the source PDF
        is checked.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[76rem] text-left text-sm">
        <thead className="border-y border-[var(--border-subtle)] text-xs uppercase tracking-[0.08em] text-foreground/45">
          <tr>
            <th className="py-2 pr-4 font-semibold">Date</th>
            <th className="py-2 pr-4 font-semibold">Description</th>
            <th className="py-2 pr-4 text-right font-semibold">Debit</th>
            <th className="py-2 pr-4 text-right font-semibold">Credit</th>
            <th className="py-2 pr-4 text-right font-semibold">Amount</th>
            <th className="py-2 pr-4 text-right font-semibold">Balance</th>
            <th className="py-2 pr-4 font-semibold">Evidence</th>
            <th className="py-2 font-semibold">Review</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {statement.transactions.map((transaction, index) => (
            <tr
              key={`${transaction.id}:${index}`}
              className={
                transaction.needsReview
                  ? 'bg-[color-mix(in_oklch,var(--warning)_7%,transparent)]'
                  : ''
              }
            >
              <td className="py-3 pr-4 align-top font-medium">
                {transaction.postedAt ? formatDate(transaction.postedAt) : 'Missing'}
              </td>
              <td className="max-w-80 py-3 pr-4 align-top">
                <p className="font-medium">{transaction.description}</p>
                <p className="mt-1 text-xs text-foreground/50">Row {index + 1}</p>
              </td>
              <td className="py-3 pr-4 text-right align-top">{formatMoney(transaction.debit)}</td>
              <td className="py-3 pr-4 text-right align-top">{formatMoney(transaction.credit)}</td>
              <td className="py-3 pr-4 text-right align-top">{formatMoney(transaction.amount)}</td>
              <td className="py-3 pr-4 text-right align-top">{formatMoney(transaction.balance)}</td>
              <td className="py-3 pr-4 align-top">
                <p className="break-all font-mono text-xs">
                  {transaction.source ?? transaction.id}
                </p>
                <p className="mt-1 text-xs text-foreground/50">
                  Confidence {formatConfidence(transaction.confidence)}
                </p>
              </td>
              <td className="py-3 align-top">
                <ReviewToneBadge tone={transaction.needsReview ? 'warning' : 'success'}>
                  {transactionReviewLabel(transaction)}
                </ReviewToneBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExceptionsPanel({
  exceptions,
  statement,
}: {
  exceptions: ReviewException[]
  statement: StatementEvidenceView | null
}) {
  if (!statement) {
    return (
      <p className="text-sm text-foreground/60">
        No extracted statement exists yet, so exception review is waiting on OCR output.
      </p>
    )
  }

  if (exceptions.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border-subtle)] bg-[color-mix(in_oklch,var(--success)_7%,transparent)] p-3 text-sm">
        <p className="font-medium text-[var(--success)]">No exceptions flagged</p>
        <p className="mt-1 text-foreground/70">
          Required statement fields are present, extracted rows have review evidence, and
          reconciliation is not blocking export.
        </p>
      </div>
    )
  }

  return (
    <ol className="divide-y divide-[var(--border-subtle)]">
      {exceptions.map((exception) => (
        <li key={exception.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{exception.title}</p>
              <p className="mt-1 text-sm leading-6 text-foreground/65">Cause: {exception.cause}</p>
            </div>
            <ReviewToneBadge tone={exception.tone}>Needs review</ReviewToneBadge>
          </div>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-[1fr_2fr]">
            <EvidenceRow label="Evidence" value={exception.evidence} />
            <EvidenceRow label="Next action" value={exception.nextAction} />
          </dl>
        </li>
      ))}
    </ol>
  )
}

function ReconciliationResult({ statement }: { statement: StatementEvidenceView | null }) {
  if (!statement) {
    return (
      <p className="text-sm text-foreground/60">
        Reconciliation will run after statement totals and transactions are available.
      </p>
    )
  }

  const delta = reconciliationDelta(statement)
  const tone =
    statement.reconciles === true
      ? 'success'
      : statement.reconciles === false
        ? 'danger'
        : 'warning'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{reconciliationLabel(statement.reconciles)}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/65">
            Reported total is compared with the computed total from extracted rows.
          </p>
        </div>
        <ReviewToneBadge tone={tone}>{reconciliationLabel(statement.reconciles)}</ReviewToneBadge>
      </div>
      <EvidenceGrid>
        <EvidenceRow label="Reported total" value={formatMoney(statement.reportedTotal)} />
        <EvidenceRow label="Computed total" value={formatMoney(statement.computedTotal)} />
        <EvidenceRow label="Delta" value={formatMoney(delta)} />
        <EvidenceRow label="Statement ID" value={statement.id} />
      </EvidenceGrid>
      {statement.reconciles === false && (
        <p className="text-sm leading-6 text-[var(--danger)]">
          Next action: compare the source PDF against rows marked for review, then resolve missing
          or duplicate transactions before export.
        </p>
      )}
    </div>
  )
}

function ExportReadinessPanel({
  document,
  readiness,
}: {
  document: HistoryDocumentView
  readiness: ExportReadiness
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{readiness.label}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/65">Cause: {readiness.cause}</p>
        </div>
        <ReviewToneBadge tone={readiness.tone}>{readiness.label}</ReviewToneBadge>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {readiness.evidence.map((item) => (
          <div key={`${item.label}:${item.value}`}>
            <dt className="text-foreground/50">{item.label}</dt>
            <dd className="mt-0.5 break-all font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-6 text-foreground/75">
        <span className="font-medium text-foreground">Next action:</span> {readiness.nextAction}
      </p>
      {readiness.actions.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Export actions">
          {readiness.actions.map((action) => (
            <Link
              key={action.format}
              href={`/api/v1/documents/${document.id}/export?format=${action.format}`}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentEvidence({ document }: { document: HistoryDocumentView }) {
  return (
    <EvidenceGrid>
      <EvidenceRow label="Document ID" value={document.id} />
      <EvidenceRow label="Uploaded" value={formatDateTime(document.createdAt)} />
      <EvidenceRow label="Expires" value={formatDateTime(document.expiresAt)} />
      <EvidenceRow label="Deletion" value={deletionStateCopy(document)} />
      <EvidenceRow label="Size" value={formatBytes(document.sizeBytes)} />
      <EvidenceRow label="Pages" value={document.pages?.toString() ?? 'Not counted'} />
      <EvidenceRow label="Content type" value={document.contentType} />
    </EvidenceGrid>
  )
}

function deletionStateCopy(document: HistoryDocumentView): string {
  if (
    document.deletedAt ||
    document.deletionEvidence?.deletionAuditedAt ||
    document.deletionEvidence?.receiptSentAt ||
    document.deletionEvidence?.receiptStatus === 'sent'
  ) {
    return 'Deleted'
  }

  return `Scheduled to auto-delete until ${formatDateTime(document.expiresAt)}`
}

function AuditTrail({ events }: { events: AuditEventEvidenceView[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-foreground/60">No audit events are attached yet.</p>
  }

  return (
    <ol className="divide-y divide-[var(--border-subtle)]">
      {events.map((event) => (
        <AuditEventItem key={event.id} event={event} />
      ))}
    </ol>
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
        <EvidenceRow label="Trace ID" value={event.traceId ?? 'Not recorded'} />
        <EvidenceRow label="Actor" value={event.actorUserId ?? 'System'} />
      </dl>
    </li>
  )
}

function reviewExceptionsFor(statement: StatementEvidenceView | null): ReviewException[] {
  if (!statement) return []

  const exceptions: ReviewException[] = [...statementExtractionExceptions(statement)]

  statement.transactions.forEach((transaction, index) => {
    if (!transaction.needsReview) return
    exceptions.push({
      id: `transaction:${transaction.id}`,
      title: `Transaction row ${index + 1}`,
      cause: transaction.reviewReason ?? 'Transaction row was flagged for review.',
      evidence: transaction.source ?? transaction.id,
      nextAction:
        'Compare this row with the source PDF, then correct the extracted row before export.',
      tone: 'warning',
    })
  })

  if (statement.reconciles === false) {
    exceptions.push({
      id: 'reconciliation:mismatch',
      title: 'Reconciliation mismatch',
      cause: 'Reported statement total does not match the computed total from extracted rows.',
      evidence: `Statement ${statement.id}`,
      nextAction:
        'Find missing, duplicated, or sign-flipped transactions before marking export ready.',
      tone: 'danger',
    })
  } else if (statement.reconciles === null) {
    exceptions.push({
      id: 'reconciliation:not-checked',
      title: 'Reconciliation not checked',
      cause: 'PRIZM has not recorded a reconciliation result for this statement.',
      evidence: `Statement ${statement.id}`,
      nextAction: 'Run reconciliation before marking the statement export ready.',
      tone: 'warning',
    })
  }

  return exceptions
}

function statementExtractionExceptions(statement: StatementEvidenceView): ReviewException[] {
  const exceptions: ReviewException[] = []
  const missing: string[] = []
  const isCreditCard = statementType(statement) === 'credit_card'

  if (!statement.bankName) missing.push(isCreditCard ? 'issuer' : 'bank name')
  if (!statement.accountLast4) missing.push(isCreditCard ? 'card last 4' : 'account last 4')
  if (!statement.periodStart || !statement.periodEnd) missing.push('statement period')
  if (statement.openingBalance === null) missing.push('opening balance')
  if (statement.closingBalance === null) missing.push('closing balance')
  if (statement.transactionCount === 0) missing.push('transaction rows')

  if (missing.length > 0) {
    exceptions.push({
      id: 'extraction:statement-fields',
      title: 'Extraction incomplete',
      cause: `OCR output is missing ${missing.join(', ')}.`,
      evidence: `Statement ${statement.id}`,
      nextAction: 'Use the source PDF to fill missing statement evidence before export.',
      tone: 'warning',
    })
  }

  return exceptions
}

function recoveryCardsFor(
  document: HistoryDocumentView,
  statement: StatementEvidenceView | null,
  exceptions: ReviewException[],
): RecoveryCardData[] {
  const cards: RecoveryCardData[] = []

  if (document.state === 'failed') {
    cards.push(failedRecoveryCard(document))
  }

  const extractionIncomplete =
    document.state === 'ready' &&
    (!statement || exceptions.some((exception) => exception.id.startsWith('extraction:')))
  if (extractionIncomplete) {
    cards.push({
      kind: 'extraction_incomplete',
      title: 'Extraction incomplete',
      cause: statement
        ? 'Required statement fields or transaction evidence are missing from OCR output.'
        : 'The document is ready, but no statement record is attached.',
      evidence: [
        { label: 'Document ID', value: document.id },
        statement ? { label: 'Statement ID', value: statement.id } : null,
        document.textractJobId ? { label: 'Textract job ID', value: document.textractJobId } : null,
      ].filter((item): item is ReviewEvidence => item !== null),
      nextAction:
        'Check the source PDF and resolve missing statement fields or rows before export.',
      tone: 'warning',
    })
  }

  if (statement?.reconciles === false) {
    cards.push({
      kind: 'reconciliation_mismatch',
      title: 'Reconciliation mismatch',
      cause: 'Reported and computed totals do not match for this statement.',
      evidence: [
        { label: 'Statement ID', value: statement.id },
        { label: 'Reported total', value: formatMoney(statement.reportedTotal) },
        { label: 'Computed total', value: formatMoney(statement.computedTotal) },
        { label: 'Delta', value: formatMoney(reconciliationDelta(statement)) },
      ],
      nextAction:
        'Compare extracted rows against the source PDF, then resolve missing, duplicate, or sign-flipped transactions.',
      tone: 'danger',
    })
  }

  return cards
}

function failedRecoveryCard(document: HistoryDocumentView): RecoveryCardData {
  const kind = recoveryKindFromDocument(document)
  const failureAudit =
    findAuditEvent(document.auditEvents, 'document.processing_failed') ??
    findAuditEvent(document.auditEvents, 'document.failed') ??
    document.auditEvents[0]

  return {
    kind,
    title: recoveryTitle(kind),
    cause: document.failureReason ?? recoveryFallbackCause(kind),
    evidence: [
      { label: 'Document ID', value: document.id },
      document.textractJobId ? { label: 'Textract job ID', value: document.textractJobId } : null,
      failureAudit?.id ? { label: 'Audit event ID', value: failureAudit.id } : null,
      failureAudit?.requestId ? { label: 'Request ID', value: failureAudit.requestId } : null,
      failureAudit?.traceId ? { label: 'Trace ID', value: failureAudit.traceId } : null,
    ].filter((item): item is ReviewEvidence => item !== null),
    nextAction: recoveryNextAction(kind),
    tone: 'danger',
  }
}

function recoveryKindFromDocument(document: HistoryDocumentView): RecoveryKind {
  const reason = document.failureReason?.toLowerCase() ?? ''

  if (reason.includes('s3') || reason.includes('metadata') || reason.includes('object')) {
    return 's3_verification_failed'
  }
  if (reason.includes('could not be started') || reason.includes('start')) {
    return 'ocr_start_failed'
  }
  if (reason.includes('ocr') || reason.includes('textract') || reason.includes('processing')) {
    return 'ocr_processing_failed'
  }
  if (reason.includes('upload')) {
    return 'upload_failed'
  }
  return document.textractJobId ? 'ocr_processing_failed' : 'upload_failed'
}

function recoveryTitle(kind: RecoveryKind): string {
  switch (kind) {
    case 'upload_failed':
      return 'Upload failed'
    case 's3_verification_failed':
      return 'S3 verification failed'
    case 'ocr_start_failed':
      return 'OCR start failed'
    case 'ocr_processing_failed':
      return 'OCR processing failed'
    case 'extraction_incomplete':
      return 'Extraction incomplete'
    case 'reconciliation_mismatch':
      return 'Reconciliation mismatch'
  }
}

function recoveryFallbackCause(kind: RecoveryKind): string {
  switch (kind) {
    case 'upload_failed':
      return 'The document did not complete the upload intake flow.'
    case 's3_verification_failed':
      return 'PRIZM could not verify that the S3 object matched the document record.'
    case 'ocr_start_failed':
      return 'The file reached storage, but OCR analysis did not start.'
    case 'ocr_processing_failed':
      return 'OCR started, but processing did not produce usable statement output.'
    case 'extraction_incomplete':
      return 'OCR output is missing required statement or transaction evidence.'
    case 'reconciliation_mismatch':
      return 'Reported and computed totals do not match.'
  }
}

function recoveryNextAction(kind: RecoveryKind): string {
  switch (kind) {
    case 'upload_failed':
      return 'Upload the original PDF again. If it repeats, export a fresh PDF from the issuer portal.'
    case 's3_verification_failed':
      return 'Upload the original PDF again so PRIZM can create a new verified storage object.'
    case 'ocr_start_failed':
      return 'Keep the document ID, then upload again or retry OCR when a retry action is available.'
    case 'ocr_processing_failed':
      return 'Confirm the PDF is readable, then reprocess or upload a cleaner statement file.'
    case 'extraction_incomplete':
      return 'Resolve missing fields and rows against the source PDF before export.'
    case 'reconciliation_mismatch':
      return 'Resolve missing, duplicate, or sign-flipped transactions before export.'
  }
}

function exportReadinessFor(
  document: HistoryDocumentView,
  statement: StatementEvidenceView | null,
  exceptions: ReviewException[],
): ExportReadiness {
  if (document.state === 'failed') {
    return {
      label: 'Export blocked',
      tone: 'danger',
      cause: 'Document recovery is required before ledger output can be trusted.',
      evidence: [{ label: 'Document ID', value: document.id }],
      nextAction: 'Resolve the failure recovery item above before export.',
      actions: [],
    }
  }

  if (document.state === 'expired' || document.deletedAt) {
    return {
      label: 'Export blocked',
      tone: 'warning',
      cause: 'The document is outside the active retention window.',
      evidence: [{ label: 'Retention', value: formatDateTime(document.expiresAt) }],
      nextAction: 'Upload the statement again if the firm still needs export output.',
      actions: [],
    }
  }

  if (!statement) {
    return {
      label: 'Export waiting',
      tone: 'info',
      cause: 'OCR has not produced statement rows yet.',
      evidence: [
        { label: 'Document state', value: documentStateLabel(document.state) },
        { label: 'Textract job ID', value: document.textractJobId ?? 'Not assigned' },
      ],
      nextAction: 'Wait for OCR to finish, then review exceptions before export.',
      actions: [],
    }
  }

  if (exceptions.length > 0 || statement.reconciles !== true) {
    return {
      label: 'Export blocked',
      tone: exceptions.some((exception) => exception.tone === 'danger') ? 'danger' : 'warning',
      cause: `${formatCount(exceptions.length, 'exception')} must be resolved before export.`,
      evidence: [
        { label: 'Statement ID', value: statement.id },
        { label: 'Rows', value: formatCount(statement.transactionCount, 'transaction') },
        { label: 'Reconciliation', value: reconciliationLabel(statement.reconciles) },
      ],
      nextAction: 'Resolve exceptions and reconciliation before exporting ledger-ready output.',
      actions: [],
    }
  }

  const reviewStatus = statementReviewStatus(statement)
  if (reviewStatus && reviewStatus !== 'reviewed' && reviewStatus !== 'reconciled') {
    return {
      label: 'Export blocked',
      tone: 'warning',
      cause: 'Statement review must be completed before export.',
      evidence: [
        { label: 'Statement ID', value: statement.id },
        { label: 'Review', value: reviewStatus },
      ],
      nextAction: 'Review this statement before exporting ledger-ready output.',
      actions: [],
    }
  }

  return {
    label: 'Ready to export',
    tone: 'success',
    cause: 'Statement fields are present, rows are clear, and reconciliation passes.',
    evidence: [
      { label: 'Statement ID', value: statement.id },
      { label: 'Rows', value: formatCount(statement.transactionCount, 'transaction') },
      { label: 'Retention', value: formatDateTime(statement.expiresAt) },
    ],
    nextAction: 'Export ledger-ready output from this reviewed statement.',
    actions: exportActionsFor(statement),
  }
}

function exportActionsFor(statement: StatementEvidenceView): ExportAction[] {
  const reviewStatus = statementReviewStatus(statement)
  if (reviewStatus && reviewStatus !== 'reviewed' && reviewStatus !== 'reconciled') return []
  return [
    { format: 'csv', label: 'CSV' },
    { format: 'xlsx', label: 'XLSX' },
    { format: 'quickbooks_csv', label: 'QuickBooks CSV' },
    { format: 'xero_csv', label: 'Xero CSV' },
  ]
}

function ReviewToneBadge({ tone, children }: { tone: ReviewTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-7 w-fit items-center rounded-full px-2.5 text-xs font-semibold ${reviewToneClass(
        tone,
      )}`}
    >
      {children}
    </span>
  )
}

function reviewToneClass(tone: ReviewTone): string {
  switch (tone) {
    case 'success':
      return 'bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]'
    case 'warning':
      return 'bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[var(--warning)]'
    case 'danger':
      return 'bg-[color-mix(in_oklch,var(--danger)_16%,transparent)] text-[var(--danger)]'
    case 'info':
      return 'bg-[color-mix(in_oklch,var(--info)_16%,transparent)] text-[var(--info)]'
    case 'neutral':
      return 'bg-[var(--surface-strong)] text-foreground/70'
  }
}

function recoveryKindLabel(kind: RecoveryKind): string {
  return recoveryTitle(kind)
}

function transactionReviewLabel(transaction: StatementTransactionView): string {
  return transaction.needsReview ? 'Review' : 'Clear'
}

function statementType(statement: StatementEvidenceView): StatementType | null {
  const withFields = statement as StatementWithOptionalCardFields
  return withFields.statementType ?? withFields.statement_type ?? null
}

function statementReviewStatus(statement: StatementEvidenceView): string | null {
  const withFields = statement as StatementWithOptionalCardFields
  return withFields.reviewStatus ?? withFields.review_status ?? null
}

function statementMetadata(statement: StatementEvidenceView): StatementMetadata {
  const withFields = statement as StatementWithOptionalCardFields
  return withFields.statementMetadata ?? withFields.statement_metadata ?? {}
}

function creditCardSummaryRows(metadata: StatementMetadata): ReviewEvidence[] {
  return [
    metadataStringValue(metadata, 'paymentDueDate')
      ? {
          label: 'Payment due date',
          value: formatDate(metadataStringValue(metadata, 'paymentDueDate')),
        }
      : null,
    metadataMoneyValue(metadata, 'minimumPaymentDue') !== null
      ? {
          label: 'Minimum payment',
          value: formatMoney(metadataMoneyValue(metadata, 'minimumPaymentDue')),
        }
      : null,
    metadataMoneyValue(metadata, 'newBalance') !== null
      ? { label: 'New balance', value: formatMoney(metadataMoneyValue(metadata, 'newBalance')) }
      : null,
    metadataMoneyValue(metadata, 'rewardsEarned') !== null
      ? {
          label: 'Rewards earned',
          value: formatMoney(metadataMoneyValue(metadata, 'rewardsEarned')),
        }
      : null,
    metadataMoneyValue(metadata, 'feeTotal') !== null
      ? { label: 'Fees charged', value: formatMoney(metadataMoneyValue(metadata, 'feeTotal')) }
      : null,
    metadataMoneyValue(metadata, 'interestTotal') !== null
      ? {
          label: 'Interest charged',
          value: formatMoney(metadataMoneyValue(metadata, 'interestTotal')),
        }
      : null,
  ].filter((row): row is ReviewEvidence => row !== null)
}

function metadataStringValue(metadata: StatementMetadata, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function metadataMoneyValue(metadata: StatementMetadata, key: string): number | string | null {
  const value = metadata[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  return null
}

function formatConfidence(value: number | null): string {
  if (value === null) return 'Not recorded'
  return `${Math.round(value * 100)}%`
}

function reconciliationDelta(statement: StatementEvidenceView): number | null {
  const reported = numericMoney(statement.reportedTotal)
  const computed = numericMoney(statement.computedTotal)
  if (reported === null || computed === null) return null
  return computed - reported
}

function numericMoney(value: number | string | null): number | null {
  if (value === null) return null
  const numeric = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(numeric) ? numeric : null
}

function historyQueueFilterHref(filter: HistoryQueueFilter): string {
  if (filter === 'all') return '/app/history'
  const params = new URLSearchParams({ status: filter })
  return `/app/history?${params.toString()}`
}

function getFilterCounts(
  documents: HistoryDocumentView[],
  now: Date,
): Record<HistoryQueueFilter, number> {
  return {
    all: documents.length,
    processing: documents.filter((document) => matchesQueueFilter(document, 'processing', now))
      .length,
    ready: documents.filter((document) => matchesQueueFilter(document, 'ready', now)).length,
    failed: documents.filter((document) => matchesQueueFilter(document, 'failed', now)).length,
    'expiring-soon': documents.filter((document) =>
      matchesQueueFilter(document, 'expiring-soon', now),
    ).length,
  }
}

function matchesQueueFilter(
  document: HistoryDocumentView,
  filter: HistoryQueueFilter,
  now: Date,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'processing':
      return document.state === 'verified' || document.state === 'processing'
    case 'ready':
      return document.state === 'ready'
    case 'failed':
      return document.state === 'failed'
    case 'expiring-soon':
      return documentIsExpiringSoon(document, now)
  }
}

function documentIsExpiringSoon(document: HistoryDocumentView, now: Date): boolean {
  if (document.deletedAt || document.state === 'expired') return false
  const deadline = new Date(document.expiresAt).getTime()
  if (!Number.isFinite(deadline)) return false
  const remaining = deadline - now.getTime()
  return remaining > 0 && remaining <= EXPIRING_SOON_WINDOW_MS
}

function findAuditEvent(
  events: AuditEventEvidenceView[],
  eventType: string,
): AuditEventEvidenceView | undefined {
  return events.find((event) => event.eventType === eventType)
}

function findFirstAuditEvent(
  events: AuditEventEvidenceView[],
  eventTypes: readonly string[],
): AuditEventEvidenceView | undefined {
  return events.find((event) => eventTypes.includes(event.eventType))
}

function historyRowClass(state: DocumentState): string {
  switch (state) {
    case 'verified':
    case 'processing':
      return 'bg-[color-mix(in_oklch,var(--info)_5%,transparent)]'
    case 'ready':
      return 'bg-[color-mix(in_oklch,var(--success)_7%,transparent)]'
    case 'failed':
      return 'bg-[color-mix(in_oklch,var(--danger)_8%,transparent)]'
    case 'pending':
    case 'expired':
      return ''
  }
}

function queueSignal(
  document: HistoryDocumentView,
  statement: StatementEvidenceView | null,
  isExpiringSoon: boolean,
): string {
  if (document.state === 'failed') return 'Action needed'
  if (document.state === 'verified') return 'Storage verified'
  if (document.state === 'processing') return 'OCR running'
  if (isExpiringSoon) return 'Retention deadline near'
  if (document.state === 'ready') {
    return statement?.reconciles === false ? 'Needs review' : 'Ready for review'
  }
  if (document.state === 'expired') return 'Expired'
  return 'Waiting for upload'
}

function queueSignalClass(state: DocumentState): string {
  switch (state) {
    case 'verified':
    case 'processing':
      return 'text-[var(--info)]'
    case 'ready':
      return 'text-[var(--success)]'
    case 'failed':
      return 'text-[var(--danger)]'
    case 'expired':
      return 'text-[var(--warning)]'
    case 'pending':
      return 'text-foreground/55'
  }
}

function stateClass(state: DocumentState): string {
  switch (state) {
    case 'pending':
      return 'bg-[var(--surface-strong)] text-foreground/70'
    case 'verified':
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

function formatElapsedSince(value: string, now = new Date()): string {
  const startedAt = new Date(value).getTime()
  if (!Number.isFinite(startedAt)) return 'Not available'

  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startedAt) / 60000))
  if (elapsedMinutes < 1) return 'Less than 1 minute elapsed'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m elapsed`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  const remainingMinutes = elapsedMinutes % 60
  if (elapsedHours < 24) {
    return remainingMinutes > 0
      ? `${elapsedHours}h ${remainingMinutes}m elapsed`
      : `${elapsedHours}h elapsed`
  }

  const elapsedDays = Math.floor(elapsedHours / 24)
  const remainingHours = elapsedHours % 24
  return remainingHours > 0
    ? `${elapsedDays}d ${remainingHours}h elapsed`
    : `${elapsedDays}d elapsed`
}
