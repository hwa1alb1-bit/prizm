import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

export const CLOUDFLARE_EXTRACTION_PROOF_ENV_KEYS = [
  'CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID',
  'CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT',
  'CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA',
] as const

type CloudflareExtractionProofEnv = Record<string, string | undefined>

export type CloudflareExtractionProofValidation =
  | {
      ok: true
      evidencePath: string
    }
  | {
      ok: false
      evidencePath: string | null
      failure: string
    }

const proofIdPattern = /^cf-extraction-staging-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/
const sha256Pattern = /^[a-f0-9]{64}$/

export function validateCloudflareExtractionProofArchive({
  env,
  cwd,
}: {
  env: CloudflareExtractionProofEnv
  cwd: string
}): CloudflareExtractionProofValidation {
  const proofId = env.CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID?.trim() ?? ''
  const archivedAt = env.CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT?.trim() ?? ''
  const expectedSha = env.CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA?.trim() ?? ''

  if (!proofId || !archivedAt || !expectedSha) {
    return {
      ok: false,
      evidencePath: null,
      failure: 'proof_env_missing',
    }
  }

  if (!proofIdPattern.test(proofId)) {
    return {
      ok: false,
      evidencePath: null,
      failure: 'proof_id_invalid',
    }
  }

  if (Number.isNaN(Date.parse(archivedAt))) {
    return {
      ok: false,
      evidencePath: null,
      failure: 'proof_archived_at_invalid',
    }
  }

  if (!sha256Pattern.test(expectedSha)) {
    return {
      ok: false,
      evidencePath: null,
      failure: 'proof_sha_invalid',
    }
  }

  const proofDir = resolve(cwd, 'docs', 'evidence', 'cloudflare-extraction')
  const evidencePath = resolve(proofDir, `${proofId}.json`)
  const relativeEvidencePath = relative(proofDir, evidencePath)
  if (relativeEvidencePath.startsWith('..') || relativeEvidencePath === '') {
    return {
      ok: false,
      evidencePath: null,
      failure: 'proof_path_invalid',
    }
  }

  if (!existsSync(evidencePath)) {
    return {
      ok: false,
      evidencePath,
      failure: 'proof_archive_missing',
    }
  }

  const parsed = parseProof(readFileSync(evidencePath, 'utf8'))
  if (!parsed) {
    return {
      ok: false,
      evidencePath,
      failure: 'proof_archive_invalid_json',
    }
  }

  if (parsed.proofId !== proofId || parsed.archivedAt !== archivedAt) {
    return {
      ok: false,
      evidencePath,
      failure: 'proof_archive_metadata_mismatch',
    }
  }

  if (parsed.sha256 !== expectedSha || proofArchiveSha(parsed) !== expectedSha) {
    return {
      ok: false,
      evidencePath,
      failure: 'proof_archive_sha_mismatch',
    }
  }

  if (!proofArchiveHasHealthyExtraction(parsed)) {
    return {
      ok: false,
      evidencePath,
      failure: 'proof_archive_extraction_not_ready',
    }
  }

  return {
    ok: true,
    evidencePath,
  }
}

function proofArchiveSha(proof: Record<string, unknown>): string {
  const canonicalProof = { ...proof }
  delete canonicalProof.sha256

  return createHash('sha256')
    .update(`${JSON.stringify(canonicalProof, null, 2)}\n`)
    .digest('hex')
}

function proofArchiveHasHealthyExtraction(proof: Record<string, unknown>): boolean {
  const health = readRecord(proof.health)
  const checks = readRecord(health.checks)
  const extraction = readRecord(proof.extraction)
  const firstStatement = readRecord(extraction.firstStatement)

  return (
    health.status === 'ok' &&
    ['jobStateBucket', 'uploadBucket', 'extractionQueue', 'kotlinExtractor'].every(
      (name) => readRecord(checks[name]).ok === true,
    ) &&
    extraction.status === 'succeeded' &&
    typeof extraction.jobId === 'string' &&
    Number(extraction.statementCount) > 0 &&
    firstStatement.ready === true &&
    firstStatement.reconciles === true
  )
}

function parseProof(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return readRecord(parsed)
  } catch {
    return null
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}
