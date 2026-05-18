export type StagingRehearsalSectionId =
  | 'preflight-gates'
  | 'upload-and-conversion-path'
  | 'cloudflare-r2-kotlin-extraction-proof'
  | 'billing-and-webhook-sanity'
  | 'deletion-expiry'
  | 'audit-evidence'
  | 'alert-and-ops-dashboard-signal'

export type StagingRehearsalEvidenceResult = {
  ok: boolean
  failures: string[]
}

type JsonRecord = Record<string, unknown>

export const stagingRehearsalSections: readonly {
  id: StagingRehearsalSectionId
  title: string
}[] = [
  { id: 'preflight-gates', title: 'Preflight Gates' },
  { id: 'upload-and-conversion-path', title: 'Upload And Conversion Path' },
  {
    id: 'cloudflare-r2-kotlin-extraction-proof',
    title: 'Cloudflare R2 Kotlin Extraction Proof',
  },
  { id: 'billing-and-webhook-sanity', title: 'Billing And Webhook Sanity' },
  { id: 'deletion-expiry', title: 'Deletion Expiry' },
  { id: 'audit-evidence', title: 'Audit Evidence' },
  { id: 'alert-and-ops-dashboard-signal', title: 'Alert And Ops Dashboard Signal' },
]

const requiredTextEvidence = [
  ['launchGateOutput', 'Launch gate output is required.'],
  ['liveConnectorSmokeOutput', 'Live connector smoke output is required.'],
  ['uploadRequestId', 'Upload request ID is required.'],
  ['convertRequestId', 'Convert request ID is required.'],
  ['statusRequestId', 'Status request ID is required.'],
  ['exportRequestId', 'Export request ID is required.'],
  ['auditQueryOutput', 'Audit query output is required.'],
  ['deletionSweepEvidence', 'Deletion sweep evidence is required.'],
  ['deletionMonitorEvidence', 'Deletion monitor evidence is required.'],
  ['sentryAlertLinkOrDrillId', 'Sentry alert link or drill ID is required.'],
] as const

export function evaluateStagingRehearsalEvidence(
  evidence: unknown,
): StagingRehearsalEvidenceResult {
  const failures: string[] = []

  if (!isRecord(evidence)) {
    return { ok: false, failures: ['Staging rehearsal evidence must be a JSON object.'] }
  }

  if (evidence.schemaVersion !== 1) {
    failures.push('Schema version must be 1.')
  }

  const rehearsalDate = hasText(evidence.rehearsalDate) ? evidence.rehearsalDate.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rehearsalDate)) {
    failures.push('Rehearsal date must use YYYY-MM-DD.')
  }

  if (!isReleaseSha(evidence.releaseSha)) {
    failures.push('Release SHA must be a 40-character git SHA.')
  }

  if (!isHttpsUrl(evidence.vercelDeploymentUrl)) {
    failures.push('Vercel deployment URL must be HTTPS.')
  }

  if (!isHostName(evidence.stagingHost)) {
    failures.push('Staging host is required.')
  }

  const sectionEvidence = isRecord(evidence.sectionEvidence) ? evidence.sectionEvidence : {}
  for (const section of stagingRehearsalSections) {
    const sectionValue = sectionEvidence[section.id]
    const expectedDir = `docs/evidence/staging-rehearsals/${rehearsalDate}`

    if (
      !isRecord(sectionValue) ||
      !artifactPathInDirectory(sectionValue.artifactPath, expectedDir)
    ) {
      failures.push(`${section.title} evidence artifact must be archived under ${expectedDir}/.`)
      continue
    }

    if (!isIsoTimestamp(sectionValue.collectedAt)) {
      failures.push(`${section.title} evidence collectedAt must be an ISO timestamp.`)
    }

    if (!isEvidenceStatus(sectionValue.status)) {
      failures.push(`${section.title} evidence status must be pass, fail, or blocked.`)
    }
  }

  for (const [key, message] of requiredTextEvidence) {
    if (!hasText(evidence[key])) {
      failures.push(message)
    }
  }

  if (
    !Array.isArray(evidence.stripeEventIds) ||
    evidence.stripeEventIds.filter(hasText).length === 0
  ) {
    failures.push('Stripe event IDs are required.')
  }

  const signoff = isRecord(evidence.operatorSignoff) ? evidence.operatorSignoff : {}
  if (!hasText(signoff.operator)) {
    failures.push('Operator signoff name is required.')
  }
  if (signoff.result !== 'pass' && signoff.result !== 'fail') {
    failures.push('Operator signoff result must be pass or fail.')
  }
  if (!isIsoTimestamp(signoff.signedAt)) {
    failures.push('Operator signoff signedAt must be an ISO timestamp.')
  }

  return { ok: failures.length === 0, failures }
}

function artifactPathInDirectory(value: unknown, expectedDir: string): boolean {
  return (
    hasText(value) && value.trim().startsWith(`${expectedDir}/`) && value.trim().endsWith('.md')
  )
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEvidenceStatus(value: unknown): boolean {
  return value === 'pass' || value === 'fail' || value === 'blocked'
}

function isReleaseSha(value: unknown): boolean {
  return hasText(value) && /^[a-f0-9]{40}$/i.test(value.trim())
}

function isHttpsUrl(value: unknown): boolean {
  if (!hasText(value)) return false

  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

function isHostName(value: unknown): boolean {
  return hasText(value) && /^[a-z0-9.-]+$/i.test(value.trim()) && value.includes('.')
}

function isIsoTimestamp(value: unknown): boolean {
  return hasText(value) && !Number.isNaN(Date.parse(value))
}
