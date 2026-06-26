'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from '@/components/shared/check-circle'
import { FORMAT_META, type ExportFormat } from '@/components/shared/format-meta'

export type ExportActionItem = {
  format: ExportFormat
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
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null)
  const [downloadedFormat, setDownloadedFormat] = useState<ExportFormat | null>(null)
  const [failedFormat, setFailedFormat] = useState<ExportFormat | null>(null)

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

  const downloadedLabel = downloadedFormat ? FORMAT_META[downloadedFormat].label : null
  const statusMessage = failedFormat
    ? 'Export could not be prepared. Try again.'
    : busyFormat
      ? `Preparing your ${FORMAT_META[busyFormat].label} export.`
      : downloadedLabel
        ? `${downloadedLabel} export downloaded.`
        : ''

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Download as</p>
      <div className="flex flex-wrap gap-2.5" aria-label="Export actions">
        {actions.map((action) => {
          const meta = FORMAT_META[action.format]
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
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {done ? (
                <CheckCircle tone="success" className="h-4 w-4" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={meta.icon}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] shrink-0 rounded-sm bg-white object-contain p-0.5"
                />
              )}
              <span>{busy ? `Preparing ${meta.label}` : meta.label}</span>
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
