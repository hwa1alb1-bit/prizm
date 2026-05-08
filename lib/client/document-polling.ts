export type DocumentPollState =
  | 'pending'
  | 'verified'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'expired'
  | 'unknown'
  | 'unavailable'

const DEFAULT_POLL_DELAYS_MS = [1_000, 2_000, 4_000] as const
const TERMINAL_STATES = new Set<DocumentPollState>(['ready', 'failed', 'expired'])

export async function pollDocumentStatus(documentId: string): Promise<DocumentPollState> {
  let latestState: DocumentPollState = 'unknown'

  for (let attempt = 0; attempt <= DEFAULT_POLL_DELAYS_MS.length; attempt += 1) {
    const response = await fetch(`/api/v1/documents/${documentId}/status`)
    if (!response.ok) return 'unavailable'

    const body = (await response.json().catch(() => ({}))) as { state?: unknown }
    latestState = normalizeDocumentPollState(body.state)
    if (TERMINAL_STATES.has(latestState)) return latestState

    const delayMs = DEFAULT_POLL_DELAYS_MS[attempt]
    if (delayMs !== undefined) await sleep(delayMs)
  }

  return latestState
}

function normalizeDocumentPollState(state: unknown): DocumentPollState {
  switch (state) {
    case 'pending':
    case 'verified':
    case 'processing':
    case 'ready':
    case 'failed':
    case 'expired':
      return state
    default:
      return 'unknown'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
