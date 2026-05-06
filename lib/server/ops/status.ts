import 'server-only'

import type { OpsFreshness, OpsStatus } from './types'

type MetricStatusInput = {
  used: number | null
  limit: number | null
  required: boolean
  freshness?: OpsFreshness
  errorCode?: string | null
  warningThreshold?: number
  criticalThreshold?: number
}

export function computeMetricStatus(input: MetricStatusInput): OpsStatus {
  if (input.errorCode && input.required) return 'red'
  if (input.freshness === 'failed' && input.required) return 'red'
  if (input.freshness === 'stale') return input.required ? 'red' : 'gray'

  if (input.used === null || input.limit === null || input.limit <= 0) {
    return 'gray'
  }

  if (input.used > input.limit) return 'red'

  const warningThreshold = input.warningThreshold ?? 0.7
  const criticalThreshold = input.criticalThreshold ?? 0.85
  const usage = input.used / input.limit

  if (usage > criticalThreshold) return 'red'
  if (usage >= warningThreshold) return 'yellow'
  return 'green'
}

export function computeFreshness(input: {
  collectedAt: string | null
  now?: Date
  staleAfterMinutes: number
  failed?: boolean
}): OpsFreshness {
  if (!input.collectedAt) return input.failed ? 'failed' : 'stale'

  const collectedAt = new Date(input.collectedAt)
  if (Number.isNaN(collectedAt.getTime())) return input.failed ? 'failed' : 'stale'

  const now = input.now ?? new Date()
  const ageMs = now.getTime() - collectedAt.getTime()
  const staleAfterMs = input.staleAfterMinutes * 60 * 1000

  return ageMs <= staleAfterMs ? 'fresh' : 'stale'
}
