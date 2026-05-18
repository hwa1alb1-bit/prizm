'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const TERMINAL_STATES = new Set(['ready', 'failed', 'expired'])

export function ProcessingStatusRefresh({
  documentId,
  intervalMs = 3000,
}: {
  documentId: string
  intervalMs?: number
}) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let terminal = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    async function checkStatus() {
      try {
        const response = await fetch(`/api/v1/documents/${documentId}/status`, {
          cache: 'no-store',
        })
        if (cancelled) return

        if (response.ok) {
          const body = (await response.json().catch(() => ({}))) as { state?: unknown }
          if (typeof body.state === 'string' && TERMINAL_STATES.has(body.state)) {
            terminal = true
            router.refresh()
            return
          }
        }
      } finally {
        if (!cancelled && !terminal) timeout = setTimeout(checkStatus, intervalMs)
      }
    }

    void checkStatus()

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [documentId, intervalMs, router])

  return null
}
