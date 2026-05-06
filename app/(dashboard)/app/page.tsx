'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type UploadState = 'idle' | 'presigning' | 'uploading' | 'completing' | 'done' | 'error'

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

type CompleteResponse = {
  documentId: string
  status: 'processing' | 'ready'
  textractJobId: string
  alreadyCompleted: boolean
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
    label: 'Upload verified',
    detail: 'PRIZM verifies S3 object evidence before OCR is allowed to start.',
  },
  {
    label: 'OCR processing',
    detail: 'Textract reads the statement and returns extraction data for review.',
  },
  {
    label: 'Review exceptions',
    detail: 'Rows that need attention are separated from rows ready to export.',
  },
  {
    label: 'Export and expire',
    detail: 'Ledger-ready output stays tied to the 24-hour deletion window.',
  },
]

const trustControls = [
  { label: 'Retention', value: '24-hour auto-delete' },
  { label: 'Server write', value: 'Upload and OCR audit events required' },
  { label: 'Traceability', value: 'Request, trace, and Textract job returned' },
  { label: 'Access', value: 'Workspace role checked before upload' },
]

export default function UploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [recovery, setRecovery] = useState<UploadRecovery | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null)
  const [evidence, setEvidence] = useState<UploadEvidence | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      setSelectedFile({ name: file.name, size: file.size })

      if (!isPdf) {
        setState('error')
        setRecovery(
          localUploadRecovery(
            'File type is not PDF.',
            'Choose a bank statement exported as a PDF, then upload that file.',
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
            'Export a smaller PDF from the bank portal, then upload the smaller file.',
            file,
          ),
        )
        return
      }

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
          }),
        })

        if (!presignRes.ok) {
          const problem = await readProblem(presignRes)
          throw uploadFlowError(
            recoveryFromProblem({
              kind: 'upload_failed',
              title: 'Upload setup failed',
              problem,
              fallbackCause: 'PRIZM could not create a secure upload URL for this PDF.',
              fallbackEvidence: [{ label: 'File', value: file.name }],
              nextAction:
                'Keep the original PDF, refresh the upload console, and request a new upload URL.',
            }),
          )
        }

        const presign = (await presignRes.json()) as PresignResponse

        setState('uploading')
        const uploadRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: file,
        })

        if (!uploadRes.ok) {
          throw uploadFlowError({
            kind: 'upload_failed',
            title: 'Upload failed',
            plainCause: `The browser upload to secure storage returned HTTP ${uploadRes.status}. No OCR job was started.`,
            evidence: uploadEvidenceIds(presign, [
              { label: 'Storage response', value: String(uploadRes.status) },
            ]),
            nextAction:
              'Upload the same PDF again. If the storage response repeats, export a fresh PDF from the bank portal before retrying.',
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
        const uploadedAt = new Date()
        setEvidence({
          documentId: presign.documentId,
          requestId: presign.request_id,
          completionRequestId: complete.request_id,
          traceId: complete.trace_id,
          textractJobId: complete.textractJobId,
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
                  : 'PRIZM could not finish the upload flow before OCR started.',
                'Upload the PDF again and use the request evidence shown here if the failure repeats.',
                file,
              ),
        )
      }
    },
    [router],
  )

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (state === 'presigning' || state === 'uploading' || state === 'completing') return
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
    if (inputRef.current) inputRef.current.value = ''
  }

  const busy = state === 'presigning' || state === 'uploading'
  const working = busy || state === 'completing'

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="grid gap-4 border-b border-[var(--border-subtle)] pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
            Upload console
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Convert a statement</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/65">
            Upload one PDF at a time. PRIZM records the request, returns trace evidence, and starts
            the statement path toward review and export.
          </p>
        </div>
        <Link
          href="/app/history"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          View history
        </Link>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-6" aria-labelledby="upload-heading">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="upload-heading" className="text-lg font-semibold">
                  Statement intake
                </h2>
                <p className="mt-1 text-sm leading-6 text-foreground/60">
                  PDF only, 20 MB max. Upload URLs expire after 10 minutes.
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
                    {selectedFile?.name ?? 'Drop a bank statement PDF here'}
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    {selectedFile
                      ? `${formatBytes(selectedFile.size)} selected`
                      : 'The file is checked before PRIZM asks S3 for a secure upload URL.'}
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
                  {(state === 'done' || state === 'error') && (
                    <button
                      type="button"
                      onClick={resetUpload}
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      Upload another
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
                <UploadMessage state={state} recovery={recovery} evidence={evidence} />
              </div>
            </div>
          </div>

          <WorkflowPanel currentState={state} evidence={evidence} />
          <CurrentDocumentHandoff evidence={evidence} />
        </section>

        <aside className="space-y-4" aria-label="Upload evidence">
          <EvidencePanel evidence={evidence} />
          <TrustControls />
        </aside>
      </div>
    </div>
  )
}

function StatusPill({ state }: { state: UploadState }) {
  const label =
    state === 'presigning'
      ? 'Preparing'
      : state === 'uploading'
        ? 'Uploading'
        : state === 'completing'
          ? 'Verifying'
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
}: {
  state: UploadState
  recovery: UploadRecovery | null
  evidence: UploadEvidence | null
}) {
  if (state === 'presigning') {
    return <p className="text-sm text-foreground/65">Preparing secure upload URL...</p>
  }
  if (state === 'uploading') {
    return <p className="text-sm text-foreground/65">Uploading to secure storage...</p>
  }
  if (state === 'completing') {
    return (
      <p className="text-sm text-foreground/65">Verifying S3 object evidence and starting OCR...</p>
    )
  }
  if (state === 'done' && evidence) {
    return (
      <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm">
        <p className="font-medium text-[var(--success)]">Processing started.</p>
        <p className="mt-1 text-foreground/65">
          Textract job {evidence.textractJobId} is attached to document{' '}
          {shortId(evidence.documentId)}.
        </p>
        <Link
          href={`/app/history/${evidence.documentId}`}
          className="mt-3 inline-flex text-sm font-medium text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Open review record
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
          plainCause: 'The upload flow stopped before PRIZM received a verified document.',
          evidence: [{ label: 'Evidence ID', value: 'client-upload-flow' }],
          nextAction: 'Upload the PDF again and keep this screen open until OCR starts.',
        }}
      />
    )
  }
  return (
    <p className="text-sm text-foreground/60">
      No file selected. Choose a PDF statement to create a pending document record.
    </p>
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
      return 'S3 verification failed'
    case 'ocr_start_failed':
      return 'OCR start failed'
  }
}

function localUploadRecovery(plainCause: string, nextAction: string, file: File): UploadRecovery {
  return {
    kind: 'upload_failed',
    title: 'Upload failed',
    plainCause,
    evidence: [
      { label: 'Evidence ID', value: 'local-upload-validation' },
      { label: 'Filename', value: file.name },
      { label: 'Size', value: formatBytes(file.size) },
    ],
    nextAction,
  }
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
    plainCause: problem.detail ?? fallbackCause,
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
      title: 'S3 verification failed',
      plainCause:
        problem.detail ??
        'PRIZM could not prove that the uploaded object matched the pending document record.',
      evidence,
      nextAction:
        'Upload the original PDF again so PRIZM can create a new verified object before OCR starts.',
    }
  }

  return {
    kind: 'ocr_start_failed',
    title: 'OCR start failed',
    plainCause:
      problem.detail ?? 'The PDF reached secure storage, but PRIZM could not start OCR analysis.',
    evidence,
    nextAction:
      'Open the review record, keep the document ID, and upload again if no retry action is available.',
  }
}

function uploadEvidenceIds(
  presign: PresignResponse,
  extra: RecoveryEvidence[] = [],
): RecoveryEvidence[] {
  return [
    { label: 'Document ID', value: presign.documentId },
    { label: 'Upload request ID', value: presign.request_id },
    { label: 'Trace ID', value: presign.trace_id },
    ...extra,
  ]
}

function problemEvidence(problem: ProblemResponse): RecoveryEvidence[] {
  return [
    problem.code ? { label: 'Error code', value: problem.code } : null,
    problem.request_id ? { label: 'Request ID', value: problem.request_id } : null,
    problem.trace_id ? { label: 'Trace ID', value: problem.trace_id } : null,
  ].filter((item): item is RecoveryEvidence => item !== null)
}

function uploadFlowError(recovery: UploadRecovery): UploadFlowError {
  return Object.assign(new Error(recovery.plainCause), { recovery })
}

function isUploadFlowError(err: unknown): err is UploadFlowError {
  return err instanceof Error && 'recovery' in err
}

function WorkflowPanel({
  currentState,
  evidence,
}: {
  currentState: UploadState
  evidence: UploadEvidence | null
}) {
  const activeIndex = currentState === 'done' ? 1 : currentState === 'uploading' ? 0 : -1
  const reachedIndex = currentState === 'completing' ? 0 : activeIndex

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Workflow evidence</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Each step should leave a state the firm can inspect later.
          </p>
        </div>
        {evidence && <ToneBadge tone="info">Trace {shortId(evidence.traceId)}</ToneBadge>}
      </div>
      <ol className="mt-5 grid gap-3 lg:grid-cols-4">
        {workflowSteps.map((step, index) => {
          const reached = index <= reachedIndex
          return (
            <li
              key={step.label}
              className={`rounded-md border p-3 ${
                reached
                  ? 'border-[var(--accent)] bg-[var(--surface-muted)]'
                  : 'border-[var(--border-subtle)]'
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/45">
                Step {index + 1}
              </span>
              <h3 className="mt-2 text-sm font-semibold">{step.label}</h3>
              <p className="mt-1 text-xs leading-5 text-foreground/60">{step.detail}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function CurrentDocumentHandoff({ evidence }: { evidence: UploadEvidence | null }) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Review handoff</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Uploaded documents should enter history with status, evidence, and expiration visible.
          </p>
        </div>
        <Link
          href={evidence ? `/app/history/${evidence.documentId}` : '/app/history'}
          className="text-sm font-medium text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {evidence ? 'Open review record' : 'Open history'}
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
                <td className="py-3 pr-4 text-foreground/65">Textract {evidence.textractJobId}</td>
                <td className="py-3 text-foreground/65">{formatDateTime(evidence.expiresAt)}</td>
              </tr>
            ) : (
              <tr>
                <td className="py-4 pr-4 font-medium">No current upload</td>
                <td className="py-4 pr-4">
                  <ToneBadge tone="neutral">Waiting</ToneBadge>
                </td>
                <td className="py-4 pr-4 text-foreground/65">
                  Upload a PDF to create the first document record.
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

function EvidencePanel({ evidence }: { evidence: UploadEvidence | null }) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
      <h2 className="text-base font-semibold">Current evidence</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <EvidenceRow label="Filename" value={evidence?.filename ?? 'Waiting for upload'} />
        <EvidenceRow
          label="Size"
          value={evidence ? formatBytes(evidence.sizeBytes) : 'Checked before upload'}
        />
        <EvidenceRow
          label="Document"
          value={evidence ? shortId(evidence.documentId) : 'Not created'}
        />
        <EvidenceRow
          label="Request ID"
          value={evidence ? shortId(evidence.requestId) : 'Waiting'}
        />
        <EvidenceRow
          label="Complete request"
          value={evidence ? shortId(evidence.completionRequestId) : 'Waiting'}
        />
        <EvidenceRow label="Trace ID" value={evidence ? shortId(evidence.traceId) : 'Waiting'} />
        <EvidenceRow label="Textract job" value={evidence ? evidence.textractJobId : 'Waiting'} />
        <EvidenceRow
          label="Expires"
          value={evidence ? formatDateTime(evidence.expiresAt) : '24 hours after upload'}
        />
      </dl>
    </section>
  )
}

function TrustControls() {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] p-4">
      <h2 className="text-base font-semibold">Trust controls</h2>
      <div className="mt-4 space-y-3">
        {trustControls.map((control) => (
          <div
            key={control.label}
            className="border-t border-[var(--border-subtle)] pt-3 first:border-t-0 first:pt-0"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/45">
              {control.label}
            </p>
            <p className="mt-1 text-sm font-medium">{control.value}</p>
          </div>
        ))}
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
