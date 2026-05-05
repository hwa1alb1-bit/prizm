'use client'

import { useState, useCallback } from 'react'

type UploadState = 'idle' | 'presigning' | 'uploading' | 'done' | 'error'

export default function UploadPage() {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File must be under 20 MB')
      return
    }

    setError(null)
    setState('presigning')

    try {
      const presignRes = await fetch('/api/v1/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      })

      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}))
        throw new Error(
          (body as { detail?: string }).detail ?? `Presign failed: ${presignRes.status}`,
        )
      }

      const { uploadUrl, documentId } = (await presignRes.json()) as {
        uploadUrl: string
        documentId: string
      }

      setState('uploading')
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`)
      }

      setState('done')
      void documentId
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload statement</h1>
        <p className="mt-1 text-sm text-foreground/60">
          PDF bank statements only. Auto-deletes in 24 hours.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          dragOver ? 'border-foreground/40 bg-foreground/5' : 'border-foreground/20'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        {state === 'idle' && (
          <>
            <p className="text-sm font-medium">Drop PDF here or click to browse</p>
            <p className="mt-1 text-xs text-foreground/40">Max 20 MB</p>
          </>
        )}
        {state === 'presigning' && <p className="text-sm">Preparing upload...</p>}
        {state === 'uploading' && <p className="text-sm">Uploading...</p>}
        {state === 'done' && (
          <p className="text-sm text-green-600">Uploaded. Processing will begin shortly.</p>
        )}
        {state === 'error' && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <input
        id="file-input"
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileInput}
      />

      {(state === 'done' || state === 'error') && (
        <button
          onClick={() => {
            setState('idle')
            setError(null)
          }}
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm hover:bg-foreground/5"
        >
          Upload another
        </button>
      )}
    </div>
  )
}
