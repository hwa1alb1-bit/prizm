'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'

type ExportActionItem = {
  format: string
  label: string
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = /filename="?([^"]+)"?/i.exec(header)
  return match?.[1] ?? fallback
}

export function ExportActions({
  documentId,
  actions,
}: {
  documentId: string
  actions: ExportActionItem[]
}) {
  const router = useRouter()
  const statusId = useId()
  const [busyFormat, setBusyFormat] = useState<string | null>(null)
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null)
  const [failedFormat, setFailedFormat] = useState<string | null>(null)

  async function runExport(action: ExportActionItem) {
    if (busyFormat) return
    setBusyFormat(action.format)
    setFailedFormat(null)

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/export?format=${action.format}`)
      if (!response.ok) {
        setFailedFormat(action.format)
        return
      }

      const blob = await response.blob()
      const filename = filenameFromDisposition(
        response.headers.get('content-disposition'),
        `statement-${documentId}.${action.format.includes('csv') ? 'csv' : 'xlsx'}`,
      )

      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)

      setDownloadedFormat(action.format)
      // Re-render the server component so the new statement.export_generated
      // audit event flips the Evidence Timeline export step to complete.
      router.refresh()
    } catch {
      setFailedFormat(action.format)
    } finally {
      setBusyFormat(null)
    }
  }

  const statusMessage = failedFormat
    ? 'Export could not be prepared. Try again.'
    : busyFormat
      ? 'Preparing your export.'
      : downloadedFormat
        ? 'Export downloaded.'
        : ''

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" aria-label="Export actions">
        {actions.map((action) => {
          const busy = busyFormat === action.format
          const done = downloadedFormat === action.format && !busy
          return (
            <button
              key={action.format}
              type="button"
              onClick={() => runExport(action)}
              disabled={Boolean(busyFormat)}
              aria-busy={busy}
              aria-describedby={statusId}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {done && (
                <span aria-hidden="true" className="text-[var(--success)]">
                  ✓
                </span>
              )}
              <span>{busy ? `Preparing ${action.label}` : action.label}</span>
            </button>
          )
        })}
      </div>
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={`min-h-4 text-xs ${
          failedFormat ? 'text-[var(--danger)]' : 'text-foreground/55'
        }`}
      >
        {statusMessage}
      </p>
    </div>
  )
}
