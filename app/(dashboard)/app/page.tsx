'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { pollDocumentStatus } from '@/lib/client/document-polling'
import { hasPendingUpload, takePendingUpload } from '@/components/marketing/upload-hero'
import {
  HorizontalStepper,
  type HorizontalStepperStatus,
} from '@/components/marketing/horizontal-stepper'

type UploadState =
  | 'idle'
  | 'hashing'
  | 'preflighting'
  | 'confirming'
  | 'presigning'
  | 'uploading'
  | 'completing'
  | 'converting'
  | 'polling'
  | 'done'
  | 'error'

type UploadEvidence = {
  documentId: string
  requestId: string
  completionRequestId: string
  traceId: string
  textractJobId: string
  filename: string
  sizeBytes: number
  uploadedAt: string
  expiresAt: string
}

type PresignResponse = {
  uploadUrl: string
  documentId: string
  request_id: string
  trace_id: string
}

type PreflightResponse = {
  quote: {
    costCredits: 1
  }
  currentBalance: number
  canConvert: boolean
  duplicate: {
    isDuplicate: boolean
    existingDocumentId?: string
  }
  request_id: string
  trace_id: string
}

type PendingPreflight = {
  file: File
  fileSha256: string
  preflight: PreflightResponse
}

type CompleteResponse = {
  documentId: string
  status: 'verified' | 'processing' | 'ready'
  textractJobId?: string
  alreadyCompleted: boolean
  request_id: string
  trace_id: string
}

type ConvertResponse = {
  documentId: string
  status: 'processing' | 'ready'
  textractJobId?: string
  chargeStatus?: string
  alreadyStarted?: boolean
  request_id: string
  trace_id: string
}

type ProblemResponse = {
  code?: string
  title?: string
  detail?: string
  request_id?: string
  trace_id?: string
}

type UploadRecoveryKind = 'upload_failed' | 's3_verification_failed' | 'ocr_start_failed'

type RecoveryEvidence = {
  label: string
  value: string
}

type UploadRecovery = {
  kind: UploadRecoveryKind
  title: string
  plainCause: string
  evidence: RecoveryEvidence[]
  nextAction: string
}

type UploadFlowError = Error & {
  recovery: UploadRecovery
}

const MAX_FILE_BYTES = 20 * 1024 * 1024

const workflowSteps = [
  {
    label: 'Check PDF',
    detail: 'StatementStudio hashes the PDF, checks duplicates, and quotes one conversion credit.',
  },
  {
    label: 'Upload securely',
    detail: 'The browser uploads to a short-lived URL before conversion can begin.',
  },
  {
    label: 'Convert rows',
    // SECURITY-AUDIT: removed Textract vendor name from conversion copy
    detail: 'Converted output becomes a statement preview with exceptions called out.',
  },
  {
    label: 'Export spreadsheet',
    detail: 'Reviewed rows export to XLSX or CSV before the 24-hour deletion window closes.',
  },
]

const processingStages = [
  {
    label: 'Reading document',
    detail: 'Statement pages and account sections enter the extraction record.',
  },
  {
    label: 'Detecting transactions',
    detail: 'Dates, descriptions, amounts, and balances resolve into columns.',
  },
  {
    label: 'Checking balances',
    detail: 'Rows are prepared for review with reconciliation evidence visible.',
  },
  {
    label: 'Preparing export',
    detail: 'Spreadsheet formats wait for the review record to be ready.',
  },
]

export default function UploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [recovery, setRecovery] = useState<UploadRecovery | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null)
  const [evidence, setEvidence] = useState<UploadEvidence | null>(null)
  const [pendingPreflight, setPendingPreflight] = useState<PendingPreflight | null>(null)

  const handleFile = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    setSelectedFile({ name: file.name, size: file.size })

    if (!isPdf) {
      setState('error')
      setRecovery(
        localUploadRecovery(
          'File type is not PDF.',
          'Choose a bank or credit-card statement exported as a PDF, then upload that file.',
          file,
        ),
      )
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setState('error')
      setRecovery(
        localUploadRecovery(
          'File is larger than the 20 MB upload limit.',
          'Export a smaller PDF from the issuer portal, then upload the smaller file.',
          file,
        ),
      )
      return
    }

    setRecovery(null)
    setEvidence(null)
    setPendingPreflight(null)
    setState('hashing')

    try {
      const fileSha256 = await sha256Hex(file)
      setState('preflighting')
      const preflightRes = await fetch('/api/v1/documents/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: 'application/pdf',
          sizeBytes: file.size,
          fileSha256,
        }),
      })

      if (!preflightRes.ok) {
        const problem = await readProblem(preflightRes)
        throw uploadFlowError(
          recoveryFromProblem({
            kind: 'upload_failed',
            title: 'Preflight failed',
            problem,
            fallbackCause: 'StatementStudio could not quote this PDF before upload.',
            // SECURITY-AUDIT: removed SHA-256 hash row from preflight failure evidence
            fallbackEvidence: [{ label: 'File', value: file.name }],
            nextAction:
              'Keep the original PDF, refresh the upload console, and request a new quote.',
          }),
        )
      }

      const preflight = (await preflightRes.json()) as PreflightResponse
      setPendingPreflight({ file, fileSha256, preflight })
      setState('confirming')
    } catch (err) {
      setState('error')
      setRecovery(
        isUploadFlowError(err)
          ? err.recovery
          : localUploadRecovery(
              err instanceof Error
                ? err.message
                : // SECURITY-AUDIT: removed OCR mention from preflight error fallback
                  'StatementStudio could not finish the upload preflight before the conversion started.',
              'Upload the PDF again and use the support reference shown here if the failure repeats.',
              file,
            ),
      )
    }
  }, [])

  useEffect(() => {
    if (!hasPendingUpload()) return
    const file = takePendingUpload()
    if (!file) return
    queueMicrotask(() => {
      void handleFile(file)
    })
  }, [handleFile])

  const confirmUpload = useCallback(async () => {
    if (!pendingPreflight) return
    const { file, fileSha256, preflight } = pendingPreflight
    if (!preflight.canConvert) return
    setRecovery(null)
    setEvidence(null)
    setState('presigning')

    try {
      const presignRes = await fetch('/api/v1/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: 'application/pdf',
          sizeBytes: file.size,
          fileSha256,
          acceptedQuote: {
            costCredits: preflight.quote.costCredits,
            fileSha256,
          },
        }),
      })

      if (!presignRes.ok) {
        const problem = await readProblem(presignRes)
        throw uploadFlowError(
          recoveryFromProblem({
            kind: 'upload_failed',
            title: 'Upload setup failed',
            problem,
            fallbackCause: 'StatementStudio could not create a secure upload URL for this PDF.',
            // SECURITY-AUDIT: removed SHA-256 hash row from upload-setup failure evidence
            fallbackEvidence: [
              { label: 'File', value: file.name },
              { label: 'Quote', value: formatCredits(preflight.quote.costCredits) },
            ],
            nextAction:
              'Keep the original PDF, refresh the upload console, and request a new upload URL.',
          }),
        )
      }

      const presign = (await presignRes.json()) as PresignResponse

      setState('uploading')
      let uploadRes: Response
      try {
        uploadRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: file,
        })
      } catch (err) {
        const browserError = err instanceof Error ? err.message : 'Storage fetch rejected'
        throw uploadFlowError({
          kind: 'upload_failed',
          title: 'Upload failed',
          // SECURITY-AUDIT: removed OCR job + CORS/storage-provider internals from upload error copy
          plainCause: `The browser could not reach secure storage. Browser error: ${browserError}. No conversion was started.`,
          evidence: uploadEvidenceIds(presign, [
            { label: 'Browser upload error', value: browserError },
          ]),
          nextAction:
            'Check your network connection, then upload the same PDF again. Contact support with the support reference if it repeats.',
        })
      }

      if (!uploadRes.ok) {
        throw uploadFlowError({
          kind: 'upload_failed',
          title: 'Upload failed',
          // SECURITY-AUDIT: removed OCR job mention from upload error copy
          plainCause: `The browser upload to secure storage returned HTTP ${uploadRes.status}. No conversion was started.`,
          evidence: uploadEvidenceIds(presign, [
            { label: 'Storage response', value: String(uploadRes.status) },
          ]),
          nextAction:
            'Upload the same PDF again. If the storage response repeats, export a fresh PDF from the issuer portal before retrying.',
        })
      }

      setState('completing')
      const completeRes = await fetch(`/api/v1/documents/${presign.documentId}/complete`, {
        method: 'POST',
      })

      if (!completeRes.ok) {
        const problem = await readProblem(completeRes)
        throw uploadFlowError(recoveryFromCompletionProblem(problem, presign))
      }

      const complete = (await completeRes.json()) as CompleteResponse
      setState('converting')
      const convertRes = await fetch(`/api/v1/documents/${presign.documentId}/convert`, {
        method: 'POST',
      })
      if (!convertRes.ok) {
        const problem = await readProblem(convertRes)
        throw uploadFlowError(recoveryFromCompletionProblem(problem, presign))
      }
      const convert = (await convertRes.json()) as ConvertResponse
      setState('polling')
      await pollDocumentStatus(presign.documentId)
      const uploadedAt = new Date()
      setEvidence({
        documentId: presign.documentId,
        requestId: presign.request_id,
        completionRequestId: complete.request_id,
        traceId: convert.trace_id,
        textractJobId: convert.textractJobId ?? complete.textractJobId ?? 'not assigned',
        filename: file.name,
        sizeBytes: file.size,
        uploadedAt: uploadedAt.toISOString(),
        expiresAt: new Date(uploadedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
      setState('done')
      router.push(`/app/history/${presign.documentId}`)
    } catch (err) {
      setState('error')
      setRecovery(
        isUploadFlowError(err)
          ? err.recovery
          : localUploadRecovery(
              err instanceof Error
                ? err.message
                : // SECURITY-AUDIT: removed OCR mention from upload-flow error fallback
                  'StatementStudio could not finish the upload flow before the conversion started.',
              'Upload the PDF again and use the support reference shown here if the failure repeats.',
              file,
            ),
      )
    }
  }, [pendingPreflight, router])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (working) return
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  function resetUpload() {
    setState('idle')
    setRecovery(null)
    setSelectedFile(null)
    setEvidence(null)
    setPendingPreflight(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const busy =
    state === 'hashing' ||
    state === 'preflighting' ||
    state === 'presigning' ||
    state === 'uploading'
  const working = busy || state === 'completing' || state === 'converting' || state === 'polling'

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="border-b border-[var(--border-subtle)] pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
            Bank or credit-card statement converter
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Convert PDF statements to Excel and CSV
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
            {/* SECURITY-AUDIT: removed OCR term from intake copy */}
            Upload one bank or credit-card statement PDF. StatementStudio checks the file, quotes
            the conversion, starts the conversion, and opens a review record for spreadsheet export.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        <section className="space-y-6" aria-labelledby="upload-heading">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="upload-heading" className="text-lg font-semibold">
                  PDF to spreadsheet
                </h2>
                <p className="mt-1 text-sm leading-6 text-foreground/60">
                  One PDF, 20 MB max. Upload URLs expire after 10 minutes.
                </p>
              </div>
              <StatusPill state={state} />
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                if (!working) setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              aria-busy={working}
              className={`mt-5 rounded-lg border border-dashed p-6 transition-colors ${
                dragOver
                  ? 'border-[var(--accent)] bg-background'
                  : 'border-[var(--border-subtle)] bg-background'
              }`}
            >
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-base font-semibold">
                    {selectedFile?.name ?? 'Drop a PDF statement here'}
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    {selectedFile
                      ? `${formatBytes(selectedFile.size)} selected`
                      : 'StatementStudio checks the file hash before the secure upload starts.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => inputRef.current?.click()}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Choose PDF
                  </button>
                  {state === 'confirming' && pendingPreflight?.preflight.canConvert && (
                    <button
                      type="button"
                      onClick={confirmUpload}
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Confirm conversion
                    </button>
                  )}
                  {(state === 'done' || state === 'error') && (
                    <button
                      type="button"
                      onClick={resetUpload}
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      Convert another
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={inputRef}
                id="file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={working}
                onChange={handleFileInput}
              />

              <div className="mt-5" aria-live="polite">
                <UploadMessage
                  state={state}
                  recovery={recovery}
                  evidence={evidence}
                  pendingPreflight={pendingPreflight}
                />
              </div>
              <ProcessingAnimation state={state} />
            </div>
          </div>

          <WorkflowPanel currentState={state} />
          <CurrentDocumentHandoff evidence={evidence} />
        </section>
      </div>
    </div>
  )
}

function StatusPill({ state }: { state: UploadState }) {
  const label =
    state === 'hashing'
      ? 'Hashing'
      : state === 'preflighting'
        ? 'Quoting'
        : state === 'confirming'
          ? 'Confirm'
          : state === 'presigning'
            ? 'Preparing'
            : state === 'uploading'
              ? 'Uploading'
              : state === 'completing'
                ? 'Verifying'
                : state === 'converting'
                  ? 'Converting'
                  : state === 'polling'
                    ? 'Checking'
                    : state === 'done'
                      ? 'Processing'
                      : state === 'error'
                        ? 'Needs action'
                        : 'Ready'
  const tone =
    state === 'done'
      ? 'success'
      : state === 'error'
        ? 'danger'
        : state === 'idle'
          ? 'neutral'
          : 'info'

  return <ToneBadge tone={tone}>{label}</ToneBadge>
}

function UploadMessage({
  state,
  recovery,
  evidence,
  pendingPreflight,
}: {
  state: UploadState
  recovery: UploadRecovery | null
  evidence: UploadEvidence | null
  pendingPreflight: PendingPreflight | null
}) {
  if (state === 'hashing') {
    {
      /* SECURITY-AUDIT: removed SHA-256 hash mention */
    }
    return <p className="text-sm text-foreground/65">Verifying document...</p>
  }
  if (state === 'preflighting') {
    return <p className="text-sm text-foreground/65">Checking duplicate and one-credit quote...</p>
  }
  if (state === 'confirming' && pendingPreflight) {
    return <PreflightConfirmation pendingPreflight={pendingPreflight} />
  }
  if (state === 'presigning') {
    return <p className="text-sm text-foreground/65">Preparing secure upload URL...</p>
  }
  if (state === 'uploading') {
    return <p className="text-sm text-foreground/65">Uploading to secure storage...</p>
  }
  if (state === 'completing') {
    return (
      // SECURITY-AUDIT: removed S3 object evidence + OCR from verification copy
      <p className="text-sm text-foreground/65">Verifying document and starting conversion...</p>
    )
  }
  if (state === 'converting') {
    return <p className="text-sm text-foreground/65">Starting statement conversion...</p>
  }
  if (state === 'polling') {
    return <p className="text-sm text-foreground/65">Checking preview readiness...</p>
  }
  if (state === 'done' && evidence) {
    return (
      <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm">
        <p className="font-medium text-[var(--success)]">Conversion started.</p>
        <p className="mt-1 text-foreground/65">
          {/* SECURITY-AUDIT: removed Textract job id from success copy */}
          Conversion is in progress for document {shortId(evidence.documentId)}.
        </p>
        <Link
          href={`/app/history/${evidence.documentId}`}
          className="mt-3 inline-flex text-sm font-medium text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Open review and export
        </Link>
      </div>
    )
  }
  if (state === 'error') {
    return recovery ? (
      <UploadRecoveryPanel recovery={recovery} />
    ) : (
      <UploadRecoveryPanel
        recovery={{
          kind: 'upload_failed',
          title: 'Upload failed',
          plainCause:
            'The upload flow stopped before StatementStudio received a verified document.',
          // SECURITY-AUDIT: relabeled Evidence ID to Support reference; removed OCR from next action
          evidence: [{ label: 'Support reference', value: 'client-upload-flow' }],
          nextAction: 'Upload the PDF again and keep this screen open until the conversion starts.',
        }}
      />
    )
  }
  return (
    <p className="text-sm text-foreground/60">
      No file selected. Choose a bank or credit-card statement PDF to start conversion.
    </p>
  )
}

function PreflightConfirmation({ pendingPreflight }: { pendingPreflight: PendingPreflight }) {
  const { preflight } = pendingPreflight
  const duplicateFound = preflight.duplicate.isDuplicate
  const balanceAfter = Math.max(0, preflight.currentBalance - preflight.quote.costCredits)
  const blockedReason = duplicateFound
    ? 'Resolve the duplicate or add credits before uploading.'
    : 'Add credits before uploading.'
  return (
    <section className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm">
      <p className="font-medium text-[var(--accent)]">
        {preflight.canConvert ? 'Ready to convert' : 'Conversion blocked'}
      </p>
      {!preflight.canConvert && <p className="mt-1 text-foreground/70">{blockedReason}</p>}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <EvidenceRow
          label="Duplicate"
          value={
            duplicateFound
              ? `Duplicate ${preflight.duplicate.existingDocumentId ?? 'found'}`
              : 'No duplicate found'
          }
        />
        <EvidenceRow label="Quote" value={formatCredits(preflight.quote.costCredits)} />
        <EvidenceRow label="Remaining" value={formatCredits(balanceAfter)} />
        {/* SECURITY-AUDIT: removed SHA-256 document hash row */}
      </dl>
    </section>
  )
}

function UploadRecoveryPanel({ recovery }: { recovery: UploadRecovery }) {
  return (
    <section className="rounded-md border border-[var(--danger)]/40 bg-[var(--surface-muted)] p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-[var(--danger)]">{recovery.title}</p>
          <p className="mt-1 text-foreground/70">Cause: {recovery.plainCause}</p>
        </div>
        <span className="inline-flex min-h-7 w-fit items-center rounded-full bg-[color-mix(in_oklch,var(--danger)_16%,transparent)] px-2.5 text-xs font-semibold text-[var(--danger)]">
          {recoveryKindLabel(recovery.kind)}
        </span>
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {recovery.evidence.map((item) => (
          <div key={`${item.label}:${item.value}`}>
            <dt className="text-xs text-foreground/50">{item.label}</dt>
            <dd className="mt-0.5 break-all font-medium text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-foreground/75">
        <span className="font-medium text-foreground">Next action:</span> {recovery.nextAction}
      </p>
    </section>
  )
}

function recoveryKindLabel(kind: UploadRecoveryKind): string {
  switch (kind) {
    case 'upload_failed':
      return 'Upload failed'
    case 's3_verification_failed':
      // SECURITY-AUDIT: removed S3 from recovery kind label
      return 'Document verification failed'
    case 'ocr_start_failed':
      // SECURITY-AUDIT: removed OCR from recovery kind label
      return 'Conversion start failed'
  }
}

function localUploadRecovery(plainCause: string, nextAction: string, file: File): UploadRecovery {
  return {
    kind: 'upload_failed',
    title: 'Upload failed',
    plainCause,
    // SECURITY-AUDIT: relabeled Evidence ID to Support reference
    evidence: [
      { label: 'Support reference', value: 'local-upload-validation' },
      { label: 'Filename', value: file.name },
      { label: 'Size', value: formatBytes(file.size) },
    ],
    nextAction,
  }
}

// SECURITY-AUDIT: redact internal vendor/storage/OCR terms from server-supplied problem detail before display
function redactInfra(text: string): string {
  return text
    .replace(
      /The uploaded object size did not match the pending document\./gi,
      'The uploaded document did not match the pending record.',
    )
    .replace(
      /Textract could not start analysis for this PDF\./gi,
      'The conversion could not be started for this PDF.',
    )
    .replace(
      /S3 object metadata did not match the pending upload record/gi,
      'The uploaded document did not match the pending record',
    )
    .replace(
      /Textract analysis could not be started for the verified upload\./gi,
      'Conversion could not be started for the verified upload.',
    )
    .replace(
      /Textract job failed during OCR processing\./gi,
      'Conversion failed while reading the document.',
    )
    .replace(/\buploaded object\b/gi, 'uploaded document')
    .replace(/\bTextract\b/gi, 'the conversion')
    .replace(/OCR processing/gi, 'document reading')
    .replace(/\bOCR\b/gi, 'document reading')
    .replace(/\bS3\b/gi, 'document')
}

async function readProblem(response: Response): Promise<ProblemResponse> {
  const body = (await response.json().catch(() => ({}))) as ProblemResponse
  return {
    code: typeof body.code === 'string' ? body.code : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
    request_id: typeof body.request_id === 'string' ? body.request_id : undefined,
    trace_id: typeof body.trace_id === 'string' ? body.trace_id : undefined,
  }
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function recoveryFromProblem({
  kind,
  title,
  problem,
  fallbackCause,
  fallbackEvidence,
  nextAction,
}: {
  kind: UploadRecoveryKind
  title: string
  problem: ProblemResponse
  fallbackCause: string
  fallbackEvidence: RecoveryEvidence[]
  nextAction: string
}): UploadRecovery {
  return {
    kind,
    title,
    // SECURITY-AUDIT: redact server problem detail before display
    plainCause: problem.detail ? redactInfra(problem.detail) : fallbackCause,
    evidence: [...problemEvidence(problem), ...fallbackEvidence],
    nextAction,
  }
}

function recoveryFromCompletionProblem(
  problem: ProblemResponse,
  presign: PresignResponse,
): UploadRecovery {
  const evidence = uploadEvidenceIds(presign, problemEvidence(problem))

  if (
    problem.code === 'PRZM_DOCUMENT_UPLOAD_OBJECT_MISSING' ||
    problem.code === 'PRZM_DOCUMENT_UPLOAD_METADATA_MISMATCH' ||
    problem.code === 'PRZM_STORAGE_VERIFICATION_FAILED'
  ) {
    return {
      kind: 's3_verification_failed',
      // SECURITY-AUDIT: removed S3 + storage object internals; redact server detail before display
      title: 'Document verification failed',
      plainCause: problem.detail
        ? redactInfra(problem.detail)
        : 'StatementStudio could not verify that the uploaded document matched the pending record.',
      evidence,
      nextAction:
        'Upload the original PDF again so StatementStudio can verify it again before conversion starts.',
    }
  }

  return {
    kind: 'ocr_start_failed',
    // SECURITY-AUDIT: removed OCR + secure storage internals; redact server detail before display
    title: 'Conversion start failed',
    plainCause: problem.detail
      ? redactInfra(problem.detail)
      : 'The PDF reached storage, but StatementStudio could not start the conversion.',
    evidence,
    nextAction:
      'Open the review record, keep the support reference, and upload again if no retry action is available.',
  }
}

function uploadEvidenceIds(
  presign: PresignResponse,
  extra: RecoveryEvidence[] = [],
): RecoveryEvidence[] {
  return [
    // SECURITY-AUDIT: relabeled Document ID to Support reference; removed Upload request ID + Trace ID rows
    { label: 'Support reference', value: presign.documentId },
    ...extra,
  ]
}

function problemEvidence(problem: ProblemResponse): RecoveryEvidence[] {
  return [
    // SECURITY-AUDIT: removed Request ID + Trace ID correlation rows
    problem.code ? { label: 'Error code', value: problem.code } : null,
  ].filter((item): item is RecoveryEvidence => item !== null)
}

function uploadFlowError(recovery: UploadRecovery): UploadFlowError {
  return Object.assign(new Error(recovery.plainCause), { recovery })
}

function isUploadFlowError(err: unknown): err is UploadFlowError {
  return err instanceof Error && 'recovery' in err
}

function workflowStageIndex(state: UploadState): number {
  switch (state) {
    case 'hashing':
    case 'preflighting':
    case 'confirming':
      return 0
    case 'presigning':
    case 'uploading':
    case 'completing':
      return 1
    case 'converting':
    case 'polling':
      return 2
    case 'done':
      return 3
    case 'idle':
    case 'error':
    default:
      return -1
  }
}

function stepStatusFor(
  index: number,
  activeIndex: number,
  blocked: boolean,
): HorizontalStepperStatus {
  if (activeIndex === -1) return 'waiting'
  if (index < activeIndex) return 'complete'
  if (index === activeIndex) return blocked ? 'blocked' : 'active'
  return 'waiting'
}

function WorkflowPanel({ currentState }: { currentState: UploadState }) {
  const stageIndex =
    currentState === 'done' ? 3 : currentState === 'error' ? -1 : workflowStageIndex(currentState)
  const blocked = currentState === 'error'
  const steps = workflowSteps.map((step, index) => ({
    id: step.label,
    label: step.label,
    sublabel: step.detail,
    status:
      currentState === 'done'
        ? ('complete' as HorizontalStepperStatus)
        : stepStatusFor(index, stageIndex, blocked),
  }))

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Conversion path</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Simple by design. Each step leaves evidence without slowing the converter.
          </p>
        </div>
        {/* SECURITY-AUDIT: removed workflow trace-id badge */}
      </div>
      <div className="mt-6">
        <HorizontalStepper steps={steps} ariaLabel="Conversion path" />
      </div>
    </section>
  )
}

function ProcessingAnimation({ state }: { state: UploadState }) {
  const activeIndex =
    state === 'completing'
      ? 0
      : state === 'converting'
        ? 1
        : state === 'polling'
          ? 2
          : state === 'done'
            ? 3
            : -1
  const blocked = state === 'error'
  const steps = processingStages.map((stage, index) => ({
    id: stage.label,
    label: stage.label,
    sublabel: stage.detail,
    status:
      state === 'done'
        ? ('complete' as HorizontalStepperStatus)
        : stepStatusFor(index, activeIndex, blocked),
  }))

  return (
    <section
      className="mt-5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:p-5"
      aria-label="Document to table"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/45">
        Document to table
      </p>
      <p className="mt-1 text-sm text-foreground/65">
        The extraction record stays visible while rows resolve into spreadsheet columns.
      </p>
      <div className="mt-5">
        <HorizontalStepper steps={steps} ariaLabel="Document to table" />
      </div>
    </section>
  )
}

function CurrentDocumentHandoff({ evidence }: { evidence: UploadEvidence | null }) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Review and export</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Converted statements open in history with status, evidence, and expiration visible.
          </p>
        </div>
        <Link
          href={evidence ? `/app/history/${evidence.documentId}` : '/app/history'}
          className="text-sm font-medium text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {evidence ? 'Open review and export' : 'Open history'}
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-y border-[var(--border-subtle)] text-xs uppercase tracking-[0.08em] text-foreground/45">
            <tr>
              <th className="py-2 pr-4 font-semibold">Statement</th>
              <th className="py-2 pr-4 font-semibold">State</th>
              <th className="py-2 pr-4 font-semibold">Evidence</th>
              <th className="py-2 font-semibold">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {evidence ? (
              <tr>
                <td className="py-3 pr-4 font-medium">{evidence.filename}</td>
                <td className="py-3 pr-4">
                  <ToneBadge tone="info">Processing</ToneBadge>
                </td>
                {/* SECURITY-AUDIT: removed Textract job id from handoff evidence cell */}
                <td className="py-3 pr-4 text-foreground/65">Conversion in progress</td>
                <td className="py-3 text-foreground/65">{formatDateTime(evidence.expiresAt)}</td>
              </tr>
            ) : (
              <tr>
                <td className="py-4 pr-4 font-medium">No current upload</td>
                <td className="py-4 pr-4">
                  <ToneBadge tone="neutral">Waiting</ToneBadge>
                </td>
                <td className="py-4 pr-4 text-foreground/65">
                  Upload a PDF to create the first conversion record.
                </td>
                <td className="py-4 text-foreground/65">24 hours after upload</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="mt-0.5 break-all font-medium">{value}</dd>
    </div>
  )
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${toneClass(tone)}`}
    >
      {children}
    </span>
  )
}

function toneClass(tone: Tone): string {
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

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value
}

function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatCredits(value: number): string {
  return `${value} credit${value === 1 ? '' : 's'}`
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
