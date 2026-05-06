'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProviderId } from '@/lib/server/ops/types'

type RefreshState = 'idle' | 'refreshing' | 'done' | 'error'

export function ManualRefreshButton({ provider }: { provider: ProviderId }) {
  const router = useRouter()
  const [state, setState] = useState<RefreshState>('idle')

  async function refresh() {
    setState('refreshing')
    const response = await fetch(`/api/ops/collect/${provider}`, { method: 'POST' })
    setState(response.ok ? 'done' : 'error')
    if (response.ok) router.refresh()
  }

  return (
    <button
      type="button"
      onClick={() => void refresh()}
      disabled={state === 'refreshing'}
      className="rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-50"
    >
      {state === 'refreshing' ? 'Refreshing' : state === 'done' ? 'Refreshed' : 'Refresh'}
    </button>
  )
}
