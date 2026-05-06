'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type UploadState = 'idle' | 'presigning' | 'uploading' | 'done' | 'error'

type UploadEvidence = {
  documentId: string
  requestId: string
  traceId: string
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

const MAX_FILE_BYTES = 20 * 1024 * 1024

const workflowSteps = [
  {
    label: 'Upload requested',
    detail: 'PRIZM records the document request and writes an audit event.',
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
  { label: 'Server write', value: 'Audit event required' },
  { label: 'Traceability', value: 'Request ID and trace ID returned' },
  { label: 'Access', value: 'Workspace role checked before upload' },
]

export default function UploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null)
  const [evidence, setEvidence] = useState<UploadEvidence | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      setSelectedFile({ name: file.name, size: file.size })

      if (!isPdf) {
        setState('error')
        setError('File needs to be a PDF. Choose a statement saved as .pdf.')
        return
      }

      if (file.size > MAX_FILE_BYTES) {
        setState('error')
        setError('File needs to be under 20 MB. Export a smaller PDF and try again.')
        return
      }

      setError(null)
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
          const body = await presignRes.json().catch(() => ({}))
          throw new Error((body as { detail?: string }).detail ?? `Upload could not be prepared.`)
        }

        const presign = (await presignRes.json()) as PresignResponse

        setState('uploading')
        const uploadRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: file,
        })

        if (!uploadRes.ok) {
          throw new Error('The file did not reach secure storage. No review data was created.')
        }

        const uploadedAt = new Date()
        setEvidence({
          documentId: presign.documentId,
          requestId: presign.request_id,
          traceId: presign.trace_id,
          filename: file.name,
          sizeBytes: file.size,
          uploadedAt: uploadedAt.toISOString(),
          expiresAt: new Date(uploadedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        })
        setState('done')
        router.push(`/app/history/${presign.documentId}`)
      } catch (err) {
        setState('error')
        setError(err instanceof Error ? err.message : 'Upload failed. Try again.')
      }
    },
    [router],
  )

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (state === 'presigning' || state === 'uploading') return
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  function resetUpload() {
    setState('idle')
    setError(null)
    setSelectedFile(null)
    setEvidence(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const busy = state === 'presigning' || state === 'uploading'

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
                if (!busy) setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              aria-busy={busy}
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
                    disabled={busy}
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
                disabled={busy}
                onChange={handleFileInput}
              />

              <div className="mt-5" aria-live="polite">
                <UploadMessage state={state} error={error} evidence={evidence} />
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
        : state === 'done'
          ? 'Uploaded'
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
  error,
  evidence,
}: {
  state: UploadState
  error: string | null
  evidence: UploadEvidence | null
}) {
  if (state === 'presigning') {
    return <p className="text-sm text-foreground/65">Preparing secure upload URL...</p>
  }
  if (state === 'uploading') {
    return <p className="text-sm text-foreground/65">Uploading to secure storage...</p>
  }
  if (state === 'done' && evidence) {
    return (
      <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm">
        <p className="font-medium text-[var(--success)]">Uploaded. Processing can begin.</p>
        <p className="mt-1 text-foreground/65">
          Document {shortId(evidence.documentId)} is recorded with request{' '}
          {shortId(evidence.requestId)}.
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
    return (
      <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--surface-muted)] p-3 text-sm">
        <p className="font-medium text-[var(--danger)]">Upload needs attention</p>
        <p className="mt-1 text-foreground/70">{error}</p>
      </div>
    )
  }
  return (
    <p className="text-sm text-foreground/60">
      No file selected. Choose a PDF statement to create a pending document record.
    </p>
  )
}

function WorkflowPanel({
  currentState,
  evidence,
}: {
  currentState: UploadState
  evidence: UploadEvidence | null
}) {
  const activeIndex = currentState === 'done' ? 1 : currentState === 'uploading' ? 0 : -1

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
          const reached = index <= activeIndex
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
                  <ToneBadge tone="info">Processing can begin</ToneBadge>
                </td>
                <td className="py-3 pr-4 text-foreground/65">
                  Request {shortId(evidence.requestId)} recorded
                </td>
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
        <EvidenceRow label="Trace ID" value={evidence ? shortId(evidence.traceId) : 'Waiting'} />
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
